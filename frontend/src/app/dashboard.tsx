import { API_BASE_URL } from '../constants/api';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getMatchHistory,
  getTournaments,
  SavedMatch,
  TournamentMatch,
  Tournament,
} from '../constants/storage';

const BOXERS_KEY = '@boxing_system_boxers';
const JUDGES_KEY = '@boxing_system_judges';

const AUTH_TOKEN_KEY = '@boxing_auth_token';


type Boxer = {
  id: string;
  name: string;
  dateOfBirth: string;
  weight: string;
  club: string;
  coach: string;
  stance: string;
  status: 'ACTIVE' | 'INACTIVE';
};

type Judge = {
  id: string;
  name: string;
  email: string;
  matches: number;
  status: 'ACTIVE' | 'INACTIVE';
};

type BackendBoxer = {
  id: string;
  boxerId: string;
  name: string;
  dateOfBirth: string;
  weight: number;
  club: string;
  coach: string;
  stance: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
};

type BackendBoxerResponse = {
  success: boolean;
  message?: string;
  boxers?: BackendBoxer[];
};

type BackendMatchBoxer = {
  id: string;
  boxerId: string;
  name: string;
};

type BackendMatchJudge = {
  id: string;
  judgeId: string;
  name: string;
  email: string;
  status: string;
};

type BackendMatchResult = {
  winnerId?: string | null;
  loserId?: string | null;
  redScore?: number | null;
  blueScore?: number | null;
  decision?: string | null;
};

type BackendMatch = {
  id: string;
  tournamentId: string | null;
  redBoxerId: string;
  blueBoxerId: string;
  weightCategory: string;
  rounds: number;
  matchType: string;
  status: string;
  currentRound: number;
  winnerId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;

  redBoxer: BackendMatchBoxer;
  blueBoxer: BackendMatchBoxer;

  judges?: Array<{
    id: string;
    judgeId: string;
    matchId: string;
    judge: BackendMatchJudge;
  }>;

  scores?: unknown[];
  result?: BackendMatchResult | null;
};

type BackendMatchResponse = {
  success: boolean;
  message?: string;
  matches?: BackendMatch[];
};

