import { API_BASE_URL } from '../constants/api';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MATCHES_STORAGE_KEY = '@boxing_system_assigned_matches';
const CURRENT_JUDGE_KEY = '@boxing_current_judge';
const CURRENT_USER_KEY = '@boxing_current_user';
const CURRENT_ROLE_KEY = '@boxing_current_role';
const AUTH_TOKEN_KEY = '@boxing_auth_token';



type CurrentJudge = {
  id: string;
  judgeId?: string;
  name: string;
  email: string;
};

type AssignedMatch = {
  id: string;
  redBoxer: string;
  blueBoxer: string;
  weightCategory: string;
  rounds: number;
  matchType: string;
  judgeIds: string[];
  judgeNames: string[];

  // Tournament connection
  tournamentId?: string;
  tournamentMatchId?: string;

  // Compatibility with older match data
  judgeId?: string;
  judgeName?: string;

  status: 'UPCOMING' | 'LIVE' | 'COMPLETED';
  date: string;
  time: string;
};

export default function JudgeDashboardScreen() {
  const [matches, setMatches] = useState<AssignedMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentJudge, setCurrentJudge] =
    useState<CurrentJudge | null>(null);

  const loadAssignedMatches = useCallback(async () => {
    try {
      setLoading(true);

      const storedJudge = await AsyncStorage.getItem(
        CURRENT_JUDGE_KEY,
      );

      if (!storedJudge) {
        setCurrentJudge(null);
        setMatches([]);
        return;
      }

      let judge: CurrentJudge;

      try {
        judge = JSON.parse(storedJudge);
      } catch (error) {
        console.log('Error parsing current judge:', error);
        setCurrentJudge(null);
        setMatches([]);
        return;
      }

      if (!judge || !judge.id || !judge.name || !judge.email) {
        setCurrentJudge(null);
        setMatches([]);
        return;
      }

      setCurrentJudge(judge);

      const token = await AsyncStorage.getItem(
        AUTH_TOKEN_KEY,
      );

      if (!token) {
        Alert.alert(
          'LOGIN REQUIRED',
          'Your judge session is not active. Please login again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/'),
            },
          ],
        );
        setMatches([]);
        return;
      }

      /*
       * The backend now returns only matches assigned to the
       * authenticated judge. This removes the old AsyncStorage-only
       * assignment system and keeps the judge dashboard in sync
       * with PostgreSQL.
       */
      const response = await fetch(
        `${API_BASE_URL}/matches`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to load matches (${response.status})`,
        );
      }

      const backendMatches = Array.isArray(data?.matches)
        ? data.matches
        : [];

      const normalizedMatches: AssignedMatch[] =
        backendMatches.map((match: any) => {
          const assignedJudges = Array.isArray(match.judges)
            ? match.judges
            : [];

          return {
            id: String(match.id),
            redBoxer: match.redBoxer?.name || 'Red Boxer',
            blueBoxer: match.blueBoxer?.name || 'Blue Boxer',
            weightCategory: String(
              match.weightCategory || 'UNKNOWN',
            ),
            rounds: Number(match.rounds) || 3,
            matchType: String(match.matchType || 'TOURNAMENT'),
            judgeIds: assignedJudges
              .map((item: any) => item.judge?.id || item.judgeId)
              .filter(Boolean),
            judgeNames: assignedJudges
              .map((item: any) => item.judge?.name)
              .filter(Boolean),
            tournamentId:
              typeof match.tournamentId === 'string'
                ? match.tournamentId
                : undefined,
            tournamentMatchId: undefined,
            status:
              match.status === 'LIVE'
                ? 'LIVE'
                : match.status === 'COMPLETED'
                  ? 'COMPLETED'
                  : 'UPCOMING',
            date: match.createdAt
              ? new Date(match.createdAt).toLocaleDateString()
              : '',
            time: match.createdAt
              ? new Date(match.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '',
          };
        });

      setMatches(normalizedMatches);

      /*
       * Keep a compatibility cache for older screens, but never use
       * it as the source of truth for judge assignments.
       */
      await AsyncStorage.setItem(
        MATCHES_STORAGE_KEY,
        JSON.stringify(normalizedMatches),
      );
    } catch (error) {
      console.log('Error loading assigned matches:', error);

      Alert.alert(
        'ERROR',
        error instanceof Error
          ? error.message
          : 'Unable to load assigned matches.',
        [{ text: 'OK' }],
      );

      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAssignedMatches();
    }, [loadAssignedMatches]),
  );

  const liveMatch = matches.find(
    (match) => match.status === 'LIVE',
  );

  const upcomingMatches = matches.filter(
    (match) => match.status === 'UPCOMING',
  );

  const completedMatches = matches.filter(
    (match) => match.status === 'COMPLETED',
  );

  const openMatch = (match: AssignedMatch) => {
    if (!currentJudge) {
      Alert.alert(
        'LOGIN REQUIRED',
        'Judge information could not be found. Please login again.',
      );
      return;
    }

    router.push({
      pathname: '/live-scoring',
      params: {
        matchId: match.id,
        redBoxer: match.redBoxer,
        blueBoxer: match.blueBoxer,
        weightCategory: match.weightCategory,
        rounds: match.rounds.toString(),
        matchType: match.matchType,
        judgeId: currentJudge.id,
        judgeName: currentJudge.name,

        // Pass tournament information forward
        tournamentId: match.tournamentId || '',
        tournamentMatchId:
          match.tournamentMatchId || '',
      },
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                CURRENT_JUDGE_KEY,
                CURRENT_USER_KEY,
                CURRENT_ROLE_KEY,
                AUTH_TOKEN_KEY,
              ]);
            } catch (error) {
              console.log(
                'Error clearing judge session:',
                error,
              );
            }

            router.replace('/');
          },
        },
      ],
    );
  };

  const renderMatchCard = (
    match: AssignedMatch,
    showAction: boolean = false,
  ) => {
    return (
      <View key={match.id} style={styles.matchCard}>
        <View style={styles.matchTopRow}>
          <View>
            <Text style={styles.matchId}>
              {match.id}
            </Text>

            <Text style={styles.matchDate}>
              {match.date} • {match.time}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              match.status === 'LIVE' &&
                styles.liveBadge,
              match.status === 'UPCOMING' &&
                styles.upcomingBadge,
              match.status === 'COMPLETED' &&
                styles.completedBadge,
            ]}
          >
            <Text style={styles.statusText}>
              {match.status}
            </Text>
          </View>
        </View>

        <View style={styles.boxersContainer}>
          <View style={styles.boxerColumn}>
            <View
              style={[
                styles.cornerBadge,
                styles.redCorner,
              ]}
            >
              <Text style={styles.cornerBadgeText}>
                R
              </Text>
            </View>

            <Text
              style={styles.boxerName}
              numberOfLines={1}
            >
              {match.redBoxer}
            </Text>

            <Text style={styles.cornerLabel}>
              RED CORNER
            </Text>
          </View>

          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <View style={styles.boxerColumn}>
            <View
              style={[
                styles.cornerBadge,
                styles.blueCorner,
              ]}
            >
              <Text style={styles.cornerBadgeText}>
                B
              </Text>
            </View>

            <Text
              style={styles.boxerName}
              numberOfLines={1}
            >
              {match.blueBoxer}
            </Text>

            <Text style={styles.cornerLabel}>
              BLUE CORNER
            </Text>
          </View>
        </View>

        <View style={styles.matchInfoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              WEIGHT
            </Text>

            <Text style={styles.infoValue}>
              {match.weightCategory}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              ROUNDS
            </Text>

            <Text style={styles.infoValue}>
              {match.rounds}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>
              TYPE
            </Text>

            <Text style={styles.infoValue}>
              {match.matchType}
            </Text>
          </View>
        </View>

        <View style={styles.panelContainer}>
          <Text style={styles.panelTitle}>
            JUDGE PANEL
          </Text>

          <Text style={styles.panelText}>
            {match.judgeNames.length > 0
              ? match.judgeNames.join(' • ')
              : 'Judge panel assigned'}
          </Text>
        </View>

        {showAction && (
          <Pressable
            style={({ pressed }) => [
              styles.openButton,
              pressed && styles.pressed,
            ]}
            onPress={() => openMatch(match)}
          >
            <Text style={styles.openButtonText}>
              OPEN LIVE MATCH
            </Text>

            <Text style={styles.openArrow}>
              →
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.headerSmall}>
              TOURNAMENT
            </Text>

            <Text style={styles.headerTitle}>
              Judge Dashboard
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.logoutButton,
              pressed && styles.pressed,
            ]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>
              LOGOUT
            </Text>
          </Pressable>
        </View>

        {/* JUDGE PROFILE */}

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {currentJudge?.name?.charAt(0) || '?'}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileRole}>
              OFFICIAL JUDGE
            </Text>

            <Text style={styles.profileName}>
              {currentJudge?.name || 'Loading...'}
            </Text>

            <Text style={styles.profileEmail}>
              {currentJudge?.email || ''}
            </Text>
          </View>

          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />

            <Text style={styles.activeText}>
              ACTIVE
            </Text>
          </View>
        </View>

        {/* STATS */}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {matches.length}
            </Text>

            <Text style={styles.statLabel}>
              ASSIGNED
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {upcomingMatches.length}
            </Text>

            <Text style={styles.statLabel}>
              UPCOMING
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {completedMatches.length}
            </Text>

            <Text style={styles.statLabel}>
              COMPLETED
            </Text>
          </View>
        </View>

        {/* LIVE MATCH */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            LIVE MATCH
          </Text>

          {liveMatch && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />

              <Text style={styles.liveIndicatorText}>
                LIVE
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator
              size="small"
              color="#E53935"
            />

            <Text style={styles.loadingText}>
              Loading assigned matches...
            </Text>
          </View>
        ) : liveMatch ? (
          renderMatchCard(liveMatch, true)
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                —
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No Live Match
            </Text>

            <Text style={styles.emptyText}>
              You currently have no live match assigned.
            </Text>
          </View>
        )}

        {/* UPCOMING */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            UPCOMING MATCHES
          </Text>

          <Text style={styles.sectionCount}>
            {upcomingMatches.length}
          </Text>
        </View>

        {upcomingMatches.length > 0 ? (
          upcomingMatches.map((match) =>
            renderMatchCard(match),
          )
        ) : (
          <View style={styles.smallEmptyCard}>
            <Text style={styles.smallEmptyText}>
              No upcoming matches assigned.
            </Text>
          </View>
        )}

        {/* COMPLETED */}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            COMPLETED MATCHES
          </Text>

          <Text style={styles.sectionCount}>
            {completedMatches.length}
          </Text>
        </View>

        {completedMatches.length > 0 ? (
          completedMatches
            .slice(0, 5)
            .map((match) =>
              renderMatchCard(match),
            )
        ) : (
          <View style={styles.smallEmptyCard}>
            <Text style={styles.smallEmptyText}>
              No completed matches yet.
            </Text>
          </View>
        )}

        {/* FOOTER */}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Judge ID: {currentJudge?.id || '—'}
          </Text>

          <Text style={styles.footerSubtext}>
            All match assignments are controlled by the
            tournament administrator.
          </Text>
        </View>
      </ScrollView>
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

  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#171B21',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 31,
    marginTop: -3,
  },

  headerInfo: {
    flex: 1,
  },

  headerSmall: {
    color: '#7D858F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },

  logoutButton: {
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#35191B',
    borderWidth: 1,
    borderColor: '#6B282B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  logoutButtonText: {
    color: '#E53935',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  /* PROFILE */

  profileCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#292F37',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },

  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },

  profileRole: {
    color: '#69737E',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  profileName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
  },

  profileEmail: {
    color: '#737B85',
    fontSize: 9,
    marginTop: 3,
  },

  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#102118',
    borderWidth: 1,
    borderColor: '#245A39',
  },

  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
    marginRight: 5,
  },

  activeText: {
    color: '#70C77B',
    fontSize: 7,
    fontWeight: '900',
  },

  /* STATS */

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#15191F',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#292F37',
    paddingVertical: 14,
    alignItems: 'center',
  },

  statNumber: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
  },

  statLabel: {
    color: '#69737E',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 4,
  },

  /* SECTION */

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
    marginTop: 4,
  },

  sectionTitle: {
    color: '#89919B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  sectionCount: {
    color: '#737B85',
    fontSize: 10,
    fontWeight: '900',
  },

  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E53935',
    marginRight: 5,
  },

  liveIndicatorText: {
    color: '#E53935',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  /* MATCH CARD */

  matchCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#292F37',
    padding: 15,
    marginBottom: 12,
  },

  matchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  matchId: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  matchDate: {
    color: '#68717B',
    fontSize: 8,
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },

  liveBadge: {
    backgroundColor: '#35191B',
  },

  upcomingBadge: {
    backgroundColor: '#172331',
  },

  completedBadge: {
    backgroundColor: '#18201B',
  },

  statusText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* BOXERS */

  boxersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 17,
  },

  boxerColumn: {
    flex: 1,
    alignItems: 'center',
  },

  cornerBadge: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },

  redCorner: {
    backgroundColor: '#8F2427',
  },

  blueCorner: {
    backgroundColor: '#15569A',
  },

  cornerBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  boxerName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },

  cornerLabel: {
    color: '#68717B',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  vsCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#30363E',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },

  vsText: {
    color: '#7E8791',
    fontSize: 8,
    fontWeight: '900',
  },

  /* MATCH INFO */

  matchInfoRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#252B32',
    borderBottomWidth: 1,
    borderBottomColor: '#252B32',
    paddingVertical: 11,
  },

  infoItem: {
    flex: 1,
    alignItems: 'center',
  },

  infoLabel: {
    color: '#69737E',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  infoValue: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },

  /* JUDGE PANEL */

  panelContainer: {
    marginTop: 11,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#0E1115',
  },

  panelTitle: {
    color: '#69737E',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.9,
  },

  panelText: {
    color: '#C8CDD2',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
  },

  /* OPEN */

  openButton: {
    height: 48,
    borderRadius: 11,
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  openButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  openArrow: {
    color: '#FFFFFF',
    fontSize: 19,
    marginLeft: 10,
  },

  /* EMPTY */

  loadingCard: {
    backgroundColor: '#15191F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#292F37',
    padding: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  loadingText: {
    color: '#737B85',
    fontSize: 10,
    marginTop: 10,
  },

  emptyCard: {
    backgroundColor: '#15191F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#292F37',
    padding: 25,
    alignItems: 'center',
    marginBottom: 22,
  },

  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1A1F26',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  emptyIconText: {
    color: '#737B85',
    fontSize: 20,
    fontWeight: '900',
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  emptyText: {
    color: '#69737E',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 5,
  },

  smallEmptyCard: {
    backgroundColor: '#15191F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#292F37',
    padding: 17,
    marginBottom: 22,
  },

  smallEmptyText: {
    color: '#69737E',
    fontSize: 9,
    textAlign: 'center',
  },

  /* FOOTER */

  footer: {
    alignItems: 'center',
    marginTop: 4,
  },

  footerText: {
    color: '#555D67',
    fontSize: 8,
    fontWeight: '800',
  },

  footerSubtext: {
    color: '#444B54',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 12,
  },

  /* GENERAL */

  pressed: {
    opacity: 0.7,
  },
});