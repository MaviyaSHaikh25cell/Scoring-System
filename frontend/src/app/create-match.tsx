import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateMatchScreen() {
  const [redBoxer, setRedBoxer] = useState('');
  const [blueBoxer, setBlueBoxer] = useState('');
  const [weightCategory, setWeightCategory] = useState('Lightweight');
  const [rounds, setRounds] = useState(3);
  const [matchType, setMatchType] = useState('Tournament');

  const boxers = [
    'Arjun Sharma',
    'Rahul Patil',
    'Vikram Singh',
    'Sameer Khan',
  ];

  const weightCategories = [
    'Flyweight',
    'Bantamweight',
    'Featherweight',
    'Lightweight',
    'Welterweight',
    'Middleweight',
    'Heavyweight',
  ];

  const handleStartMatch = () => {
  if (!redBoxer || !blueBoxer) {
    return;
  }

  router.push({
  pathname: '/live-scoring',
  params: {
    redBoxer,
    blueBoxer,
    weightCategory,
    rounds: rounds.toString(),
    matchType,
  },
});
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
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View>
            <Text style={styles.headerSmall}>
              TOURNAMENT
            </Text>

            <Text style={styles.headerTitle}>
              Create Match
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* MATCH TYPE */}

        <Text style={styles.sectionTitle}>
          MATCH TYPE
        </Text>

        <View style={styles.typeRow}>
          <Pressable
            style={[
              styles.typeButton,
              matchType === 'Tournament' &&
                styles.typeButtonActive,
            ]}
            onPress={() => setMatchType('Tournament')}
          >
            <Text
              style={[
                styles.typeText,
                matchType === 'Tournament' &&
                  styles.typeTextActive,
              ]}
            >
              Tournament
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.typeButton,
              matchType === 'Exhibition' &&
                styles.typeButtonActive,
            ]}
            onPress={() => setMatchType('Exhibition')}
          >
            <Text
              style={[
                styles.typeText,
                matchType === 'Exhibition' &&
                  styles.typeTextActive,
              ]}
            >
              Exhibition
            </Text>
          </Pressable>
        </View>

        {/* RED CORNER */}

        <Text style={styles.sectionTitle}>
          RED CORNER
        </Text>

        <View style={styles.boxerCard}>
          <View style={styles.cornerHeader}>
            <View
              style={[
                styles.cornerIcon,
                styles.redBackground,
              ]}
            >
              <Text style={styles.cornerLetter}>
                R
              </Text>
            </View>

            <View style={styles.cornerInfo}>
              <Text style={styles.cornerTitle}>
                RED CORNER
              </Text>

              <Text style={styles.cornerSubtitle}>
                Select boxer
              </Text>
            </View>
          </View>

          <View style={styles.boxerList}>
            {boxers.map((boxer) => (
              <Pressable
                key={boxer}
                style={[
                  styles.boxerOption,
                  redBoxer === boxer &&
                    styles.redSelected,
                ]}
                onPress={() => setRedBoxer(boxer)}
              >
                <View
                  style={[
                    styles.avatar,
                    styles.redAvatar,
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {boxer.charAt(0)}
                  </Text>
                </View>

                <Text style={styles.boxerName}>
                  {boxer}
                </Text>

                {redBoxer === boxer && (
                  <Text style={styles.check}>
                    ✓
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* VS */}

        <View style={styles.vsContainer}>
          <View style={styles.vsLine} />

          <View style={styles.vsCircle}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <View style={styles.vsLine} />
        </View>

        {/* BLUE CORNER */}

        <Text style={styles.sectionTitle}>
          BLUE CORNER
        </Text>

        <View style={styles.boxerCard}>
          <View style={styles.cornerHeader}>
            <View
              style={[
                styles.cornerIcon,
                styles.blueBackground,
              ]}
            >
              <Text style={styles.cornerLetter}>
                B
              </Text>
            </View>

            <View style={styles.cornerInfo}>
              <Text style={styles.cornerTitle}>
                BLUE CORNER
              </Text>

              <Text style={styles.cornerSubtitle}>
                Select boxer
              </Text>
            </View>
          </View>

          <View style={styles.boxerList}>
            {boxers.map((boxer) => (
              <Pressable
                key={boxer}
                style={[
                  styles.boxerOption,
                  blueBoxer === boxer &&
                    styles.blueSelected,
                ]}
                onPress={() => setBlueBoxer(boxer)}
              >
                <View
                  style={[
                    styles.avatar,
                    styles.blueAvatar,
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {boxer.charAt(0)}
                  </Text>
                </View>

                <Text style={styles.boxerName}>
                  {boxer}
                </Text>

                {blueBoxer === boxer && (
                  <Text style={styles.check}>
                    ✓
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* WEIGHT CATEGORY */}

        <Text style={styles.sectionTitle}>
          WEIGHT CATEGORY
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.horizontalScroll}
        >
          {weightCategories.map((category) => (
            <Pressable
              key={category}
              style={[
                styles.weightButton,
                weightCategory === category &&
                  styles.weightButtonActive,
              ]}
              onPress={() =>
                setWeightCategory(category)
              }
            >
              <Text
                style={[
                  styles.weightText,
                  weightCategory === category &&
                    styles.weightTextActive,
                ]}
              >
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ROUNDS */}

        <Text style={styles.sectionTitle}>
          NUMBER OF ROUNDS
        </Text>

        <View style={styles.roundsContainer}>
          {[3, 4, 6, 8, 10, 12].map(
            (number) => (
              <Pressable
                key={number}
                style={[
                  styles.roundButton,
                  rounds === number &&
                    styles.roundButtonActive,
                ]}
                onPress={() => setRounds(number)}
              >
                <Text
                  style={[
                    styles.roundText,
                    rounds === number &&
                      styles.roundTextActive,
                  ]}
                >
                  {number}
                </Text>

                <Text
                  style={[
                    styles.roundLabel,
                    rounds === number &&
                      styles.roundLabelActive,
                  ]}
                >
                  ROUNDS
                </Text>
              </Pressable>
            )
          )}
        </View>

        {/* MATCH SUMMARY */}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>
            MATCH SUMMARY
          </Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Red Corner
            </Text>

            <Text style={styles.summaryValue}>
              {redBoxer || 'Not selected'}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Blue Corner
            </Text>

            <Text style={styles.summaryValue}>
              {blueBoxer || 'Not selected'}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Weight
            </Text>

            <Text style={styles.summaryValue}>
              {weightCategory}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Rounds
            </Text>

            <Text style={styles.summaryValue}>
              {rounds}
            </Text>
          </View>
        </View>

        {/* START MATCH */}

        <Pressable
          style={[
            styles.startButton,
            (!redBoxer || !blueBoxer) &&
              styles.startButtonDisabled,
          ]}
          onPress={handleStartMatch}
        >
          <Text style={styles.startButtonText}>
            START MATCH
          </Text>

          <Text style={styles.startArrow}>
            →
          </Text>
        </Pressable>

        <Text style={styles.bottomNote}>
          Make sure both boxers are selected before
          starting the match.
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

  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
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

  headerSmall: {
    color: '#7D858F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 3,
  },

  headerSpacer: {
    width: 42,
  },

  /* SECTION */

  sectionTitle: {
    color: '#89919B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 11,
    marginTop: 4,
  },

  /* MATCH TYPE */

  typeRow: {
    flexDirection: 'row',
    marginBottom: 23,
  },

  typeButton: {
    flex: 1,
    height: 46,
    borderRadius: 11,
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#292F37',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  typeButtonActive: {
    backgroundColor: '#32191B',
    borderColor: '#E53935',
  },

  typeText: {
    color: '#7E8791',
    fontSize: 12,
    fontWeight: '800',
  },

  typeTextActive: {
    color: '#FFFFFF',
  },

  /* BOXER CARD */

  boxerCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#292F37',
  },

  cornerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  cornerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  redBackground: {
    backgroundColor: '#C62828',
  },

  blueBackground: {
    backgroundColor: '#1565C0',
  },

  cornerLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  cornerInfo: {
    marginLeft: 11,
  },

  cornerTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  cornerSubtitle: {
    color: '#737B85',
    fontSize: 10,
    marginTop: 3,
  },

  boxerList: {
    gap: 8,
  },

  boxerOption: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#252B32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  redSelected: {
    borderColor: '#C62828',
    backgroundColor: '#261618',
  },

  blueSelected: {
    borderColor: '#1565C0',
    backgroundColor: '#151F2D',
  },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  redAvatar: {
    backgroundColor: '#7F2020',
  },

  blueAvatar: {
    backgroundColor: '#124B8D',
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  boxerName: {
    color: '#DCE0E4',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10,
    flex: 1,
  },

  check: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  /* VS */

  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },

  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#292F37',
  },

  vsCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#171B21',
    borderWidth: 1,
    borderColor: '#30363E',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },

  vsText: {
    color: '#7E8791',
    fontSize: 9,
    fontWeight: '900',
  },

  /* WEIGHT */

  horizontalScroll: {
    marginBottom: 22,
  },

  weightButton: {
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#292F37',
    paddingHorizontal: 15,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    marginRight: 8,
  },

  weightButtonActive: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },

  weightText: {
    color: '#7D858F',
    fontSize: 10,
    fontWeight: '800',
  },

  weightTextActive: {
    color: '#FFFFFF',
  },

  /* ROUNDS */

  roundsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  roundButton: {
    width: '31%',
    height: 64,
    backgroundColor: '#15191F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#292F37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  roundButtonActive: {
    backgroundColor: '#32191B',
    borderColor: '#E53935',
  },

  roundText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  roundTextActive: {
    color: '#E53935',
  },

  roundLabel: {
    color: '#656D77',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },

  roundLabelActive: {
    color: '#FFFFFF',
  },

  /* SUMMARY */

  summaryCard: {
    backgroundColor: '#15191F',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#292F37',
    marginBottom: 16,
  },

  summaryTitle: {
    color: '#8A929C',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#22272E',
  },

  summaryLabel: {
    color: '#6F7781',
    fontSize: 10,
  },

  summaryValue: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  /* START */

  startButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  startButtonDisabled: {
    backgroundColor: '#4A2527',
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  startArrow: {
    color: '#FFFFFF',
    fontSize: 22,
    marginLeft: 12,
  },

  bottomNote: {
    color: '#555D67',
    textAlign: 'center',
    fontSize: 9,
    marginTop: 10,
    lineHeight: 14,
  },
});