import React, { useState, useEffect } from 'react';
import { History as HistoryIcon, Download, Search, Calendar, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface Recording {
  id: string;
  transcription: string;
  translation: string | null;
  summary: string | null;
  created_at: string;
  duration: number | null;
  target_language: string | null;
}

export const History: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      loadRecordings();
    }
  }, [user]);

  const loadRecordings = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading recordings:', error);
        return;
      }

      setRecordings(data || []);
    } catch (error) {
      console.error('Error loading recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecordings = recordings.filter(recording =>
    recording.transcription.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (recording.translation && recording.translation.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (recording.summary && recording.summary.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const downloadRecording = (recording: Recording) => {
    const content = `Transcription: ${recording.transcription}\n\nTranslation: ${recording.translation || 'N/A'}\n\nSummary: ${recording.summary || 'N/A'}\n\nDate: ${formatDate(recording.created_at)}\nDuration: ${formatDuration(recording.duration)}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${recording.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const deleteRecording = async (recordingId: string) => {
    try {
      const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', recordingId);

      if (error) {
        console.error('Error deleting recording:', error);
        return;
      }

      // Remove from local state
      setRecordings(recordings.filter(r => r.id !== recordingId));
    } catch (error) {
      console.error('Error deleting recording:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your recordings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Recording History</h1>
          <p className="text-lg text-gray-600">
            View and manage your past transcriptions and translations
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md mx-auto">
            <Search className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search transcriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Recordings List */}
        <div className="space-y-4">
          {filteredRecordings.length === 0 ? (
            <div className="text-center py-12">
              <HistoryIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No recordings found</h3>
              <p className="text-gray-600">
                {searchTerm ? 'Try adjusting your search terms.' : 'Start recording to see your history here.'}
              </p>
            </div>
          ) : (
            filteredRecordings.map((recording) => (
              <div key={recording.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(recording.created_at)}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span>{formatDuration(recording.duration)}</span>
                      </div>
                      {recording.target_language && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {recording.target_language.toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Transcription</h4>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                          {recording.transcription}
                        </p>
                      </div>

                      {recording.translation && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Translation</h4>
                          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                            {recording.translation}
                          </p>
                        </div>
                      )}

                      {recording.summary && (
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">Summary</h4>
                          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                            {recording.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col space-y-2">
                    <button
                      onClick={() => downloadRecording(recording)}
                      className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </button>
                    <button
                      onClick={() => deleteRecording(recording.id)}
                      className="flex items-center space-x-2 text-red-600 hover:text-red-700 text-sm"
                    >
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Statistics */}
        {recordings.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <div className="text-2xl font-bold text-blue-600">{recordings.length}</div>
              <div className="text-sm text-gray-600">Total Recordings</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600">
                {recordings.filter(r => r.translation).length}
              </div>
              <div className="text-sm text-gray-600">With Translation</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-purple-600">
                {recordings.filter(r => r.summary).length}
              </div>
              <div className="text-sm text-gray-600">With Summary</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(recordings.reduce((acc, r) => acc + (r.duration || 0), 0) / 60)}
              </div>
              <div className="text-sm text-gray-600">Total Minutes</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 