export default function DashboardScreen() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [history, setHistory] = useState<SavedMatch[]>([]);
  const [boxerCount, setBoxerCount] = useState(0);
  const [activeJudgeCount, setActiveJudgeCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [backendMatches, setBackendMatches] = useState<
    BackendMatch[]
  >([]);

  const [backendMatchesLoaded, setBackendMatchesLoaded] =
    useState(false);

  /*
   * LOAD BOXERS FROM POSTGRESQL
   */
  const loadBackendBoxers = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(
        AUTH_TOKEN_KEY,
      );

      if (!token) {
        console.log(
          'No authentication token found for boxer API.',
        );
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/boxers`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.status === 401) {
        await AsyncStorage.removeItem(
          AUTH_TOKEN_KEY,
        );

        await AsyncStorage.removeItem(
          '@boxing_current_user',
        );

        await AsyncStorage.removeItem(
          '@boxing_current_role',
        );

        Alert.alert(
          'SESSION EXPIRED',
          'Your login session has expired. Please login again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/'),
            },
          ],
        );

        return;
      }

      if (response.status === 403) {
        console.log(
          'User does not have permission to access boxer data.',
        );
        return;
      }

      if (!response.ok) {
        console.log(
          `Boxer API returned status ${response.status}`,
        );
        return;
      }

      const data =
        (await response.json()) as BackendBoxerResponse;

      if (
        !data.success ||
        !Array.isArray(data.boxers)
      ) {
        console.log(
          'Invalid boxer API response:',
          data,
        );
        return;
      }

      setBoxerCount(data.boxers.length);

      const localBoxers: Boxer[] =
        data.boxers.map((boxer) => ({
          id: boxer.boxerId,
          name: boxer.name,
          dateOfBirth: boxer.dateOfBirth,
          weight: `${boxer.weight} KG`,
          club: boxer.club,
          coach: boxer.coach,
          stance: boxer.stance,
          status: boxer.status,
        }));

      await AsyncStorage.setItem(
        BOXERS_KEY,
        JSON.stringify(localBoxers),
      );
    } catch (error) {
      console.log(
        'Backend boxer loading error:',
        error,
      );
    }
  }, []);

  /*
   * LOAD MATCHES FROM POSTGRESQL
   */
  const loadBackendMatches = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(
        AUTH_TOKEN_KEY,
      );

      if (!token) {
        console.log(
          'No authentication token found for match API.',
        );

        setBackendMatchesLoaded(false);
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/matches`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.status === 401) {
        await AsyncStorage.removeItem(
          AUTH_TOKEN_KEY,
        );

        await AsyncStorage.removeItem(
          '@boxing_current_user',
        );

        await AsyncStorage.removeItem(
          '@boxing_current_role',
        );

        Alert.alert(
          'SESSION EXPIRED',
          'Your login session has expired. Please login again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/'),
            },
          ],
        );

        setBackendMatchesLoaded(false);
        return;
      }

      if (response.status === 403) {
        console.log(
          'User does not have permission to access match data.',
        );

        setBackendMatchesLoaded(false);
        return;
      }

      if (!response.ok) {
        console.log(
          `Match API returned status ${response.status}`,
        );

        setBackendMatchesLoaded(false);
        return;
      }

      const data =
        (await response.json()) as BackendMatchResponse;

      if (
        !data.success ||
        !Array.isArray(data.matches)
      ) {
        console.log(
          'Invalid match API response:',
          data,
        );

        setBackendMatchesLoaded(false);
        return;
      }

      setBackendMatches(data.matches);
      setBackendMatchesLoaded(true);

      console.log(
        `Loaded ${data.matches.length} matches from PostgreSQL.`,
      );
    } catch (error) {
      console.log(
        'Backend match loading error:',
        error,
      );

      setBackendMatchesLoaded(false);
    }
  }, []);

  /*
   * LOAD DASHBOARD
   */
  const loadDashboard = useCallback(async () => {
    try {
      const [
        storedTournaments,
        storedHistory,
        storedBoxers,
        storedJudges,
      ] = await Promise.all([
        getTournaments(),
        getMatchHistory(),
        AsyncStorage.getItem(BOXERS_KEY),
        AsyncStorage.getItem(JUDGES_KEY),
      ]);

      setTournaments(storedTournaments);
      setHistory(storedHistory);

      await Promise.all([
        loadBackendBoxers(),
        loadBackendMatches(),
      ]);

      /*
       * LOCAL BOXER FALLBACK
       */
      try {
        const parsedBoxers = storedBoxers
          ? JSON.parse(storedBoxers)
          : [];

        if (
          Array.isArray(parsedBoxers) &&
          parsedBoxers.length > 0
        ) {
          setBoxerCount((currentCount) =>
            currentCount > 0
              ? currentCount
              : parsedBoxers.length,
          );
        }
      } catch {
        // Ignore local boxer parsing errors.
      }

      /*
       * JUDGES
       */
      try {
        const parsedJudges = storedJudges
          ? JSON.parse(storedJudges)
          : [];

        setActiveJudgeCount(
          Array.isArray(parsedJudges)
            ? parsedJudges.filter(
                (judge: Judge) =>
                  judge.status === 'ACTIVE',
              ).length
            : 0,
        );
      } catch {
        setActiveJudgeCount(0);
      }
    } catch (error) {
      console.log(
        'Dashboard loading error:',
        error,
      );
    }
  }, [
    loadBackendBoxers,
    loadBackendMatches,
  ]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  /*
   * PULL TO REFRESH
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadDashboard();
    } finally {
      setRefreshing(false);
    }
  }, [loadDashboard]);

  /*
   * LOCAL TOURNAMENT MATCHES
   */
  const allMatches: TournamentMatch[] =
    tournaments.flatMap((tournament) =>
      tournament.weightCategories.flatMap(
        (category) => category.matches,
      ),
    );

  /*
   * DATABASE LIVE MATCH
   */
  const databaseLiveMatch =
    backendMatches.find(
      (match) => match.status === 'LIVE',
    );

  /*
   * LOCAL LIVE MATCH
   */
  const localLiveMatch =
    allMatches.find(
      (match) =>
        match.status === 'LIVE' &&
        match.scoringMatchId,
    );

  const hasDatabaseMatches =
    backendMatchesLoaded;

  const liveMatch =
    hasDatabaseMatches
      ? databaseLiveMatch
      : localLiveMatch;

  /*
   * DASHBOARD COUNTS
   */
  const upcomingCount =
    hasDatabaseMatches
      ? backendMatches.filter(
          (match) =>
            match.status === 'UPCOMING',
        ).length
      : allMatches.filter(
          (match) =>
            match.status === 'UPCOMING',
        ).length;

  const completedCount =
    hasDatabaseMatches
      ? backendMatches.filter(
          (match) =>
            match.status === 'COMPLETED',
        ).length
      : allMatches.filter(
          (match) =>
            match.status === 'COMPLETED',
        ).length;

  const ongoingCount =
    hasDatabaseMatches
      ? backendMatches.filter(
          (match) =>
            match.status === 'LIVE',
        ).length
      : allMatches.filter(
          (match) =>
            match.status === 'LIVE',
        ).length;

  /*
   * COMPLETED DATABASE MATCHES
   */
  const completedDatabaseMatches =
    backendMatches
      .filter(
        (match) =>
          match.status === 'COMPLETED',
      )
      .sort((a, b) => {
        const dateA = a.completedAt
          ? new Date(a.completedAt).getTime()
          : 0;

        const dateB = b.completedAt
          ? new Date(b.completedAt).getTime()
          : 0;

        return dateB - dateA;
      })
      .slice(0, 4);

  /*
   * LOCAL FALLBACK
   */
  const recentLocalMatches =
    history.slice(0, 4);

  /*
   * OPEN COMPLETED SECTION
   */
  const openCompletedMatches = () => {
    console.log(
      'Opening completed matches. Count:',
      completedCount,
    );

    router.push('/history');
  };

  /*
   * OPEN ONGOING SECTION
   *
   * Opens the live scoring area.
   * If a live match exists, the user can
   * continue it from the live scoring screen.
   */
  const openOngoingMatches = () => {
    console.log(
      'Opening ongoing matches. Count:',
      ongoingCount,
    );

    router.push('/live-scoring');
  };

  /*
   * OPEN UPCOMING SECTION
   *
   * Opens tournament management where
   * upcoming/assigned tournament bouts
   * can be managed.
   */
  const openUpcomingMatches = () => {
    console.log(
      'Opening upcoming matches. Count:',
      upcomingCount,
    );

    router.push('/tournament-management');
  };

  /*
   * OPEN BOXERS SECTION
   */
  const openBoxers = () => {
    console.log(
      'Opening boxer management. Count:',
      boxerCount,
    );

    router.push('/boxer-management');
  };

  /*
   * OPEN LIVE MATCH
   */
  const openLiveMatch = () => {
    /*
     * DATABASE MATCH
     */
    if (
      backendMatchesLoaded &&
      databaseLiveMatch
    ) {
      router.push({
        pathname: '/live-scoring',
        params: {
          matchId: databaseLiveMatch.id,

          tournamentId:
            databaseLiveMatch.tournamentId ??
            '',

          redBoxer:
            databaseLiveMatch.redBoxer?.name ??
            'RED',

          blueBoxer:
            databaseLiveMatch.blueBoxer?.name ??
            'BLUE',

          weightCategory:
            databaseLiveMatch.weightCategory,

          rounds: String(
            databaseLiveMatch.rounds,
          ),

          matchType:
            databaseLiveMatch.matchType,

          isAdmin: 'true',
        },
      });

      return;
    }

    /*
     * LOCAL FALLBACK
     */
    if (!localLiveMatch?.scoringMatchId) {
      router.push('/tournament-management');
      return;
    }

    const tournament = tournaments.find(
      (item) =>
        item.weightCategories.some(
          (category) =>
            category.matches.some(
              (match) =>
                match.id === localLiveMatch.id,
            ),
        ),
    );

    if (!tournament) {
      router.push('/tournament-management');
      return;
    }

    router.push({
      pathname: '/live-scoring',
      params: {
        matchId:
          localLiveMatch.scoringMatchId,

        tournamentId:
          tournament.id,

        tournamentMatchId:
          localLiveMatch.id,

        redBoxer:
          localLiveMatch.redBoxer || '',

        blueBoxer:
          localLiveMatch.blueBoxer || '',

        weightCategory:
          localLiveMatch.weightCategory,

        rounds: String(
          localLiveMatch.rounds,
        ),

        matchType:
          localLiveMatch.matchType,

        isAdmin: 'true',
      },
    });
  };

  /*
   * OPEN COMPLETED DATABASE MATCH
   */
  const openCompletedDatabaseMatch = (
    match: BackendMatch,
  ) => {
    console.log(
      'Opening completed database match:',
      match.id,
    );

    router.push({
      pathname: '/match-summary',
      params: {
        matchId: match.id,

        redBoxer:
          match.redBoxer?.name ??
          'RED BOXER',

        blueBoxer:
          match.blueBoxer?.name ??
          'BLUE BOXER',

        weightCategory:
          match.weightCategory,

        rounds:
          String(match.rounds),

        matchType:
          match.matchType,

        redScore:
          String(
            match.result?.redScore ?? 0,
          ),

        blueScore:
          String(
            match.result?.blueScore ?? 0,
          ),

        tournamentId:
          match.tournamentId ?? '',

        tournamentMatchId:
          match.id,
      },
    });
  };

  /*
   * OPEN LOCAL MATCH
   */
  const openLocalMatch = (
    match: SavedMatch,
  ) => {
    console.log(
      'Opening local match:',
      match.id,
    );

    router.push({
      pathname: '/history',
      params: {
        matchId: match.id,
      },
    });
  };

  /*
   * LOGOUT
   */
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
            await AsyncStorage.removeItem(
              AUTH_TOKEN_KEY,
            );

            await AsyncStorage.removeItem(
              '@boxing_current_user',
            );

            await AsyncStorage.removeItem(
              '@boxing_current_role',
            );

            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E53935"
          />
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              WELCOME BACK
            </Text>

            <Text style={styles.title}>
              Boxing Dashboard
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={({ pressed }) => [
                styles.logoutButton,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={handleLogout}
            >
              <Text style={styles.logoutText}>
                LOGOUT
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.profileCircle,
                pressed &&
                  styles.buttonPressed,
              ]}
              onPress={() =>
                router.push('/admin-profile')
              }
            >
              <Text style={styles.profileText}>
                A
              </Text>
            </Pressable>
          </View>
        </View>

        {/* LIVE MATCH */}

        <View style={styles.liveCard}>
          <View style={styles.liveHeader}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />

              <Text style={styles.liveText}>
                {liveMatch
                  ? 'LIVE NOW'
                  : 'NO LIVE MATCH'}
              </Text>
            </View>

            <Text style={styles.liveRoundText}>
              {liveMatch
                ? `${liveMatch.rounds} ROUNDS`
                : 'READY'}
            </Text>
          </View>

          {liveMatch ? (
            <>
              <Text style={styles.matchTitle}>
                {backendMatchesLoaded &&
                databaseLiveMatch
                  ? `ROUND ${databaseLiveMatch.currentRound} • LIVE MATCH`
                  : `${localLiveMatch?.round ?? ''} • MATCH ${
                      localLiveMatch?.matchNumber ?? ''
                    }`}
              </Text>

              <View style={styles.boxersRow}>
                <View style={styles.boxer}>
                  <View
                    style={[
                      styles.cornerCircle,
                      styles.redCorner,
                    ]}
                  >
                    <Text
                      style={styles.cornerText}
                    >
                      R
                    </Text>
                  </View>

                  <Text
                    style={styles.boxerName}
                  >
                    {backendMatchesLoaded &&
                    databaseLiveMatch
                      ? databaseLiveMatch
                          .redBoxer.name
                      : localLiveMatch?.redBoxer ||
                        'RED'}
                  </Text>
                </View>

                <Text style={styles.vs}>
                  VS
                </Text>

                <View style={styles.boxer}>
                  <View
                    style={[
                      styles.cornerCircle,
                      styles.blueCorner,
                    ]}
                  >
                    <Text
                      style={styles.cornerText}
                    >
                      B
                    </Text>
                  </View>

                  <Text
                    style={styles.boxerName}
                  >
                    {backendMatchesLoaded &&
                    databaseLiveMatch
                      ? databaseLiveMatch
                          .blueBoxer.name
                      : localLiveMatch?.blueBoxer ||
                        'BLUE'}
                  </Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.continueButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={openLiveMatch}
              >
                <Text
                  style={styles.continueText}
                >
                  CONTINUE SCORING →
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.matchTitle}>
                No match is currently live
              </Text>

              <Text
                style={styles.emptyLiveText}
              >
                Start an assigned tournament bout
                to see it here.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.continueButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={() =>
                  router.push(
                    '/tournament-management',
                  )
                }
              >
                <Text
                  style={styles.continueText}
                >
                  OPEN TOURNAMENTS →
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* TOURNAMENT OVERVIEW */}

        <Text style={styles.sectionTitle}>
          TOURNAMENT OVERVIEW
        </Text>

        <View style={styles.statsGrid}>
          {/* ONGOING */}
          <StatCard
            number={String(
              ongoingCount,
            ).padStart(2, '0')}
            label="ONGOING"
            onPress={openOngoingMatches}
          />

          {/* UPCOMING */}
          <StatCard
            number={String(
              upcomingCount,
            ).padStart(2, '0')}
            label="UPCOMING"
            blue
            onPress={openUpcomingMatches}
          />

          {/* COMPLETED */}
          <StatCard
            number={String(
              completedCount,
            ).padStart(2, '0')}
            label="COMPLETED"
            green
            onPress={openCompletedMatches}
          />

          {/* BOXERS */}
          <StatCard
            number={String(
              boxerCount,
            ).padStart(2, '0')}
            label="BOXERS"
            yellow
            onPress={openBoxers}
          />
        </View>

        {/* JUDGES */}

        <View style={styles.infoRow}>
          <View>
            <Text style={styles.infoTitle}>
              JUDGES
            </Text>

            <Text style={styles.infoValue}>
              {activeJudgeCount} Active Judges
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                '/judge-management',
              )
            }
            style={({ pressed }) => [
              styles.viewButton,
              pressed &&
                styles.smallButtonPressed,
            ]}
          >
            <Text
              style={styles.viewButtonText}
            >
              VIEW
            </Text>
          </Pressable>
        </View>

        {/* MATCH REVIEW */}

        <Text style={styles.sectionTitle}>
          MATCH REVIEW
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.reviewCard,
            pressed &&
              styles.cardPressed,
          ]}
          onPress={() =>
            router.push('/admin-match-review')
          }
        >
          <View style={styles.reviewIcon}>
            <Text
              style={styles.reviewIconText}
            >
              ✓
            </Text>
          </View>

          <View style={styles.reviewInfo}>
            <Text style={styles.reviewTitle}>
              ROUND VERIFICATION
            </Text>

            <Text
              style={styles.reviewSubtitle}
            >
              Review judge scores and referee
              events
            </Text>
          </View>

          <View style={styles.reviewArrow}>
            <Text
              style={styles.reviewArrowText}
            >
              →
            </Text>
          </View>
        </Pressable>

        {/* QUICK ACTIONS */}

        <Text style={styles.sectionTitle}>
          QUICK ACTIONS
        </Text>

        <View style={styles.actionsRow}>
          <ActionCard
            icon="+"
            title="CREATE"
            subtitle="New Match"
            onPress={() =>
              router.push('/create-match')
            }
          />

          <ActionCard
            icon="≡"
            title="HISTORY"
            subtitle="View Matches"
            blue
            onPress={() =>
              router.push('/history')
            }
          />
        </View>

        {/* RECENT MATCHES */}

        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>
            RECENT MATCHES
          </Text>

          <Pressable
            onPress={() =>
              router.push('/history')
            }
          >
            <Text style={styles.seeAll}>
              SEE ALL
            </Text>
          </Pressable>
        </View>

        {backendMatchesLoaded &&
        completedDatabaseMatches.length >
          0 ? (
          completedDatabaseMatches.map(
            (match) => (
              <DatabaseRecentMatch
                key={match.id}
                match={match}
                onPress={() =>
                  openCompletedDatabaseMatch(
                    match,
                  )
                }
              />
            ),
          )
        ) : recentLocalMatches.length > 0 ? (
          recentLocalMatches.map(
            (match) => (
              <RecentMatch
                key={match.id}
                match={match}
                onPress={() =>
                  openLocalMatch(match)
                }
              />
            ),
          )
        ) : (
          <View style={styles.emptyRecent}>
            <Text
              style={styles.emptyRecentText}
            >
              No completed matches yet.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAVIGATION */}

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem}>
          <Text
            style={styles.navIconActive}
          >
            ⌂
          </Text>

          <Text
            style={styles.navTextActive}
          >
            Home
          </Text>
        </Pressable>

        <Pressable
          style={styles.navItem}
          onPress={() =>
            router.push('/settings')
          }
        >
          <Text style={styles.navIcon}>
            ⚙
          </Text>

          <Text style={styles.navText}>
            Settings
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/*
 * DATABASE RECENT MATCH
 */

