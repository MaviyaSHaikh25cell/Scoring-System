import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CURRENT_ROLE_KEY = '@boxing_current_role';

type UserRole = 'ADMIN' | 'JUDGE' | 'BOXER';

export default function SettingsScreen() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);

  const loadRole = useCallback(async () => {
    try {
      const storedRole = await AsyncStorage.getItem(CURRENT_ROLE_KEY);
      if (storedRole === 'ADMIN' || storedRole === 'JUDGE' || storedRole === 'BOXER') {
        setRole(storedRole);
      }
    } catch (error) {
      console.log('Settings role loading error:', error);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadRole(); }, [loadRole]));

  const isAdmin = role === 'ADMIN';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>
          <View>
            <Text style={styles.title}>SETTINGS</Text>
            <Text style={styles.subtitle}>Manage app preferences</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>APP PREFERENCES</Text>

          <SettingRow
            title="Round Sound"
            description="Play a sound when a round starts or ends."
            value={sound}
            onChange={setSound}
          />
          <SettingRow
            title="Vibration"
            description="Use vibration for important scoring actions."
            value={vibration}
            onChange={setVibration}
          />
          {isAdmin && (
            <Text style={styles.sectionTitle}>MANAGEMENT</Text>
          )}

          {isAdmin && (
            <>
              <MenuRow title="Judge Management" subtitle="Add and manage judges" onPress={() => router.push('/judge-management')} />
              <MenuRow title="Tournament Management" subtitle="Manage tournaments and bouts" onPress={() => router.push('/tournament-management')} />
              <MenuRow title="Match Review" subtitle="Verify judge scores and results" onPress={() => router.push('/admin-match-review')} />
            </>
          )}

          <MenuRow title="Match History" subtitle="View completed matches" onPress={() => router.push('/history')} />
          {role === 'BOXER' && (
            <MenuRow title="Boxer Profile" subtitle="View official boxer information" onPress={() => router.push('/boxer-profile')} />
          )}
          {role === 'JUDGE' && (
            <MenuRow title="Judge Dashboard" subtitle="View assigned matches" onPress={() => router.push('/judge-dashboard')} />
          )}

          <Text style={styles.sectionTitle}>APP</Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>BOXING SCORING SYSTEM</Text>
            <Text style={styles.infoText}>Version 1.0.0</Text>
            <Text style={styles.infoText}>Tournament scoring and application preferences.</Text>
          </View>

          <Pressable
            onPress={() =>
              Alert.alert('RESET SETTINGS', 'Reset all preferences to their default values?', [
                { text: 'CANCEL', style: 'cancel' },
                {
                  text: 'RESET',
                  onPress: () => {
                    setSound(true);
                    setVibration(true);
                  },
                },
              ])
            }
            style={styles.resetButton}
          >
            <Text style={styles.resetText}>RESET SETTINGS</Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function SettingRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#2a2a2a', true: '#7f2525' }}
        thumbColor={value ? '#E53935' : '#888'}
      />
    </View>
  );
}

function MenuRow({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
      <View style={styles.menuText}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.description}>{subtitle}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#080808' },
  container: { flex: 1, backgroundColor: '#080808' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingTop: 18, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1d1d1d',
  },
  backButton: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#151515',
    borderWidth: 1, borderColor: '#252525', alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  backIcon: { color: '#fff', fontSize: 35, lineHeight: 38, fontWeight: '300', marginTop: -3 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#777', fontSize: 11, marginTop: 4 },
  content: { padding: 20, paddingBottom: 40 },
  sectionTitle: {
    color: '#777', fontSize: 10, fontWeight: '900', letterSpacing: 1.2,
    marginTop: 10, marginBottom: 10,
  },
  settingRow: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#242424',
    borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 9,
  },
  settingText: { flex: 1, paddingRight: 15 },
  settingTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  description: { color: '#666', fontSize: 9, lineHeight: 14, marginTop: 4 },
  menuRow: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#242424',
    borderRadius: 14, padding: 15, flexDirection: 'row', alignItems: 'center', marginBottom: 9,
  },
  menuText: { flex: 1 },
  menuTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  arrow: { color: '#aaa', fontSize: 27, fontWeight: '300' },
  infoCard: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#242424',
    borderRadius: 14, padding: 16, marginBottom: 15,
  },
  infoTitle: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 },
  infoText: { color: '#666', fontSize: 9, marginTop: 3 },
  resetButton: {
    height: 48, borderRadius: 11, borderWidth: 1, borderColor: '#4b2222',
    backgroundColor: '#241313', alignItems: 'center', justifyContent: 'center',
  },
  resetText: { color: '#ff6464', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  pressed: { opacity: 0.7 },
});
