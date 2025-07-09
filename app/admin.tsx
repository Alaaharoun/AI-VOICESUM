import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useUserPermissions } from '@/hooks/useAuth';
import { AdminPanel } from '@/components/AdminPanel';

export default function AdminRoute() {
  const { isSuperadmin, hasRole, loading } = useUserPermissions();
  const [pin, setPin] = useState('');
  const [pinOk, setPinOk] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = isSuperadmin || hasRole('admin') || hasRole('superadmin');

  if (loading) {
    return <View style={styles.center}><Text>Loading...</Text></View>;
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.deniedTitle}>Access Denied</Text>
        <Text style={styles.deniedText}>You do not have permission to access this page.</Text>
      </View>
    );
  }

  if (!pinOk) {
    return (
      <View style={styles.center}>
        <Text style={styles.pinTitle}>Enter Admin PIN</Text>
        <TextInput
          style={styles.pinInput}
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          secureTextEntry
          maxLength={8}
          placeholder="Enter PIN"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={styles.pinButton}
          onPress={() => {
            if (pin === '1414') {
              setPinOk(true);
              setError('');
            } else {
              setError('Incorrect PIN');
            }
          }}
        >
          <Text style={styles.pinButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <AdminPanel />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  deniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 8,
  },
  deniedText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1F2937',
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    width: 180,
    textAlign: 'center',
    marginBottom: 12,
    backgroundColor: 'white',
  },
  pinButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  pinButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  error: {
    color: '#EF4444',
    marginBottom: 8,
  },
}); 