function DatabaseRecentMatch({
  match,
  onPress,
}: {
  match: BackendMatch;
  onPress: () => void;
}) {
  const winnerIsBlue =
    match.result?.winnerId ===
    match.blueBoxerId;

  const winnerIsRed =
    match.result?.winnerId ===
    match.redBoxerId;

  const isDraw =
    !match.result?.winnerId ||
    match.result?.decision === 'DRAW';

  const corner =
    winnerIsBlue
      ? 'B'
      : winnerIsRed
        ? 'R'
        : 'D';

  const blue =
    winnerIsBlue;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.matchItem,
        pressed &&
          styles.buttonPressed,
      ]}
      onPress={onPress}
      android_ripple={{
        color: '#252B32',
      }}
    >
      <View
        style={[
          styles.smallCorner,
          blue
            ? styles.blueCorner
            : styles.redCorner,
        ]}
      >
        <Text
          style={styles.smallCornerText}
        >
          {corner}
        </Text>
      </View>

      <View style={styles.matchInfo}>
        <Text style={styles.matchNames}>
          {match.redBoxer.name} vs{' '}
          {match.blueBoxer.name}
        </Text>

        <Text
          style={styles.matchDetails}
        >
          {match.weightCategory} •{' '}
          {match.matchType}
        </Text>
      </View>

      <View
        style={
          blue
            ? styles.winBadgeBlue
            : styles.winBadge
        }
      >
        <Text style={styles.winText}>
          {isDraw
            ? 'DRAW'
            : `${
                corner === 'R'
                  ? 'RED'
                  : 'BLUE'
              } WIN`}
        </Text>
      </View>
    </Pressable>
  );
}

