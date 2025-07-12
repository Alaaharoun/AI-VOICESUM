import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const params = useLocalSearchParams();

  // Supabase sends access_token in the URL for password reset
  const access_token = params.access_token as string | undefined;

  useEffect(() => {
    if (!access_token) {
      setError('Invalid or missing password reset token. Please use the link from your email.');
    }
  }, [access_token]);

  const handleReset = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (!access_token) {
      Alert.alert('Error', 'Missing reset token. Please use the link from your email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Exchange the token for a session
      const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(access_token);
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }
      // Now update the password
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Password Updated</Text>
        <Text style={styles.subtitle}>Your password has been updated. You can now sign in with your new password.</Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')} style={styles.button}>
          <Text style={styles.buttonText}>Go to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set New Password</Text>
      <Text style={styles.subtitle}>Enter your new password below.</Text>
      {error ? <Text style={{ color: '#DC2626', marginBottom: 12 }}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="New Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      <TouchableOpacity
        style={styles.button}
        onPress={handleReset}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Updating...' : 'Update Password'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.replace('/(auth)/sign-in')} style={{ marginTop: 16 }}>
        <Text style={{ color: '#2563EB' }}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F8FAFC' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, color: '#2563EB' },
  subtitle: { fontSize: 16, color: '#6B7280', marginBottom: 24, textAlign: 'center' },
  input: { width: '100%', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, marginBottom: 16, backgroundColor: 'white' },
  button: { backgroundColor: '#2563EB', borderRadius: 8, paddingVertical: 14, alignItems: 'center', width: '100%' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
}); 