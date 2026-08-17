import React, { useState } from 'react';
import { router } from 'expo-router';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    // Check if email and password are entered
    if (!email || !password) {
      Alert.alert(
        'Missing Information',
        'Please enter your email and password.'
      );
      return;
    }

    // Go to Dashboard
    router.replace('/dashboard');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* TOP BRANDING */}
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.gloveEmoji}>🥊</Text>
            </View>

            <Text style={styles.appTitle}>BOXING</Text>

            <Text style={styles.appSubtitle}>
              SCORING SYSTEM
            </Text>

            <View style={styles.cornerLine}>
              <View style={styles.redLine} />
              <View style={styles.blueLine} />
            </View>
          </View>

          {/* LOGIN CARD */}
          <View style={styles.card}>
            <Text style={styles.welcome}>
              Welcome Back
            </Text>

            <Text style={styles.description}>
              Sign in to manage matches and scoring
            </Text>

            {/* EMAIL */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                EMAIL / USERNAME
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#777"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* PASSWORD */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                PASSWORD
              </Text>

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  placeholderTextColor="#777"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />

                <Pressable
                  onPress={() =>
                    setShowPassword(!showPassword)
                  }
                  style={styles.showButton}
                >
                  <Text style={styles.showText}>
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* REMEMBER + FORGOT */}
            <View style={styles.optionsRow}>
              <Pressable
                style={styles.rememberContainer}
                onPress={() =>
                  setRememberMe(!rememberMe)
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe &&
                      styles.checkboxActive,
                  ]}
                >
                  {rememberMe && (
                    <Text style={styles.checkmark}>
                      ✓
                    </Text>
                  )}
                </View>

                <Text style={styles.rememberText}>
                  Remember me
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Forgot Password',
                    'Password recovery will be connected later.'
                  )
                }
              >
                <Text style={styles.forgotText}>
                  Forgot password?
                </Text>
              </Pressable>
            </View>

            {/* LOGIN BUTTON */}
            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed &&
                  styles.loginButtonPressed,
              ]}
              onPress={handleLogin}
            >
              <Text style={styles.loginButtonText}>
                LOGIN
              </Text>

              <Text style={styles.arrow}>
                →
              </Text>
            </Pressable>

            {/* ROLE INFORMATION */}
            <View style={styles.roleBox}>
              <Text style={styles.roleTitle}>
                AUTHORIZED ACCESS
              </Text>

              <Text style={styles.roleText}>
                Admin • Judge
              </Text>
            </View>
          </View>

          {/* FOOTER */}
          <Text style={styles.footer}>
            Tournament Management & Scoring Platform
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },

  container: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: 'center',
  },

  /* BRANDING */

  brandSection: {
    alignItems: 'center',
    marginBottom: 28,
  },

  logoCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#30353D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  gloveEmoji: {
    fontSize: 42,
  },

  appTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3,
  },

  appSubtitle: {
    color: '#AEB4BD',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 4,
    marginTop: 4,
  },

  cornerLine: {
    flexDirection: 'row',
    width: 100,
    height: 3,
    marginTop: 16,
  },

  redLine: {
    flex: 1,
    backgroundColor: '#E53935',
  },

  blueLine: {
    flex: 1,
    backgroundColor: '#1976D2',
  },

  /* LOGIN CARD */

  card: {
    backgroundColor: '#15191F',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: '#282D35',
  },

  welcome: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 6,
  },

  description: {
    color: '#8F969F',
    fontSize: 13,
    marginBottom: 26,
  },

  inputGroup: {
    marginBottom: 18,
  },

  label: {
    color: '#AEB4BD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },

  input: {
    height: 52,
    backgroundColor: '#0D1014',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C323A',
    paddingHorizontal: 15,
    color: '#FFFFFF',
    fontSize: 15,
  },

  /* PASSWORD */

  passwordContainer: {
    height: 52,
    backgroundColor: '#0D1014',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C323A',
    flexDirection: 'row',
    alignItems: 'center',
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 15,
    color: '#FFFFFF',
    fontSize: 15,
  },

  showButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  showText: {
    color: '#E53935',
    fontSize: 10,
    fontWeight: '900',
  },

  /* OPTIONS */

  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },

  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#555C66',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  checkboxActive: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },

  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  rememberText: {
    color: '#9EA5AE',
    fontSize: 12,
  },

  forgotText: {
    color: '#E53935',
    fontSize: 12,
    fontWeight: '700',
  },

  /* LOGIN BUTTON */

  loginButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  loginButtonPressed: {
    opacity: 0.75,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 22,
    marginLeft: 12,
    marginTop: -2,
  },

  /* ROLE */

  roleBox: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#101318',
    alignItems: 'center',
  },

  roleTitle: {
    color: '#6F7782',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  roleText: {
    color: '#C7CBD1',
    fontSize: 12,
    marginTop: 4,
  },

  /* FOOTER */

  footer: {
    color: '#555C65',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 20,
  },
});