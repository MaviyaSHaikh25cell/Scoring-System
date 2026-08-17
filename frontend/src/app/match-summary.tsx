import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

export default function MatchSummaryScreen() {
  const {
    redBoxer,
    blueBoxer,
    weightCategory,
    rounds,
    matchType,
    redScore,
    blueScore,
  } = useLocalSearchParams<{
    redBoxer?: string;
    blueBoxer?: string;
    weightCategory?: string;
    rounds?: string;
    matchType?: string;
    redScore?: string;
    blueScore?: string;
  }>();

  // Convert scores from route parameters into numbers
  const finalRedScore = Number(redScore) || 0;
  const finalBlueScore = Number(blueScore) || 0;

  // Determine result
  const redWins = finalRedScore > finalBlueScore;
  const blueWins = finalBlueScore > finalRedScore;
  const draw = finalRedScore === finalBlueScore;

  // Winner information
  const winnerName = draw
    ? 'DRAW'
    : redWins
      ? redBoxer || 'RED BOXER'
      : blueBoxer || 'BLUE BOXER';

  const winnerCorner = draw
    ? 'MATCH DRAW'
    : redWins
      ? 'RED CORNER'
      : 'BLUE CORNER';

  const resultText = draw
    ? 'DRAW'
    : redWins
      ? 'RED WIN'
      : 'BLUE WIN';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              MATCH SUMMARY
            </Text>

            <Text style={styles.headerSubtitle}>
              MATCH COMPLETED
            </Text>
          </View>

          {/* RESULT */}
          <View style={styles.resultCard}>

            <View style={styles.trophyCircle}>
              <Text style={styles.trophy}>
                {draw ? '🤝' : '🏆'}
              </Text>
            </View>

            <Text style={styles.resultLabel}>
              {draw ? 'RESULT' : 'WINNER'}
            </Text>

            <Text
              style={[
                styles.winnerName,
                draw && styles.drawName,
              ]}
              numberOfLines={2}
              adjustsFontSizeToFit
            >
              {winnerName}
            </Text>

            <Text
              style={[
                styles.resultText,
                draw && styles.drawText,
              ]}
            >
              {winnerCorner}
            </Text>
          </View>

          {/* FINAL SCORE */}
          <Text style={styles.sectionTitle}>
            FINAL SCORE
          </Text>

          <View style={styles.scoreboard}>

            {/* RED */}
            <View style={styles.boxer}>

              <View
                style={[
                  styles.corner,
                  styles.redCorner,
                ]}
              >
                <Text style={styles.cornerText}>
                  R
                </Text>
              </View>

              <Text
                style={styles.boxerName}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {redBoxer || 'RED BOXER'}
              </Text>

              <Text style={styles.score}>
                {finalRedScore}
              </Text>

              <Text style={styles.cornerLabel}>
                RED CORNER
              </Text>
            </View>

            {/* VS */}
            <View style={styles.vsContainer}>
              <Text style={styles.vs}>
                VS
              </Text>
            </View>

            {/* BLUE */}
            <View style={styles.boxer}>

              <View
                style={[
                  styles.corner,
                  styles.blueCorner,
                ]}
              >
                <Text style={styles.cornerText}>
                  B
                </Text>
              </View>

              <Text
                style={styles.boxerName}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {blueBoxer || 'BLUE BOXER'}
              </Text>

              <Text style={styles.score}>
                {finalBlueScore}
              </Text>

              <Text style={styles.cornerLabel}>
                BLUE CORNER
              </Text>
            </View>
          </View>

          {/* MATCH DETAILS */}
          <Text style={styles.sectionTitle}>
            MATCH DETAILS
          </Text>

          <View style={styles.detailsCard}>

            {/* CATEGORY */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                CATEGORY
              </Text>

              <Text style={styles.detailValue}>
                {weightCategory || 'LIGHTWEIGHT'}
              </Text>
            </View>

            <View style={styles.separator} />

            {/* MATCH TYPE */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                MATCH TYPE
              </Text>

              <Text style={styles.detailValue}>
                {matchType || 'TOURNAMENT'}
              </Text>
            </View>

            <View style={styles.separator} />

            {/* RESULT */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                RESULT
              </Text>

              <Text
                style={[
                  styles.detailValue,
                  draw && styles.drawDetail,
                ]}
              >
                {resultText}
              </Text>
            </View>

            <View style={styles.separator} />

            {/* ROUNDS */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                ROUNDS
              </Text>

              <Text style={styles.detailValue}>
                {rounds || '3'} / {rounds || '3'}
              </Text>
            </View>

            <View style={styles.separator} />

            {/* STATUS */}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                STATUS
              </Text>

              <Text style={styles.completed}>
                COMPLETED
              </Text>
            </View>
          </View>

          {/* SCORE RESULT */}
          <View style={styles.resultScoreCard}>

            <Text style={styles.resultScoreTitle}>
              FINAL RESULT
            </Text>

            <View style={styles.resultScoreRow}>

              <View style={styles.resultScoreSide}>
                <Text style={styles.resultScoreLabel}>
                  RED
                </Text>

                <Text style={styles.resultScoreNumber}>
                  {finalRedScore}
                </Text>
              </View>

              <Text style={styles.resultScoreDash}>
                -
              </Text>

              <View style={styles.resultScoreSide}>
                <Text style={styles.resultScoreLabel}>
                  BLUE
                </Text>

                <Text style={styles.resultScoreNumber}>
                  {finalBlueScore}
                </Text>
              </View>
            </View>
          </View>

          {/* BUTTONS */}
          <View style={styles.buttons}>

            {/* BACK TO DASHBOARD */}
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace('/dashboard')}
            >
              <Text style={styles.primaryButtonText}>
                BACK TO DASHBOARD
              </Text>

              <Text style={styles.arrow}>
                →
              </Text>
            </Pressable>

            {/* CREATE NEW MATCH */}
            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.replace('/create-match')}
            >
              <Text style={styles.secondaryButtonText}>
                CREATE NEW MATCH
              </Text>
            </Pressable>
          </View>

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

  scrollView: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },

  scrollContent: {
    paddingBottom: 35,
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  /* HEADER */

  header: {
    alignItems: 'center',
    marginBottom: 20,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  headerSubtitle: {
    color: '#43A047',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 5,
  },

  /* RESULT */

  resultCard: {
    backgroundColor: '#15191F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#252B32',
    alignItems: 'center',
    paddingVertical: 22,
  },

  trophyCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#29251A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  trophy: {
    fontSize: 28,
  },

  resultLabel: {
    color: '#7D858F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginTop: 12,
  },

  winnerName: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 3,
    maxWidth: '90%',
    textAlign: 'center',
  },

  drawName: {
    color: '#F9A825',
  },

  resultText: {
    color: '#E53935',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 3,
  },

  drawText: {
    color: '#F9A825',
  },

  /* SECTION */

  sectionTitle: {
    color: '#858D97',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 20,
    marginBottom: 10,
  },

  /* SCOREBOARD */

  scoreboard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#252B32',
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  boxer: {
    alignItems: 'center',
    width: '40%',
  },

  corner: {
    width: 45,
    height: 45,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },

  redCorner: {
    backgroundColor: '#C62828',
  },

  blueCorner: {
    backgroundColor: '#1565C0',
  },

  cornerText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  boxerName: {
    color: '#D3D7DB',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 7,
    textAlign: 'center',
    minHeight: 28,
    maxWidth: '100%',
  },

  score: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
  },

  cornerLabel: {
    color: '#626A74',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  vsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  vs: {
    color: '#555D67',
    fontSize: 11,
    fontWeight: '900',
  },

  /* DETAILS */

  detailsCard: {
    backgroundColor: '#15191F',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#252B32',
    paddingHorizontal: 15,
  },

  detailRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  detailLabel: {
    color: '#626A74',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  detailValue: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  drawDetail: {
    color: '#F9A825',
  },

  completed: {
    color: '#43A047',
    fontSize: 9,
    fontWeight: '900',
  },

  separator: {
    height: 1,
    backgroundColor: '#252B32',
  },

  /* RESULT SCORE */

  resultScoreCard: {
    backgroundColor: '#15191F',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#252B32',
    padding: 15,
    marginTop: 15,
  },

  resultScoreTitle: {
    color: '#7D858F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 12,
  },

  resultScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultScoreSide: {
    alignItems: 'center',
    width: 90,
  },

  resultScoreLabel: {
    color: '#69717B',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  resultScoreNumber: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 3,
  },

  resultScoreDash: {
    color: '#555D67',
    fontSize: 18,
    fontWeight: '900',
    marginHorizontal: 15,
  },

  /* BUTTONS */

  buttons: {
    marginTop: 18,
  },

  primaryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 8,
  },

  secondaryButton: {
    height: 45,
    borderRadius: 12,
    backgroundColor: '#171B21',
    borderWidth: 1,
    borderColor: '#292F37',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  secondaryButtonText: {
    color: '#D4D8DC',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
});