/*
 * LOCAL RECENT MATCH
 */

function RecentMatch({
  match,
  onPress,
}: {
  match: SavedMatch;
  onPress: () => void;
}) {
  const blue =
    match.result === 'LOST' ||
    (match.result === 'WON' &&
      match.winner === match.blueBoxer);

  const corner =
    match.winner === match.blueBoxer
      ? 'B'
      : match.winner === match.redBoxer
        ? 'R'
        : 'D';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.matchItem,
        pressed &&
          styles.buttonPressed,
      ]}
      onPress={onPress}
      android_ripple={{
        color: '#252B32',
      }}
    >
      <View
        style={[
          styles.smallCorner,
          blue
            ? styles.blueCorner
            : styles.redCorner,
        ]}
      >
        <Text
          style={styles.smallCornerText}
        >
          {corner}
        </Text>
      </View>

      <View style={styles.matchInfo}>
        <Text style={styles.matchNames}>
          {match.redBoxer} vs{' '}
          {match.blueBoxer}
        </Text>

        <Text
          style={styles.matchDetails}
        >
          {match.weightCategory} •{' '}
          {match.matchType}
        </Text>
      </View>

      <View
        style={
          blue
            ? styles.winBadgeBlue
            : styles.winBadge
        }
      >
        <Text style={styles.winText}>
          {match.result === 'DRAW'
            ? 'DRAW'
            : `${
                corner === 'R'
                  ? 'RED'
                  : 'BLUE'
              } WIN`}
        </Text>
      </View>
    </Pressable>
  );
}

