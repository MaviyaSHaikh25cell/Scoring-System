import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { getMatchHistory, getTournaments, SavedMatch, Tournament, TournamentMatch } from '../constants/storage';

const BOXERS_KEY = '@boxing_system_boxers';

// Temporary logged-in boxer identity.
// Later this will come from the login/authentication system.
const PROFILE_BOXER_ID = 'BX001';

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

const DEFAULT_BOXER: Boxer = {
  id: 'BX001',
  name: 'Arjun Sharma',
  dateOfBirth: '12/04/2004',
  weight: '60 KG',
  club: 'Titan Boxing Club',
  coach: 'Rajesh Patil',
  stance: 'ORTHODOX',
  status: 'ACTIVE',
};

export default function BoxerDashboard() {
  const router = useRouter();

  const [boxer, setBoxer] = useState<Boxer>(DEFAULT_BOXER);
  const [matches, setMatches] = useState<SavedMatch[]>([]);
  const [upcomingMatch, setUpcomingMatch] = useState<{ tournament: Tournament; match: TournamentMatch } | null>(null);

  const loadBoxerData = useCallback(async () => {
    try {
      const storedBoxers = await AsyncStorage.getItem(BOXERS_KEY);

      if (storedBoxers) {
        const parsedBoxers = JSON.parse(storedBoxers);

        if (Array.isArray(parsedBoxers)) {
          const registeredBoxer = parsedBoxers.find(
            (item: Boxer) => item.id === PROFILE_BOXER_ID,
          );

          if (registeredBoxer) {
            setBoxer(registeredBoxer);

            const tournaments = await getTournaments();
            let nextMatch: { tournament: Tournament; match: TournamentMatch } | null = null;

            for (const tournament of tournaments) {
              for (const category of tournament.weightCategories) {
                const candidate = category.matches.find(
                  (match) =>
                    (match.status === 'UPCOMING' || match.status === 'LIVE') &&
                    (match.redBoxer === registeredBoxer.name || match.blueBoxer === registeredBoxer.name),
                );

                if (candidate) {
                  nextMatch = { tournament, match: candidate };
                  break;
                }
              }
              if (nextMatch) break;
            }

            setUpcomingMatch(nextMatch);
          }
        }
      }
    } catch (error) {
      console.log('Error loading boxer information:', error);
    }
  }, []);

  const loadMatches = useCallback(async () => {
    const history = await getMatchHistory();

    const boxerMatches = history.filter(
      (match) =>
        match.redBoxer === boxer.name ||
        match.blueBoxer === boxer.name,
    );

    setMatches(boxerMatches);
  }, [boxer.name]);

  useFocusEffect(
    useCallback(() => {
      loadBoxerData();
    }, [loadBoxerData]),
  );

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [loadMatches]),
  );

  const getMyScore = (match: SavedMatch) => {
    return match.redBoxer === boxer.name
      ? match.redScore
      : match.blueScore;
  };

  const getOpponentScore = (match: SavedMatch) => {
    return match.redBoxer === boxer.name
      ? match.blueScore
      : match.redScore;
  };

  const getOpponentName = (match: SavedMatch) => {
    return match.redBoxer === boxer.name
      ? match.blueBoxer
      : match.redBoxer;
  };

  const getMyResult = (match: SavedMatch) => {
    const myScore = getMyScore(match);
    const opponentScore = getOpponentScore(match);

    if (myScore > opponentScore) return 'WON';
    if (myScore < opponentScore) return 'LOST';
    return 'DRAW';
  };

  const wins = matches.filter(
    (match) => getMyResult(match) === 'WON',
  ).length;

  const losses = matches.filter(
    (match) => getMyResult(match) === 'LOST',
  ).length;

  const draws = matches.filter(
    (match) => getMyResult(match) === 'DRAW',
  ).length;

  const winPercentage =
    matches.length > 0
      ? Math.round((wins / matches.length) * 100)
      : 0;

  const latestMatch =
    matches.length > 0 ? matches[0] : null;

  const avatarInitials = boxer.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
          onPress: () => router.replace('/'),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.smallTitle}>
              BOXER DASHBOARD
            </Text>

            <Text style={styles.title}>
              Welcome, {boxer.name.split(' ')[0]} 👋
            </Text>
          </View>

          <View
            style={[
              styles.activeBadge,
              boxer.status === 'INACTIVE' &&
                styles.inactiveBadge,
            ]}
          >
            <View
              style={[
                styles.activeDot,
                boxer.status === 'INACTIVE' &&
                  styles.inactiveDot,
              ]}
            />

            <Text
              style={[
                styles.activeText,
                boxer.status === 'INACTIVE' &&
                  styles.inactiveStatusText,
              ]}
            >
              {boxer.status}
            </Text>
          </View>
        </View>

        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {avatarInitials}
              </Text>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {boxer.name}
              </Text>

              <Text style={styles.profileId}>
                BOXER ID: {boxer.id}
              </Text>

              <Text style={styles.profileClub}>
                {boxer.club}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={() =>
              router.push('/boxer-profile')
            }
          >
            <Text style={styles.profileButtonText}>
              VIEW MY PROFILE
            </Text>

            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        {/* STATS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            MY STATISTICS
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {matches.length}
            </Text>

            <Text style={styles.statLabel}>
              MATCHES
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {wins}
            </Text>

            <Text style={styles.statLabel}>
              WINS
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {losses}
            </Text>

            <Text style={styles.statLabel}>
              LOSSES
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {winPercentage}%
            </Text>

            <Text style={styles.statLabel}>
              WIN RATE
            </Text>
          </View>
        </View>

        {/* DRAW INFO */}
        {draws > 0 && (
          <View style={styles.drawCard}>
            <View>
              <Text style={styles.drawTitle}>
                DRAW MATCHES
              </Text>

              <Text style={styles.drawSubtitle}>
                You currently have {draws} draw
                {draws > 1 ? 's' : ''}.
              </Text>
            </View>

            <Text style={styles.drawNumber}>
              {draws}
            </Text>
          </View>
        )}

        {/* UPCOMING MATCH */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>UPCOMING MATCH</Text>
        </View>

        <View style={styles.upcomingCard}>
          <View style={styles.upcomingHeader}>
            <View>
              <Text style={styles.upcomingLabel}>NEXT MATCH</Text>
              <Text style={styles.upcomingStatus}>
                {upcomingMatch?.match.status === 'LIVE' ? 'LIVE NOW' : upcomingMatch ? 'ASSIGNED' : 'NOT ASSIGNED'}
              </Text>
            </View>
            <View style={styles.calendarIcon}><Text style={styles.calendarText}>+</Text></View>
          </View>

          {upcomingMatch ? (
            <>
              <Text style={styles.noMatchText}>
                {upcomingMatch.match.redBoxer || 'RED'} vs {upcomingMatch.match.blueBoxer || 'BLUE'}
              </Text>
              <Text style={styles.noMatchSubtext}>
                {upcomingMatch.tournament.name} • {upcomingMatch.match.weightCategory} • {upcomingMatch.match.round}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.noMatchText}>No upcoming match has been assigned to you yet.</Text>
              <Text style={styles.noMatchSubtext}>Your upcoming match will appear here when the admin assigns one.</Text>
            </>
          )}
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            QUICK ACTIONS
          </Text>
        </View>

        <View style={styles.actionsContainer}>
          <Pressable
            style={styles.actionCard}
            onPress={() =>
              router.push('/boxer-profile')
            }
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>
                P
              </Text>
            </View>

            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>
                My Profile
              </Text>

              <Text style={styles.actionSubtitle}>
                View official boxer information
              </Text>
            </View>

            <Text style={styles.actionArrow}>
              ›
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() => {
              if (matches.length === 0) {
                Alert.alert(
                  'Match History',
                  'You do not have any completed matches yet.',
                );

                return;
              }

              router.push('/history');
            }}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>
                H
              </Text>
            </View>

            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>
                Match History
              </Text>

              <Text style={styles.actionSubtitle}>
                View your previous match results
              </Text>
            </View>

            <Text style={styles.actionArrow}>
              ›
            </Text>
          </Pressable>

          <Pressable
            style={styles.actionCard}
            onPress={() =>
              router.push('/settings')
            }
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>
                S
              </Text>
            </View>

            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>
                Settings
              </Text>

              <Text style={styles.actionSubtitle}>
                App and account settings
              </Text>
            </View>

            <Text style={styles.actionArrow}>
              ›
            </Text>
          </Pressable>
        </View>

        {/* LATEST RESULT */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            LATEST RESULT
          </Text>
        </View>

        {latestMatch ? (
          <View style={styles.resultCard}>
            <View style={styles.resultTop}>
              <View>
                <Text style={styles.resultLabel}>
                  LATEST MATCH
                </Text>

                <Text style={styles.resultOpponent}>
                  vs {getOpponentName(latestMatch)}
                </Text>
              </View>

              <View
                style={[
                  styles.resultBadge,
                  getMyResult(latestMatch) === 'WON'
                    ? styles.winBadge
                    : getMyResult(latestMatch) ===
                        'LOST'
                      ? styles.lossBadge
                      : styles.drawBadge,
                ]}
              >
                <Text style={styles.resultBadgeText}>
                  {getMyResult(latestMatch)}
                </Text>
              </View>
            </View>

            <View style={styles.scoreRow}>
              <Text style={styles.myScore}>
                {getMyScore(latestMatch)}
              </Text>

              <Text style={styles.scoreDash}>
                -
              </Text>

              <Text style={styles.opponentScore}>
                {getOpponentScore(latestMatch)}
              </Text>
            </View>

            <View style={styles.matchDetails}>
              <Text style={styles.detailText}>
                {latestMatch.weightCategory}
              </Text>

              <Text style={styles.detailSeparator}>
                •
              </Text>

              <Text style={styles.detailText}>
                {latestMatch.rounds} ROUNDS
              </Text>

              <Text style={styles.detailSeparator}>
                •
              </Text>

              <Text style={styles.detailText}>
                {latestMatch.matchType}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyResultCard}>
            <Text style={styles.emptyResultTitle}>
              No results yet
            </Text>

            <Text style={styles.emptyResultText}>
              Your completed match results will appear here.
            </Text>
          </View>
        )}

        {/* IMPORTANT NOTICE */}
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>
            OFFICIAL INFORMATION
          </Text>

          <Text style={styles.noticeText}>
            Your official age, weight, club and other
            registered boxer information can only be changed
            by an administrator.
          </Text>

          <Text style={styles.noticeSubtext}>
            If any information is incorrect, contact the admin
            to request an update.
          </Text>
        </View>

        {/* LOGOUT */}
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>
            LOGOUT
          </Text>
        </Pressable>

        <Text style={styles.footerText}>
          BOXING SCORING SYSTEM
        </Text>
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

  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  smallTitle: {
    color: '#8B919A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 5,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },

  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14251B',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  inactiveBadge: {
    backgroundColor: '#241719',
  },

  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#39D353',
    marginRight: 6,
  },

  inactiveDot: {
    backgroundColor: '#E53935',
  },

  activeText: {
    color: '#39D353',
    fontSize: 10,
    fontWeight: '800',
  },

  inactiveStatusText: {
    color: '#E53935',
  },

  profileCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    padding: 18,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#242932',
  },

  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 65,
    height: 65,
    borderRadius: 33,
    backgroundColor: '#20252D',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E53935',
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },

  profileInfo: {
    marginLeft: 15,
    flex: 1,
  },

  profileName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 4,
  },

  profileId: {
    color: '#8B919A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  profileClub: {
    color: '#B4BAC3',
    fontSize: 12,
    marginTop: 4,
  },

  profileButton: {
    marginTop: 18,
    height: 45,
    borderRadius: 10,
    backgroundColor: '#20252D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 23,
    marginLeft: 8,
    marginTop: -2,
  },

  sectionHeader: {
    marginBottom: 12,
  },

  sectionTitle: {
    color: '#8B919A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  statCard: {
    width: '48.5%',
    backgroundColor: '#15191F',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#242932',
  },

  statValue: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 4,
  },

  statLabel: {
    color: '#7E858F',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  drawCard: {
    backgroundColor: '#15191F',
    borderRadius: 14,
    padding: 16,
    marginBottom: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242932',
  },

  drawTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },

  drawSubtitle: {
    color: '#818892',
    fontSize: 11,
  },

  drawNumber: {
    color: '#F5C542',
    fontSize: 26,
    fontWeight: '800',
  },

  upcomingCard: {
    backgroundColor: '#15191F',
    borderRadius: 16,
    padding: 18,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#242932',
  },

  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  upcomingLabel: {
    color: '#8B919A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },

  upcomingStatus: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  calendarIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#20252D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarText: {
    color: '#E53935',
    fontSize: 24,
    fontWeight: '500',
  },

  noMatchText: {
    color: '#D8DCE2',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
    lineHeight: 19,
  },

  noMatchSubtext: {
    color: '#777E88',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },

  actionsContainer: {
    marginBottom: 25,
  },

  actionCard: {
    backgroundColor: '#15191F',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242932',
  },

  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: '#20252D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionIconText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  actionTextContainer: {
    flex: 1,
    marginLeft: 13,
  },

  actionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },

  actionSubtitle: {
    color: '#777E88',
    fontSize: 11,
  },

  actionArrow: {
    color: '#707781',
    fontSize: 25,
    marginLeft: 8,
  },

  resultCard: {
    backgroundColor: '#15191F',
    borderRadius: 16,
    padding: 18,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#242932',
  },

  resultTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  resultLabel: {
    color: '#7E858F',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 5,
  },

  resultOpponent: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  resultBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },

  winBadge: {
    backgroundColor: '#14351F',
  },

  lossBadge: {
    backgroundColor: '#351719',
  },

  drawBadge: {
    backgroundColor: '#38321A',
  },

  resultBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },

  myScore: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
  },

  scoreDash: {
    color: '#606772',
    fontSize: 25,
    marginHorizontal: 14,
  },

  opponentScore: {
    color: '#8B919A',
    fontSize: 38,
    fontWeight: '800',
  },

  matchDetails: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  detailText: {
    color: '#777E88',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  detailSeparator: {
    color: '#4C535C',
    fontSize: 10,
    marginHorizontal: 7,
  },

  emptyResultCard: {
    backgroundColor: '#15191F',
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#242932',
  },

  emptyResultTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },

  emptyResultText: {
    color: '#777E88',
    fontSize: 11,
    textAlign: 'center',
  },

  noticeCard: {
    backgroundColor: '#171B21',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#292E36',
  },

  noticeTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },

  noticeText: {
    color: '#A8AEB7',
    fontSize: 11,
    lineHeight: 17,
  },

  noticeSubtext: {
    color: '#6F7680',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 7,
  },

  logoutButton: {
    height: 48,
    borderRadius: 11,
    backgroundColor: '#241416',
    borderWidth: 1,
    borderColor: '#482125',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutText: {
    color: '#E53935',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },

  footerText: {
    color: '#41464E',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 22,
  },
});