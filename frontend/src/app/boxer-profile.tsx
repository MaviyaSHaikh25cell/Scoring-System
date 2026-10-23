import React, { useCallback, useMemo, useState } from 'react';
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
import { getMatchHistory, SavedMatch } from '../constants/storage';

const BOXERS_KEY = '@boxing_system_boxers';
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

type MatchResult = 'WON' | 'LOST' | 'DRAW';

type BoxerMatch = {
  id: string;
  opponent: string;
  date: string;
  time: string;
  category: string;
  score: string;
  result: MatchResult;
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

function calculateAge(dateOfBirth: string): number | null {
  const parts = dateOfBirth.split('/');

  if (parts.length !== 3) {
    return null;
  }

  const day = Number(parts[0]);
  const month = Number(parts[1]);
  const year = Number(parts[2]);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    month < 1 ||
    month > 12 ||
    year < 1900
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - year;

  const birthdayThisYear = new Date(
    today.getFullYear(),
    month - 1,
    day,
  );

  if (birthdayThisYear > today) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export default function BoxerProfileScreen() {
  const [boxer, setBoxer] = useState<Boxer>(DEFAULT_BOXER);
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([]);

  const loadProfileData = useCallback(async () => {
    try {
      let currentBoxer = DEFAULT_BOXER;

      const storedBoxers = await AsyncStorage.getItem(BOXERS_KEY);

      if (storedBoxers) {
        try {
          const parsedBoxers: unknown = JSON.parse(storedBoxers);

          if (Array.isArray(parsedBoxers)) {
            const registeredBoxer = parsedBoxers.find(
              (item): item is Boxer =>
                typeof item === 'object' &&
                item !== null &&
                'id' in item &&
                item.id === PROFILE_BOXER_ID,
            );

            if (registeredBoxer) {
              currentBoxer = registeredBoxer;
            }
          }
        } catch {
          // Keep the default profile if the stored boxer registry is invalid.
        }
      }

      setBoxer(currentBoxer);

      const history = await getMatchHistory();

      /*
       * Match history has historically stored either boxer IDs or boxer names.
       * Only match records that actually belong to this profile are included.
       */
      const filteredMatches = history.filter((match) => {
        const redMatchesProfile =
          match.redBoxer === currentBoxer.id ||
          match.redBoxer === currentBoxer.name;

        const blueMatchesProfile =
          match.blueBoxer === currentBoxer.id ||
          match.blueBoxer === currentBoxer.name;

        return redMatchesProfile || blueMatchesProfile;
      });

      setSavedMatches(filteredMatches);
    } catch (error) {
      console.log('Error loading boxer profile:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData]),
  );

  const profileName = boxer.name;

  /* TOTAL MATCHES */
  const totalMatches = savedMatches.length;

  /* WINS */
  const wins = savedMatches.filter((match) => {
    const boxerIsRed =
      match.redBoxer === boxer.id ||
      match.redBoxer === profileName;

    const boxerScore = boxerIsRed
      ? match.redScore
      : match.blueScore;

    const opponentScore = boxerIsRed
      ? match.blueScore
      : match.redScore;

    return boxerScore > opponentScore;
  }).length;

  /* LOSSES */
  const losses = savedMatches.filter((match) => {
    const boxerIsRed =
      match.redBoxer === boxer.id ||
      match.redBoxer === profileName;

    const boxerScore = boxerIsRed
      ? match.redScore
      : match.blueScore;

    const opponentScore = boxerIsRed
      ? match.blueScore
      : match.redScore;

    return boxerScore < opponentScore;
  }).length;

  /* DRAWS */
  const draws = savedMatches.filter(
    (match) => match.redScore === match.blueScore,
  ).length;

  /* WIN PERCENTAGE */
  const winPercentage =
    totalMatches > 0
      ? Math.round((wins / totalMatches) * 100)
      : 0;

  /* RECENT MATCHES */
  const recentMatches: BoxerMatch[] = useMemo(() => {
    return savedMatches.slice(0, 4).map((match) => {
      const boxerIsRed =
        match.redBoxer === boxer.id ||
        match.redBoxer === profileName;

      const opponent = boxerIsRed
        ? match.blueBoxer
        : match.redBoxer;

      const boxerScore = boxerIsRed
        ? match.redScore
        : match.blueScore;

      const opponentScore = boxerIsRed
        ? match.blueScore
        : match.redScore;

      let result: MatchResult;

      if (boxerScore > opponentScore) {
        result = 'WON';
      } else if (boxerScore < opponentScore) {
        result = 'LOST';
      } else {
        result = 'DRAW';
      }

      return {
        id: match.id,
        opponent,
        date: match.date,
        time: match.time,
        category: match.weightCategory,
        score: `${boxerScore} - ${opponentScore}`,
        result,
      };
    });
  }, [savedMatches, profileName, boxer.id]);

  const initials = boxer.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();


  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>
              BOXER PROFILE
            </Text>

            <Text style={styles.headerSubtitle}>
              Boxer information and statistics
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
                <Text style={styles.avatarText}>
                  {initials}
                </Text>
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {boxer.name.toUpperCase()}
                </Text>

                <Text style={styles.profileId}>
                  BOXER ID • {boxer.id}
                </Text>

                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      boxer.status === 'INACTIVE' &&
                        styles.inactiveStatusDot,
                    ]}
                  />

                  <Text
                    style={[
                      styles.statusText,
                      boxer.status === 'INACTIVE' &&
                        styles.inactiveStatusText,
                    ]}
                  >
                    {boxer.status}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.profileDivider} />

            <View style={styles.profileDetails}>
              <DetailItem
                label="WEIGHT CATEGORY"
                value={boxer.weight}
              />

              <DetailItem
                label="AGE"
                value={
                  calculateAge(boxer.dateOfBirth) !== null
                    ? `${calculateAge(boxer.dateOfBirth)} YEARS`
                    : 'NOT AVAILABLE'
                }
              />
            </View>
          </View>

          {/* FIGHT RECORD */}
          <Text style={styles.sectionTitle}>
            FIGHT RECORD
          </Text>

          <View style={styles.recordContainer}>
            <RecordCard
              value={totalMatches}
              label="TOTAL MATCHES"
            />

            <RecordCard
              value={wins}
              label="WINS"
              green
            />

            <RecordCard
              value={losses}
              label="LOSSES"
              red
            />
          </View>

          {/* WIN RATE */}
          <View style={styles.winRateCard}>
            <View style={styles.winRateTop}>
              <View>
                <Text style={styles.winRateTitle}>
                  WIN RATE
                </Text>

                <Text style={styles.winRateSubtitle}>
                  Career performance
                </Text>
              </View>

              <Text style={styles.winRatePercentage}>
                {winPercentage}%
              </Text>
            </View>

            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${winPercentage}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.winRateBottom}>
              <Text style={styles.winRateSmall}>
                {wins} WINS
              </Text>

              <Text style={styles.winRateSmall}>
                {losses} LOSSES
              </Text>
            </View>

            {draws > 0 && (
              <Text style={styles.drawText}>
                {draws} DRAW{draws > 1 ? 'S' : ''}
              </Text>
            )}
          </View>

          {/* BOXING DETAILS */}
          <Text style={styles.sectionTitle}>
            BOXING DETAILS
          </Text>

          <View style={styles.detailsCard}>
            <InfoRow
              label="STANCE"
              value={boxer.stance}
            />

            <InfoRow
              label="CLUB"
              value={boxer.club.toUpperCase()}
            />

            <InfoRow
              label="COACH"
              value={boxer.coach.toUpperCase()}
              last
            />
          </View>

          {/* RECENT MATCHES */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              RECENT MATCHES
            </Text>

            <Pressable
              onPress={() => router.push('/history')}
            >
              <Text style={styles.viewAllText}>
                VIEW ALL ›
              </Text>
            </Pressable>
          </View>

          {recentMatches.length === 0 ? (
            <View style={styles.emptyMatches}>
              <Text style={styles.emptyTitle}>
                NO MATCHES YET
              </Text>

              <Text style={styles.emptySubtitle}>
                Completed matches will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.matchesContainer}>
              {recentMatches.map((match) => (
                <RecentMatchCard
                  key={match.id}
                  match={match}
                />
              ))}
            </View>
          )}

          {/* FOOTER */}
          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>
              PROFILE STATUS
            </Text>

            <View style={styles.footerStatusRow}>
              <View
                style={[
                  styles.largeStatusDot,
                  boxer.status === 'INACTIVE' &&
                    styles.largeInactiveDot,
                ]}
              />

              <Text
                style={[
                  styles.footerStatusText,
                  boxer.status === 'INACTIVE' &&
                    styles.footerInactiveText,
                ]}
              >
                PROFILE {boxer.status}
              </Text>
            </View>

            <Text style={styles.footerDescription}>
              {boxer.status === 'ACTIVE'
                ? 'This boxer is currently registered and available for match selection.'
                : 'This boxer is currently inactive and unavailable for new match selection.'}
            </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* DETAIL ITEM */

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>
        {label}
      </Text>

      <Text style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

/* RECORD CARD */

function RecordCard({
  value,
  label,
  green,
  red,
}: {
  value: number;
  label: string;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <View style={styles.recordCard}>
      <Text
        style={[
          styles.recordNumber,
          green && styles.winNumber,
          red && styles.lossNumber,
        ]}
      >
        {value}
      </Text>

      <Text style={styles.recordLabel}>
        {label}
      </Text>
    </View>
  );
}

/* INFO ROW */

function InfoRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && styles.infoRowBorder,
      ]}
    >
      <Text style={styles.infoLabel}>
        {label}
      </Text>

      <Text style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

