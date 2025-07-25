import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, Languages, ChevronDown, Check } from 'lucide-react-native';
import { SpeechService } from '@/services/speechService';
import { getItemAsync, setItemAsync, deleteItemAsync } from '@/utils/storage';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { signIn } = useAuth();

  React.useEffect(() => {
    (async () => {
      const savedEmail = await getItemAsync('savedEmail');
      const savedPassword = await getItemAsync('savedPassword');
      if (savedEmail && savedPassword) {
        setEmail(savedEmail);
        setPassword(savedPassword);
        setRememberMe(true);
      }
    })();
  }, []);

  const getFriendlyErrorMessage = (error: any) => {
    if (!error) return 'An unexpected error occurred. Please try again.';
    
    // Safe error handling - check for null/undefined before accessing properties
    const msg = (error && typeof error === 'object') 
      ? (error.message || error.error_description || error.code || error.toString?.() || '')
      : String(error || '');
      
    if (msg.includes('User already registered') || msg.includes('already registered')) {
      return 'This email is already registered.';
    }
    if (msg.includes('invalid email')) {
      return 'Please enter a valid email address.';
    }
    if (msg.includes('rate limit')) {
      return 'Too many attempts. Please try again later.';
    }
    if (msg.includes('Email not confirmed')) {
      return 'Please confirm your email address first.';
    }
    if (msg.includes('Invalid login credentials')) {
      return 'Invalid email or password.';
    }
    return 'An error occurred. Please try again.';
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    console.log('[SignIn] Starting sign in process...');
    
    try {
      console.log('[SignIn] Calling signIn function...');
      const result = await signIn(email, password);
      
      // Safe access to result and error
      const error = result?.error || null;
      
      if (error) {
        console.error('[SignIn] Sign in error:', error);
        Alert.alert('Sign In Failed', getFriendlyErrorMessage(error));
      } else {
        if (rememberMe) {
          await setItemAsync('savedEmail', email);
          await setItemAsync('savedPassword', password);
        } else {
          await deleteItemAsync('savedEmail');
          await deleteItemAsync('savedPassword');
        }
        console.log('[SignIn] Sign in successful, navigating to tabs...');
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('[SignIn] Unexpected error:', error);
      Alert.alert('Unexpected Error', 'Something went wrong. Please check your internet connection or try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={60}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessible={true}
            accessibilityLabel="App logo"
          />
          <Text style={styles.appName}>Live translate with AI</Text>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your voice journey</Text>
        </View>
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Mail size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              spellCheck={false}
              textContentType="emailAddress"
              importantForAutofill="yes"
              autoFocus={false}
              blurOnSubmit={false}
              returnKeyType="next"
              enablesReturnKeyAutomatically={true}
              clearButtonMode="while-editing"
              accessibilityLabel="Email address"
              accessibilityHint="Enter your email address for login"
            />
          </View>
          <View style={styles.inputContainer}>
            <Lock size={20} color="#6B7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              autoCorrect={false}
              spellCheck={false}
              textContentType="password"
              importantForAutofill="yes"
              autoFocus={false}
              blurOnSubmit={true}
              returnKeyType="done"
              enablesReturnKeyAutomatically={true}
              clearButtonMode="while-editing"
              accessibilityLabel="Password"
              accessibilityHint="Enter your password for login"
              onSubmitEditing={handleSignIn}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              accessibilityRole="button"
            >
              {showPassword ? (
                <EyeOff size={20} color="#6B7280" />
              ) : (
                <Eye size={20} color="#6B7280" />
              )}
            </TouchableOpacity>
          </View>
          {/* Forgot Password Button */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={{ alignSelf: 'flex-end', marginBottom: 12 }}
          >
            <Text style={{ color: '#2563EB', fontSize: 14 }}>Forgot Password?</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ marginRight: 8 }}>Remember Me</Text>
            <TouchableOpacity onPress={() => setRememberMe(!rememberMe)} accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }}>
              <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#2563EB', alignItems: 'center', justifyContent: 'center', backgroundColor: rememberMe ? '#2563EB' : 'white' }}>
                {rememberMe && <View style={{ width: 12, height: 12, backgroundColor: 'white', borderRadius: 3 }} />}
              </View>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.signInButton, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            accessibilityLabel="Sign in button"
            accessibilityRole="button"
            accessibilityHint="Tap to sign in with your credentials"
          >
            <Text style={styles.signInButtonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Link href="/(auth)/sign-up" style={styles.link}>
                Sign up
              </Link>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#2563EB',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  eyeIcon: {
    padding: 4,
  },
  signInButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0.1,
  },
  signInButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: 'white',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  link: {
    color: '#2563EB',
    fontFamily: 'Inter-SemiBold',
  },
});