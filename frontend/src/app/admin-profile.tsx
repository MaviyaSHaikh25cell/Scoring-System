import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOXERS_KEY = '@boxing_system_boxers';
const MATCH_HISTORY_KEY = '@boxing_scoring_match_history';

export default function AdminProfileScreen() {
  const [boxerCount, setBoxerCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  const loadAdminStats = useCallback(async () => {
    try {
      const boxersStored = await AsyncStorage.getItem(BOXERS_KEY);
      const matchesStored = await AsyncStorage.getItem(
        MATCH_HISTORY_KEY,
      );

      if (boxersStored) {
        const boxers = JSON.parse(boxersStored);

        if (Array.isArray(boxers)) {
          setBoxerCount(boxers.length);
        }
      }

      if (matchesStored) {
        const matches = JSON.parse(matchesStored);

        if (Array.isArray(matches)) {
          setMatchCount(matches.length);
        }
      }
    } catch (error) {
      console.log('Error loading admin statistics:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAdminStats();
    }, [loadAdminStats]),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>
              ADMIN PROFILE
            </Text>

            <Text style={styles.headerSubtitle}>
              Administrator account and system information
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* PROFILE CARD */}
          <View style={styles.profileCard}>
            <View style={styles.profileTop}>
              <View style={styles.profileAvatar}>
                <Text style={styles.avatarText}>AD</Text>
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  SYSTEM ADMIN
                </Text>

                <Text style={styles.profileId}>
                  ADMIN ID • ADM001
                </Text>

                <View style={styles.statusRow}>
                  <View style={styles.statusDot} />

                  <Text style={styles.statusText}>
                    ACTIVE
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.profileDivider} />

            <View style={styles.roleBox}>
              <Text style={styles.roleLabel}>
                ACCOUNT ROLE
              </Text>

              <Text style={styles.roleValue}>
                SYSTEM ADMINISTRATOR
              </Text>

              <Text style={styles.roleDescription}>
                Full access to boxer registration, judge management,
                tournament management, match management and system
                settings.
              </Text>
            </View>
          </View>

          {/* SYSTEM OVERVIEW */}
          <Text style={styles.sectionTitle}>
            SYSTEM OVERVIEW
          </Text>

          <View style={styles.statsContainer}>
            <StatCard
              value={boxerCount}
              label="REGISTERED BOXERS"
            />

            <StatCard
              value={matchCount}
              label="TOTAL MATCHES"
            />

            <StatCard
              value={1}
              label="ADMIN ACCOUNT"
            />
          </View>

          {/* ADMIN ACCESS */}
          <Text style={styles.sectionTitle}>
            ADMIN ACCESS
          </Text>

          <View style={styles.accessCard}>
            <AccessRow
              title="BOXER MANAGEMENT"
              description="Register and manage official boxer information."
              onPress={() => router.push('/boxer-management')}
            />

            <AccessRow
              title="JUDGE MANAGEMENT"
              description="Manage registered judges and their access."
              onPress={() => router.push('/judge-management')}
            />

            <AccessRow
              title="TOURNAMENT MANAGEMENT"
              description="Create tournaments, import boxer lists and manage tournament brackets."
              onPress={() =>
                router.push('/tournament-management')
              }
            />

            <AccessRow
              title="MATCH MANAGEMENT"
              description="Create, manage and monitor individual boxing matches."
              onPress={() => router.push('/create-match')}
            />

            <AccessRow
              title="SYSTEM SETTINGS"
              description="Configure application and scoring settings."
              onPress={() => router.push('/settings')}
              last
            />
          </View>

          {/* SECURITY */}
          <View style={styles.securityCard}>
            <Text style={styles.securityTitle}>
              ADMIN CONTROL
            </Text>

            <Text style={styles.securityText}>
              Official boxer information is controlled by the
              administrator. Registered boxers cannot directly change
              their official records.
            </Text>
          </View>

          {/* ACCOUNT STATUS */}
          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>
              ACCOUNT STATUS
            </Text>

            <View style={styles.footerStatusRow}>
              <View style={styles.largeStatusDot} />

              <Text style={styles.footerStatusText}>
                ADMIN ACCOUNT ACTIVE
              </Text>
            </View>

            <Text style={styles.footerDescription}>
              This account has administrator-level access to the
              Boxing Scoring System.
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* STAT CARD */

function StatCard({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statNumber}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

/* ACCESS ROW */

function AccessRow({
  title,
  description,
  onPress,
  last,
}: {
  title: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.accessRow,
        !last && styles.accessRowBorder,
        pressed && styles.accessRowPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.accessIndicator} />

      <View style={styles.accessContent}>
        <Text style={styles.accessTitle}>
          {title}
        </Text>

        <Text style={styles.accessDescription}>
          {description}
        </Text>
      </View>

      <Text style={styles.accessArrow}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080808',
  },

  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D1D',
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#282828',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  backIcon: {
    color: '#FFFFFF',
    fontSize: 35,
    lineHeight: 38,
    fontWeight: '300',
    marginTop: -3,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 1,
  },

  headerSubtitle: {
    color: '#707070',
    fontSize: 10,
    marginTop: 4,
  },

  /* SCROLL */

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  /* PROFILE */

  profileCard: {
    backgroundColor: '#111111',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#252525',
    padding: 18,
    marginBottom: 25,
  },

  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  profileAvatar: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#353535',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },

  profileInfo: {
    flex: 1,
  },

  profileName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  profileId: {
    color: '#666666',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 5,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#55D88A',
    marginRight: 6,
  },

  statusText: {
    color: '#55D88A',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },

  profileDivider: {
    height: 1,
    backgroundColor: '#222222',
    marginVertical: 18,
  },

  roleBox: {
    backgroundColor: '#151515',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#292929',
    padding: 14,
  },

  roleLabel: {
    color: '#606060',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },

  roleValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  roleDescription: {
    color: '#686868',
    fontSize: 9,
    lineHeight: 15,
    marginTop: 6,
  },

  /* SECTIONS */

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },

  /* STATS */

  statsContainer: {
    flexDirection: 'row',
    marginBottom: 25,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242424',
    paddingVertical: 17,
    alignItems: 'center',
    marginHorizontal: 4,
  },

  statNumber: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
  },

  statLabel: {
    color: '#606060',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 6,
  },

  /* ACCESS */

  accessCard: {
    backgroundColor: '#111111',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#242424',
    paddingHorizontal: 16,
    marginBottom: 25,
  },

  accessRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
  },

  accessRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },

  accessRowPressed: {
    opacity: 0.65,
  },

  accessIndicator: {
    width: 4,
    height: 28,
    borderRadius: 3,
    backgroundColor: '#E53935',
    marginRight: 13,
  },

  accessContent: {
    flex: 1,
  },

  accessTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  accessDescription: {
    color: '#666666',
    fontSize: 8,
    lineHeight: 13,
    marginTop: 4,
  },

  accessArrow: {
    color: '#666666',
    fontSize: 25,
    fontWeight: '300',
    marginLeft: 8,
  },

  /* SECURITY */

  securityCard: {
    backgroundColor: '#111111',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 16,
    marginBottom: 25,
  },

  securityTitle: {
    color: '#E53935',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 7,
  },

  securityText: {
    color: '#666666',
    fontSize: 9,
    lineHeight: 15,
  },

  /* FOOTER */

  footerCard: {
    backgroundColor: '#101010',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 16,
  },

  footerTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },

  footerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  largeStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#55D88A',
    marginRight: 7,
  },

  footerStatusText: {
    color: '#55D88A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  footerDescription: {
    color: '#5D5D5D',
    fontSize: 10,
    lineHeight: 16,
  },
});