/* RECENT MATCH CARD */

function RecentMatchCard({
  match,
}: {
  match: BoxerMatch;
}) {
  const won = match.result === 'WON';
  const lost = match.result === 'LOST';
  const draw = match.result === 'DRAW';

  return (
    <View style={styles.matchCard}>
      <View
        style={[
          styles.matchResultIndicator,
          won
            ? styles.matchResultWon
            : lost
              ? styles.matchResultLost
              : styles.matchResultDraw,
        ]}
      />

      <View style={styles.matchMain}>
        <View style={styles.matchTopRow}>
          <View>
            <Text style={styles.matchId}>
              {match.id}
            </Text>

            <Text style={styles.opponentText}>
              VS {match.opponent}
            </Text>
          </View>

          <View
            style={[
              styles.resultBadge,
              won
                ? styles.resultBadgeWon
                : lost
                  ? styles.resultBadgeLost
                  : styles.resultBadgeDraw,
            ]}
          >
            <Text
              style={[
                styles.resultText,
                won
                  ? styles.resultTextWon
                  : lost
                    ? styles.resultTextLost
                    : styles.resultTextDraw,
              ]}
            >
              {match.result}
            </Text>
          </View>
        </View>

        <View style={styles.matchBottomRow}>
          <Text style={styles.matchDate}>
            {match.date}
          </Text>

          <Text style={styles.matchCategory}>
            {match.category}
          </Text>

          <Text style={styles.matchScore}>
            {match.score}
          </Text>
        </View>
      </View>
    </View>
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1d1d',
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  backIcon: {
    color: '#fff',
    fontSize: 35,
    lineHeight: 38,
    fontWeight: '300',
    marginTop: -3,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },

  headerSubtitle: {
    color: '#777',
    fontSize: 11,
    marginTop: 4,
  },



  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  profileCard: {
    backgroundColor: '#111',
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
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#353535',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },

  profileInfo: {
    flex: 1,
  },

  profileName: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  profileId: {
    color: '#666',
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
    backgroundColor: '#55d88a',
    marginRight: 6,
  },

  inactiveStatusDot: {
    backgroundColor: '#ff6464',
  },

  statusText: {
    color: '#55d88a',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },

  inactiveStatusText: {
    color: '#ff6464',
  },

  profileDivider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 18,
  },

  profileDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  detailItem: {
    width: '50%',
    marginBottom: 13,
  },

  detailLabel: {
    color: '#5c5c5c',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 4,
  },

  detailValue: {
    color: '#ddd',
    fontSize: 12,
    fontWeight: '800',
  },

  sectionTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 12,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  viewAllText: {
    color: '#aaa',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },

  recordContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  recordCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242424',
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },

  recordNumber: {
    color: '#fff',
    fontSize: 23,
    fontWeight: '900',
  },

  winNumber: {
    color: '#55d88a',
  },

  lossNumber: {
    color: '#ff6464',
  },

  recordLabel: {
    color: '#606060',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: 5,
  },

  winRateCard: {
    backgroundColor: '#111',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 17,
    marginBottom: 25,
  },

  winRateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  winRateTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  winRateSubtitle: {
    color: '#5f5f5f',
    fontSize: 9,
    marginTop: 3,
  },

  winRatePercentage: {
    color: '#55d88a',
    fontSize: 24,
    fontWeight: '900',
  },

  progressBackground: {
    height: 8,
    backgroundColor: '#242424',
    borderRadius: 5,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#55d88a',
    borderRadius: 5,
  },

  winRateBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },

  winRateSmall: {
    color: '#5f5f5f',
    fontSize: 8,
    fontWeight: '700',
  },

  drawText: {
    color: '#F9A825',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },

  detailsCard: {
    backgroundColor: '#111',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#242424',
    paddingHorizontal: 16,
    marginBottom: 25,
  },

  infoRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#202020',
  },

  infoLabel: {
    color: '#606060',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  infoValue: {
    color: '#ddd',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    maxWidth: '65%',
  },

  matchesContainer: {
    marginBottom: 25,
  },

  matchCard: {
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242424',
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },

  matchResultIndicator: {
    width: 4,
  },

  matchResultWon: {
    backgroundColor: '#55d88a',
  },

  matchResultLost: {
    backgroundColor: '#ff6464',
  },

  matchResultDraw: {
    backgroundColor: '#F9A825',
  },

  matchMain: {
    flex: 1,
    padding: 14,
  },

  matchTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  matchId: {
    color: '#555',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },

  opponentText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  resultBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },

  resultBadgeWon: {
    backgroundColor: '#102219',
    borderColor: '#214d34',
  },

  resultBadgeLost: {
    backgroundColor: '#241313',
    borderColor: '#4b2222',
  },

  resultBadgeDraw: {
    backgroundColor: '#29251A',
    borderColor: '#5b4a20',
  },

  resultText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  resultTextWon: {
    color: '#55d88a',
  },

  resultTextLost: {
    color: '#ff6464',
  },

  resultTextDraw: {
    color: '#F9A825',
  },

  matchBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  matchDate: {
    flex: 1,
    color: '#5f5f5f',
    fontSize: 8,
    fontWeight: '600',
  },

  matchCategory: {
    color: '#686868',
    fontSize: 8,
    fontWeight: '700',
    marginRight: 13,
  },

  matchScore: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },

  emptyMatches: {
    backgroundColor: '#111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#242424',
    paddingVertical: 30,
    alignItems: 'center',
    marginBottom: 25,
  },

  emptyTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  emptySubtitle: {
    color: '#5f5f5f',
    fontSize: 9,
    marginTop: 5,
  },

  footerCard: {
    backgroundColor: '#101010',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 16,
  },

  footerTitle: {
    color: '#fff',
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
    backgroundColor: '#55d88a',
    marginRight: 7,
  },

  largeInactiveDot: {
    backgroundColor: '#ff6464',
  },

  footerStatusText: {
    color: '#55d88a',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  footerInactiveText: {
    color: '#ff6464',
  },

  footerDescription: {
    color: '#5d5d5d',
    fontSize: 10,
    lineHeight: 16,
  },
});