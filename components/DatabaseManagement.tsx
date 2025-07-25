import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { ALLOWED_TABLES, TABLE_SCHEMAS } from '@/constants/database';
import { 
  Database, 
  Table, 
  Search, 
  Download, 
  Play, 
  Eye, 
  Trash2,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react-native';

interface TableInfo {
  table_name: string;
  row_count: number;
  columns: Array<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>;
}

interface QueryResult {
  success: boolean;
  data?: any[];
  error?: string;
  rowCount?: number;
  executionTime?: number;
}

export function DatabaseManagement() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [customQuery, setCustomQuery] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');

  const ROWS_PER_PAGE = 20;

  // Use predefined safe tables for admin access
  const allowedTables = ALLOWED_TABLES;

  useEffect(() => {
    fetchTables();
  }, []);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const tablePromises = allowedTables.map(async (tableName) => {
        try {
          // Get row count
          const { count, error: countError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (countError) {
            console.warn(`Error counting ${tableName}:`, countError);
            return null;
          }

          // Get column information (simplified mock)
          const columns = await getTableColumns(tableName);

          return {
            table_name: tableName,
            row_count: count || 0,
            columns
          };
        } catch (error) {
          console.warn(`Error fetching info for ${tableName}:`, error);
          return null;
        }
      });

      const results = await Promise.all(tablePromises);
      const validTables = results.filter(table => table !== null) as TableInfo[];
      setTables(validTables);

    } catch (error) {
      console.error('Error fetching tables:', error);
      Alert.alert('Error', 'Failed to load database tables');
    } finally {
      setLoading(false);
    }
  };

  const getTableColumns = async (tableName: string) => {
    // Use TABLE_SCHEMAS from constants
    const schema = TABLE_SCHEMAS[tableName];
    if (schema) {
      return schema.columns.map(col => ({
        column_name: col.name,
        data_type: col.type,
        is_nullable: col.nullable ? 'YES' : 'NO'
      }));
    }

    // Fallback for unknown tables
    return [];
  };

  const fetchTableData = async (tableName: string, page: number = 1) => {
    if (!allowedTables.includes(tableName)) {
      Alert.alert('Error', 'Access to this table is not allowed');
      return;
    }

    setDataLoading(true);
    try {
      const from = (page - 1) * ROWS_PER_PAGE;
      const to = from + ROWS_PER_PAGE - 1;

      let query = supabase
        .from(tableName)
        .select('*')
        .range(from, to)
        .order('created_at', { ascending: false });

      // Apply search filter if exists
      if (searchQuery && filterColumn) {
        query = query.ilike(filterColumn, `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setTableData(data || []);
      setSelectedTable(tableName);

    } catch (error) {
      console.error('Error fetching table data:', error);
      Alert.alert('Error', `Failed to load data from ${tableName}`);
    } finally {
      setDataLoading(false);
    }
  };

  const executeCustomQuery = async () => {
    if (!customQuery.trim()) {
      Alert.alert('Error', 'Please enter a query');
      return;
    }

    // Basic safety check for SELECT queries only
    const trimmedQuery = customQuery.trim().toLowerCase();
    if (!trimmedQuery.startsWith('select')) {
      Alert.alert('Error', 'Only SELECT queries are allowed for safety');
      return;
    }

    setQueryLoading(true);
    const startTime = Date.now();

    try {
      // Note: For security, we're limiting this to specific safe queries
      // In a real implementation, you might want to use a stored procedure or RPC
      
      // Parse table name from query for basic validation
      const tableMatch = customQuery.match(/from\s+(\w+)/i);
      const tableName = tableMatch ? tableMatch[1] : '';
      
      if (tableName && !allowedTables.includes(tableName)) {
        throw new Error('Access to this table is not allowed');
      }

      // For demonstration, we'll execute a basic select using supabase client
      // This is limited but safer than raw SQL execution
      if (tableName && allowedTables.includes(tableName)) {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(100); // Limit results for safety

        if (error) throw error;

        const executionTime = Date.now() - startTime;
        setQueryResult({
          success: true,
          data: data || [],
          rowCount: count || 0,
          executionTime
        });
      } else {
        throw new Error('Invalid or unsafe query');
      }

    } catch (error) {
      const executionTime = Date.now() - startTime;
      setQueryResult({
        success: false,
        error: (error as Error).message,
        executionTime
      });
    } finally {
      setQueryLoading(false);
    }
  };

  const exportTableData = async (tableName: string) => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*');

      if (error) throw error;

      // Convert to CSV format
      if (data && data.length > 0) {
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(','),
          ...data.map(row => 
            headers.map(header => 
              typeof row[header] === 'string' 
                ? `"${row[header].replace(/"/g, '""')}"` 
                : row[header]
            ).join(',')
          )
        ].join('\n');

        // In a real app, you'd save this to device or share
        Alert.alert('Export Ready', `${data.length} rows exported to CSV format`);
        console.log(`CSV data for ${tableName}:`, csvContent);
      }

    } catch (error) {
      Alert.alert('Error', `Failed to export ${tableName}: ${(error as Error).message}`);
    }
  };

  const renderQueryModal = () => (
    <Modal
      visible={showQueryModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowQueryModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.queryModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>SQL Query Runner</Text>
            <TouchableOpacity onPress={() => setShowQueryModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.queryNote}>
            ⚠️ Only SELECT queries are allowed for security
          </Text>

          <TextInput
            style={styles.queryInput}
            placeholder="SELECT * FROM profiles LIMIT 10;"
            value={customQuery}
            onChangeText={setCustomQuery}
            multiline
            numberOfLines={4}
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity
            style={[
              styles.executeButton,
              queryLoading && styles.executeButtonDisabled
            ]}
            onPress={executeCustomQuery}
            disabled={queryLoading}
          >
            {queryLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Play size={16} color="white" />
            )}
            <Text style={styles.executeButtonText}>
              {queryLoading ? 'Executing...' : 'Execute Query'}
            </Text>
          </TouchableOpacity>

          {queryResult && (
            <View style={styles.queryResultContainer}>
              <View style={styles.queryResultHeader}>
                {queryResult.success ? (
                  <CheckCircle size={16} color="#10B981" />
                ) : (
                  <AlertCircle size={16} color="#EF4444" />
                )}
                <Text style={[
                  styles.queryResultStatus,
                  { color: queryResult.success ? '#10B981' : '#EF4444' }
                ]}>
                  {queryResult.success ? 'Success' : 'Error'}
                </Text>
                <Text style={styles.queryExecutionTime}>
                  {queryResult.executionTime}ms
                </Text>
              </View>

              {queryResult.success ? (
                <View>
                  <Text style={styles.queryResultInfo}>
                    {queryResult.rowCount} rows returned
                  </Text>
                  <ScrollView style={styles.queryResultData} horizontal>
                    {queryResult.data && queryResult.data.length > 0 && (
                      <View>
                        <View style={styles.queryResultRow}>
                          {Object.keys(queryResult.data[0]).map(key => (
                            <Text key={key} style={styles.queryResultHeader}>
                              {key}
                            </Text>
                          ))}
                        </View>
                        {queryResult.data.slice(0, 10).map((row, index) => (
                          <View key={index} style={styles.queryResultRow}>
                            {Object.values(row).map((value, i) => (
                              <Text key={i} style={styles.queryResultCell}>
                                {String(value).substring(0, 20)}
                                {String(value).length > 20 ? '...' : ''}
                              </Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    )}
                  </ScrollView>
                </View>
              ) : (
                <Text style={styles.queryError}>{queryResult.error}</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderTableModal = () => (
    <Modal
      visible={showTableModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowTableModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.tableModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Table: {selectedTable}</Text>
            <TouchableOpacity onPress={() => setShowTableModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tableActions}>
            <TouchableOpacity
              style={styles.tableActionButton}
              onPress={() => exportTableData(selectedTable)}
            >
              <Download size={16} color="white" />
              <Text style={styles.tableActionText}>Export CSV</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tableActionButton, { backgroundColor: '#10B981' }]}
              onPress={() => fetchTableData(selectedTable, currentPage)}
            >
              <RefreshCw size={16} color="white" />
              <Text style={styles.tableActionText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {/* Table Schema */}
          <View style={styles.schemaContainer}>
            <Text style={styles.schemaTitle}>Schema:</Text>
            <ScrollView style={styles.schemaList}>
              {tables.find(t => t.table_name === selectedTable)?.columns.map(col => (
                <View key={col.column_name} style={styles.schemaRow}>
                  <Text style={styles.columnName}>{col.column_name}</Text>
                  <Text style={styles.columnType}>{col.data_type}</Text>
                  <Text style={styles.columnNullable}>
                    {col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Table Data */}
          <View style={styles.dataContainer}>
            <Text style={styles.dataTitle}>Data Preview:</Text>
            {dataLoading ? (
              <ActivityIndicator size="large" color="#3B82F6" />
            ) : (
              <ScrollView style={styles.dataScroll} horizontal>
                {tableData.length > 0 ? (
                  <View>
                    <View style={styles.dataHeaderRow}>
                      {Object.keys(tableData[0]).map(key => (
                        <Text key={key} style={styles.dataHeader}>{key}</Text>
                      ))}
                    </View>
                    {tableData.map((row, index) => (
                      <View key={index} style={styles.dataRow}>
                        {Object.values(row).map((value, i) => (
                          <Text key={i} style={styles.dataCell}>
                            {String(value).substring(0, 15)}
                            {String(value).length > 15 ? '...' : ''}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noData}>No data available</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading database info...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Database Management</Text>
        <TouchableOpacity
          style={styles.queryButton}
          onPress={() => setShowQueryModal(true)}
        >
          <Play size={16} color="white" />
          <Text style={styles.queryButtonText}>Run Query</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.subtitle}>
        Manage and explore database tables safely
      </Text>

      <ScrollView style={styles.tablesList}>
        {tables.map(table => (
          <TouchableOpacity
            key={table.table_name}
            style={styles.tableCard}
            onPress={() => {
              fetchTableData(table.table_name);
              setShowTableModal(true);
            }}
          >
            <View style={styles.tableCardHeader}>
              <View style={styles.tableInfo}>
                <Database size={20} color="#3B82F6" />
                <Text style={styles.tableName}>{table.table_name}</Text>
              </View>
              <View style={styles.tableStats}>
                <Text style={styles.rowCount}>{table.row_count} rows</Text>
                <Text style={styles.columnCount}>
                  {table.columns.length} columns
                </Text>
              </View>
            </View>

            <View style={styles.tableActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  fetchTableData(table.table_name);
                  setShowTableModal(true);
                }}
              >
                <Eye size={14} color="#3B82F6" />
                <Text style={styles.actionBtnText}>View</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  exportTableData(table.table_name);
                }}
              >
                <Download size={14} color="#10B981" />
                <Text style={styles.actionBtnText}>Export</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.columnPreview}>
              <Text style={styles.columnPreviewTitle}>Columns:</Text>
              <View style={styles.columnTags}>
                {table.columns.slice(0, 4).map(col => (
                  <Text key={col.column_name} style={styles.columnTag}>
                    {col.column_name}
                  </Text>
                ))}
                {table.columns.length > 4 && (
                  <Text style={styles.columnTag}>
                    +{table.columns.length - 4} more
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {renderQueryModal()}
      {renderTableModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  queryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  queryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  tablesList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  tableCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  tableStats: {
    alignItems: 'flex-end',
  },
  rowCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  columnCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  tableActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  columnPreview: {
    marginTop: 8,
  },
  columnPreviewTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  columnTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  columnTag: {
    fontSize: 10,
    color: '#3B82F6',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  queryModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '95%',
    maxHeight: '90%',
  },
  tableModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '95%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalClose: {
    fontSize: 20,
    color: '#6B7280',
  },
  queryNote: {
    fontSize: 12,
    color: '#F59E0B',
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
  },
  queryInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  executeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  executeButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  executeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  queryResultContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    maxHeight: 300,
  },
  queryResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  queryResultStatus: {
    fontWeight: '600',
  },
  queryExecutionTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  queryResultInfo: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  queryResultData: {
    maxHeight: 200,
  },
  queryResultRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
  },
  queryResultCell: {
    fontSize: 12,
    color: '#374151',
    minWidth: 100,
    paddingRight: 8,
  },
  queryError: {
    color: '#EF4444',
    fontSize: 14,
    lineHeight: 20,
  },
  tableActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  tableActionText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
  schemaContainer: {
    marginBottom: 16,
  },
  schemaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  schemaList: {
    maxHeight: 120,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 8,
  },
  schemaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  columnName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    flex: 2,
  },
  columnType: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  columnNullable: {
    fontSize: 10,
    color: '#9CA3AF',
    flex: 1,
    textAlign: 'right',
  },
  dataContainer: {
    flex: 1,
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  dataScroll: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 8,
  },
  dataHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4,
    marginBottom: 4,
  },
  dataHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    minWidth: 80,
    paddingRight: 8,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 4,
  },
  dataCell: {
    fontSize: 11,
    color: '#6B7280',
    minWidth: 80,
    paddingRight: 8,
  },
  noData: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 20,
  },
}); 