/*
 * STAT CARD
 *
 * Every dashboard stat card can now be
 * opened by tapping anywhere on the card.
 */

function StatCard({
  number,
  label,
  blue,
  green,
  yellow,
  onPress,
}: {
  number: string;
  label: string;
  blue?: boolean;
  green?: boolean;
  yellow?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.statNumber}>
        {number}
      </Text>

      <Text style={styles.statLabel}>
        {label}
      </Text>

      <View
        style={[
          styles.statIndicator,
          blue &&
            styles.statIndicatorBlue,
          green &&
            styles.statIndicatorGreen,
          yellow &&
            styles.statIndicatorYellow,
        ]}
      />

      {onPress && (
        <Text style={styles.statTapHint}>
          TAP TO OPEN
        </Text>
      )}
    </>
  );

  /*
   * CLICKABLE CARD
   */
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.statCard,
          pressed &&
            styles.cardPressed,
        ]}
        onPress={onPress}
        android_ripple={{
          color: '#252B32',
        }}
      >
        {content}
      </Pressable>
    );
  }

  /*
   * NORMAL CARD
   */
  return (
    <View style={styles.statCard}>
      {content}
    </View>
  );
}

/*
 * ACTION CARD
 */

function ActionCard({
  icon,
  title,
  subtitle,
  blue,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  blue?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionCard,
        pressed &&
          styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View
        style={
          blue
            ? styles.actionIconBlue
            : styles.actionIcon
        }
      >
        <Text
          style={styles.actionIconText}
        >
          {icon}
        </Text>
      </View>

      <Text style={styles.actionTitle}>
        {title}
      </Text>

      <Text style={styles.actionSubtitle}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

/*
 * STYLES
 */

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
    paddingTop: 18,
    paddingBottom: 100,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },

  greeting: {
    color: '#7F8791',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  title: {
    color: '#FFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 4,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoutButton: {
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#35191B',
    borderWidth: 1,
    borderColor: '#6B282B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  logoutText: {
    color: '#E53935',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  profileCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '900',
  },

  buttonPressed: {
    opacity: 0.7,
  },

  liveCard: {
    backgroundColor: '#171B21',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#292F37',
    marginBottom: 26,
  },

  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#291719',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E53935',
    marginRight: 6,
  },

  liveText: {
    color: '#F45B5B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  liveRoundText: {
    color: '#737B85',
    fontSize: 10,
    fontWeight: '800',
  },

  matchTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
  },

  emptyLiveText: {
    color: '#737B85',
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 18,
  },

  boxersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 20,
  },

  boxer: {
    alignItems: 'center',
    maxWidth: '40%',
  },

  cornerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },

  redCorner: {
    backgroundColor: '#C62828',
  },

  blueCorner: {
    backgroundColor: '#1565C0',
  },

  cornerText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '900',
  },

  boxerName: {
    color: '#C7CCD2',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },

  vs: {
    color: '#555D67',
    fontSize: 13,
    fontWeight: '900',
  },

  continueButton: {
    backgroundColor: '#E53935',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  sectionTitle: {
    color: '#8A929C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 12,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  statCard: {
    width: '48.5%',
    backgroundColor: '#15191F',
    borderRadius: 15,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#252B32',
  },

  statNumber: {
    color: '#FFF',
    fontSize: 25,
    fontWeight: '900',
  },

  statLabel: {
    color: '#777F89',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 3,
  },

  statIndicator: {
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E53935',
    marginTop: 12,
  },

  statIndicatorBlue: {
    backgroundColor: '#1976D2',
  },

  statIndicatorGreen: {
    backgroundColor: '#39A85A',
  },

  statIndicatorYellow: {
    backgroundColor: '#F5C542',
  },

  statTapHint: {
    marginTop: 7,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#555D67',
  },

  infoRow: {
    backgroundColor: '#15191F',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#252B32',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
  },

  infoTitle: {
    color: '#777F89',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 5,
  },

  viewButton: {
    backgroundColor: '#242B33',
    borderRadius: 9,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },

  viewButtonText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },

  smallButtonPressed: {
    opacity: 0.7,
  },

  reviewCard: {
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#252B32',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },

  reviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#17261B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  reviewIconText: {
    color: '#5DCB78',
    fontSize: 19,
    fontWeight: '900',
  },

  reviewInfo: {
    flex: 1,
  },

  reviewTitle: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '900',
  },

  reviewSubtitle: {
    color: '#777F89',
    fontSize: 9,
    marginTop: 4,
  },

  reviewArrow: {
    paddingLeft: 10,
  },

  reviewArrowText: {
    color: '#8A929C',
    fontSize: 22,
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 26,
  },

  actionCard: {
    width: '48.5%',
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#252B32',
    borderRadius: 15,
    padding: 15,
  },

  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#32191B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  actionIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#17253A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  actionIconText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },

  actionTitle: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },

  actionSubtitle: {
    color: '#777F89',
    fontSize: 8,
    marginTop: 4,
  },

  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  seeAll: {
    color: '#E53935',
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 12,
  },

  matchItem: {
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#252B32',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },

  smallCorner: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  smallCornerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
  },

  matchInfo: {
    flex: 1,
  },

  matchNames: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },

  matchDetails: {
    color: '#777F89',
    fontSize: 8,
    marginTop: 4,
  },

  winBadge: {
    backgroundColor: '#18351F',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },

  winBadgeBlue: {
    backgroundColor: '#172A45',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },

  winText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '900',
  },

  emptyRecent: {
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#252B32',
    borderRadius: 14,
    padding: 18,
  },

  emptyRecentText: {
    color: '#777F89',
    fontSize: 10,
  },

  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    backgroundColor: '#101318',
    borderTopWidth: 1,
    borderTopColor: '#242A31',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },

  navIconActive: {
    color: '#E53935',
    fontSize: 22,
  },

  navTextActive: {
    color: '#E53935',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 3,
  },

  navIcon: {
    color: '#6E7680',
    fontSize: 22,
  },

  navText: {
    color: '#6E7680',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 3,
  },

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});