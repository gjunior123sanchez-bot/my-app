import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignInScreen({ onSignIn, onNavigateToRegister, onNavigateToForgot }) {
  const [identifier, setIdentifier] = useState(''); // Email o Full Name
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const inputClean = identifier.trim().toLowerCase();
    const passClean = password.trim();

    if (!inputClean || !passClean) {
      Alert.alert('Error', 'Please enter both Email/Name and Password.');
      return;
    }

    try {
      // Kunin ang nakagawang users mula sa AsyncStorage
      const storedData = await AsyncStorage.getItem('@ikonek_users');
      const users = storedData ? JSON.parse(storedData) : [];

      if (users.length === 0) {
        Alert.alert(
          'Account Not Found',
          'No registered accounts found in local storage. Please create an account first.'
        );
        return;
      }

      // Hanapin ang user (case-insensitive check sa Email o Full Name)
      const foundUser = users.find(
        (u) =>
          (u.email && u.email.trim().toLowerCase() === inputClean) ||
          (u.fullName && u.fullName.trim().toLowerCase() === inputClean)
      );

      if (!foundUser) {
        Alert.alert(
          'Sign In Error',
          'Account does not exist. Please check your spelling or register a new account.'
        );
        return;
      }

      // I-check ang password (exact match)
      if (foundUser.password !== passClean) {
        Alert.alert('Sign In Error', 'Incorrect password. Please try again.');
        return;
      }

      // Pag tama lahat, papasukin sa main app
      onSignIn();
    } catch (e) {
      Alert.alert('Error', 'An error occurred while signing in.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email or Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email or full name"
            placeholderTextColor="#64748B"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              placeholderTextColor="#64748B"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotBtn} onPress={onNavigateToForgot}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.signInBtn} onPress={handleLogin}>
          <Text style={styles.signInBtnText}>Sign In</Text>
        </TouchableOpacity>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={onNavigateToRegister}>
            <Text style={styles.createAccountText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logo: { width: 220, height: 220 },
  inputContainer: { gap: 8, marginBottom: 24 },
  label: { color: '#F8FAFC', fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  passwordInput: { flex: 1, color: '#FFFFFF', padding: 12, fontSize: 14 },
  eyeIcon: { paddingHorizontal: 12 },
  forgotBtn: { alignSelf: 'flex-end', marginTop: 4 },
  forgotText: { color: '#3B82F6', fontSize: 13, fontWeight: '500' },
  signInBtn: { backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  signInBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  footerContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerText: { color: '#94A3B8', fontSize: 14 },
  createAccountText: { color: '#3B82F6', fontSize: 14, fontWeight: 'bold' },
});