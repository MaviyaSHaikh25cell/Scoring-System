import { API_BASE_URL } from '../constants/api';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserRole = 'ADMIN' | 'JUDGE' | 'BOXER';

type Judge = {
  id: string;
  name: string;
  email: string;
  matches: number;
  status: 'ACTIVE' | 'INACTIVE';
};

type BackendLoginResponse = {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    role: UserRole;
    boxerId: string | null;
    judgeId: string | null;
    judgeDbId?: string | null;
    name: string;
  };
};



const JUDGES_STORAGE_KEY = '@boxing_system_judges';
const CURRENT_JUDGE_KEY = '@boxing_current_judge';
const CURRENT_ROLE_KEY = '@boxing_current_role';

const AUTH_TOKEN_KEY = '@boxing_auth_token';
const CURRENT_USER_KEY = '@boxing_current_user';
const REMEMBER_ME_KEY = '@boxing_remember_me';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] =
    useState<UserRole>('ADMIN');

  const handleLogin = async () => {
    const enteredEmail = email.trim().toLowerCase();
    const enteredPassword = password.trim();

    if (!enteredEmail || !enteredPassword) {
      Alert.alert(
        'Missing Information',
        'Please enter your email and password.',
      );
      return;
    }

    /* ADMIN */
    if (selectedRole === 'ADMIN') {
      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: enteredEmail,
              password: enteredPassword,
            }),
          },
        );

        let data: BackendLoginResponse;

        try {
          data =
            (await response.json()) as BackendLoginResponse;
        } catch {
          Alert.alert(
            'LOGIN ERROR',
            'The server returned an invalid response.',
          );
          return;
        }

        if (
          !response.ok ||
          !data.success ||
          !data.token ||
          !data.user
        ) {
          Alert.alert(
            'LOGIN FAILED',
            data.message ||
              'Invalid email or password.',
          );
          return;
        }

        if (data.user.role !== 'ADMIN') {
          Alert.alert(
            'ACCESS DENIED',
            'This account is not authorized for Admin access.',
          );
          return;
        }

        await AsyncStorage.setItem(
          AUTH_TOKEN_KEY,
          data.token,
        );

        await AsyncStorage.setItem(
          CURRENT_USER_KEY,
          JSON.stringify(data.user),
        );

        await AsyncStorage.setItem(
          CURRENT_ROLE_KEY,
          'ADMIN',
        );

        if (rememberMe) {
          await AsyncStorage.setItem(
            REMEMBER_ME_KEY,
            'true',
          );
        } else {
          await AsyncStorage.removeItem(
            REMEMBER_ME_KEY,
          );
        }

        router.replace('/dashboard');
        return;
      } catch (error) {
        console.log(
          'Admin login error:',
          error,
        );

        Alert.alert(
          'SERVER CONNECTION ERROR',
          'Unable to connect to the Boxing Scoring System server. Make sure the backend is running and your iPhone is connected to the same Wi-Fi network as the computer.',
        );

        return;
      }
    }

    /* JUDGE */
    if (selectedRole === 'JUDGE') {
      try {
        const response = await fetch(
          `${API_BASE_URL}/auth/login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: enteredEmail,
              password: enteredPassword,
            }),
          },
        );

        let data: BackendLoginResponse;

        try {
          data = (await response.json()) as BackendLoginResponse;
        } catch {
          Alert.alert(
            'LOGIN ERROR',
            'The server returned an invalid response.',
          );
          return;
        }

        if (
          !response.ok ||
          !data.success ||
          !data.token ||
          !data.user
        ) {
          Alert.alert(
            'LOGIN FAILED',
            data.message || 'Invalid email or password.',
          );
          return;
        }

        if (data.user.role !== 'JUDGE') {
          Alert.alert(
            'ACCESS DENIED',
            'This account is not authorized for Judge access.',
          );
          return;
        }

        if (!data.user.judgeId || !data.user.judgeDbId) {
          Alert.alert(
            'JUDGE PROFILE ERROR',
            'This user account is not linked to a judge profile. Please ask the administrator to run the judge seed or repair the judge account.',
          );
          return;
        }

        /*
         * Store the real PostgreSQL Judge ID, not the display
         * code such as JG001. The scoring API uses this database
         * relationship to identify the logged-in judge.
         */
        await AsyncStorage.setItem(
          AUTH_TOKEN_KEY,
          data.token,
        );

        await AsyncStorage.setItem(
          CURRENT_USER_KEY,
          JSON.stringify(data.user),
        );

        await AsyncStorage.setItem(
          CURRENT_ROLE_KEY,
          'JUDGE',
        );

        await AsyncStorage.setItem(
          CURRENT_JUDGE_KEY,
          JSON.stringify({
            id: data.user.judgeDbId,
            judgeId: data.user.judgeId,
            name: data.user.name,
            email: data.user.email,
          }),
        );

        if (rememberMe) {
          await AsyncStorage.setItem(
            REMEMBER_ME_KEY,
            'true',
          );
        } else {
          await AsyncStorage.removeItem(
            REMEMBER_ME_KEY,
          );
        }

        router.replace('/judge-dashboard');
        return;
      } catch (error) {
        console.log('Judge login error:', error);

        Alert.alert(
          'SERVER CONNECTION ERROR',
          'Unable to connect to the Boxing Scoring System server. Make sure the backend is running and your device is connected to the same Wi-Fi network as the computer.',
        );

        return;
      }
    }

    /* BOXER */
    if (selectedRole === 'BOXER') {
      await AsyncStorage.setItem(
        CURRENT_ROLE_KEY,
        'BOXER',
      );

      router.replace('/boxer-dashboard');
      return;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* TOP BRANDING */}
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.gloveEmoji}>
                🥊
              </Text>
            </View>

            <Text style={styles.appTitle}>
              BOXING
            </Text>

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
              Secure access to tournament management & scoring
            </Text>

            {/* ROLE SELECTOR */}
            <View style={styles.roleSection}>
              <Text style={styles.label}>
                LOGIN AS
              </Text>

              <View
                style={styles.roleSelector}
              >
                {/* ADMIN */}
                <Pressable
                  style={[
                    styles.roleButton,
                    selectedRole === 'ADMIN' &&
                      styles.roleButtonActive,
                    selectedRole === 'ADMIN' &&
                      styles.adminRoleActive,
                  ]}
                  onPress={() =>
                    setSelectedRole(
                      'ADMIN',
                    )
                  }
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      selectedRole === 'ADMIN' &&
                        styles.roleButtonTextActive,
                    ]}
                  >
                    ADMIN
                  </Text>
                </Pressable>

                {/* JUDGE */}
                <Pressable
                  style={[
                    styles.roleButton,
                    selectedRole === 'JUDGE' &&
                      styles.roleButtonActive,
                    selectedRole === 'JUDGE' &&
                      styles.judgeRoleActive,
                  ]}
                  onPress={() =>
                    setSelectedRole(
                      'JUDGE',
                    )
                  }
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      selectedRole === 'JUDGE' &&
                        styles.roleButtonTextActive,
                    ]}
                  >
                    JUDGE
                  </Text>
                </Pressable>

                {/* BOXER */}
                <Pressable
                  style={[
                    styles.roleButton,
                    selectedRole === 'BOXER' &&
                      styles.roleButtonActive,
                    selectedRole === 'BOXER' &&
                      styles.boxerRoleActive,
                  ]}
                  onPress={() =>
                    setSelectedRole(
                      'BOXER',
                    )
                  }
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      selectedRole === 'BOXER' &&
                        styles.roleButtonTextActive,
                    ]}
                  >
                    BOXER
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* EMAIL */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                EMAIL ADDRESS
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#777"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            {/* PASSWORD */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                PASSWORD
              </Text>

              <View
                style={
                  styles.passwordContainer
                }
              >
                <TextInput
                  style={
                    styles.passwordInput
                  }
                  placeholder="Enter your password"
                  placeholderTextColor="#777"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={
                    !showPassword
                  }
                />

                <Pressable
                  onPress={() =>
                    setShowPassword(
                      !showPassword,
                    )
                  }
                  style={
                    styles.showButton
                  }
                >
                  <Text
                    style={styles.showText}
                  >
                    {showPassword
                      ? 'HIDE'
                      : 'SHOW'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* REMEMBER + FORGOT */}
            <View
              style={styles.optionsRow}
            >
              <Pressable
                style={
                  styles.rememberContainer
                }
                onPress={() =>
                  setRememberMe(
                    !rememberMe,
                  )
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
                    <Text
                      style={
                        styles.checkmark
                      }
                    >
                      ✓
                    </Text>
                  )}
                </View>

                <Text
                  style={
                    styles.rememberText
                  }
                >
                  Remember me
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  Alert.alert(
                    'Forgot Password',
                    'Password recovery will be connected later.',
                  )
                }
              >
                <Text
                  style={
                    styles.forgotText
                  }
                >
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
              <Text
                style={
                  styles.loginButtonText
                }
              >
                LOGIN AS {selectedRole}
              </Text>

              <Text style={styles.arrow}>
                →
              </Text>
            </Pressable>

            {/* ROLE INFORMATION */}
            <View style={styles.roleBox}>
              <Text
                style={styles.roleTitle}
              >
                AUTHORIZED ACCESS
              </Text>

              <Text
                style={styles.roleText}
              >
                Admin • Judge • Boxer
              </Text>
            </View>
          </View>

          {/* FOOTER */}
          <Text style={styles.footer}>
            Tournament Management  •  Scoring Platform
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080A0D',
  },

  container: {
    flex: 1,
    backgroundColor: '#080A0D',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    justifyContent: 'center',
  },

  /* BRANDING */

  brandSection: {
    alignItems: 'center',
    marginBottom: 24,
  },

  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#11151A',
    borderWidth: 1,
    borderColor: '#303740',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  gloveEmoji: {
    fontSize: 39,
  },

  appTitle: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 3.5,
  },

  appSubtitle: {
    color: '#9CA4AE',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3.2,
    marginTop: 5,
  },

  cornerLine: {
    flexDirection: 'row',
    width: 92,
    height: 3,
    marginTop: 14,
    borderRadius: 2,
    overflow: 'hidden',
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
    backgroundColor: '#12161B',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 21,
    paddingBottom: 19,
    borderWidth: 1,
    borderColor: '#272D35',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },

  welcome: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 5,
  },

  description: {
    color: '#8F98A3',
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 20,
  },

  /* ROLE SELECTOR */

  roleSection: {
    marginBottom: 18,
  },

  roleSelector: {
    flexDirection: 'row',
    backgroundColor: '#0A0D11',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2B323B',
    padding: 4,
  },

  roleButton: {
    flex: 1,
    height: 43,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleButtonActive: {
    backgroundColor: '#E53935',
    shadowColor: '#E53935',
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },

  adminRoleActive: {
    backgroundColor: '#E53935',
  },

  judgeRoleActive: {
    backgroundColor: '#1976D2',
  },

  boxerRoleActive: {
    backgroundColor: '#43A047',
  },

  roleButtonText: {
    color: '#6F7781',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },

  roleButtonTextActive: {
    color: '#FFFFFF',
  },

  /* INPUTS */

  inputGroup: {
    marginBottom: 16,
  },

  label: {
    color: '#AAB2BC',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 1.15,
    marginBottom: 7,
  },

  input: {
    height: 51,
    backgroundColor: '#0A0D11',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2B323B',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14.5,
  },

  /* PASSWORD */

  passwordContainer: {
    height: 51,
    backgroundColor: '#0A0D11',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2B323B',
    flexDirection: 'row',
    alignItems: 'center',
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14.5,
  },

  showButton: {
    minWidth: 58,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  showText: {
    color: '#E53935',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  /* OPTIONS */

  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 21,
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
    borderColor: '#555E68',
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
    color: '#969EA8',
    fontSize: 12,
  },

  forgotText: {
    color: '#E53935',
    fontSize: 12,
    fontWeight: '800',
  },

  /* LOGIN BUTTON */

  loginButton: {
    height: 55,
    borderRadius: 12,
    backgroundColor: '#D93632',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E53935',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },

  loginButtonPressed: {
    opacity: 0.78,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 21,
    marginLeft: 11,
    marginTop: -2,
    fontWeight: '600',
  },

  /* ROLE INFORMATION */

  roleBox: {
    marginTop: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: '#0D1014',
    borderWidth: 1,
    borderColor: '#20262D',
    alignItems: 'center',
  },

  roleTitle: {
    color: '#68717C',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.6,
  },

  roleText: {
    color: '#C5CAD1',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 4,
  },

  /* FOOTER */

  footer: {
    color: '#505862',
    fontSize: 9.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 15,
    letterSpacing: 0.25,
  },
});
