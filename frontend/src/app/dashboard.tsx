import React from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>WELCOME BACK</Text>
            <Text style={styles.title}>Boxing Dashboard</Text>
          </View>

          <View style={styles.profileCircle}>
            <Text style={styles.profileText}>A</Text>
          </View>
        </View>

        {/* LIVE MATCH */}
        <View style={styles.liveCard}>
          <View style={styles.liveHeader}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE NOW</Text>
            </View>

            <Text style={styles.liveRoundText}>ROUND 2 / 3</Text>
          </View>

          <Text style={styles.matchTitle}>Semi-Final Match</Text>

          <View style={styles.boxersRow}>
            {/* RED BOXER */}
            <View style={styles.boxer}>
              <View style={[styles.cornerCircle, styles.redCorner]}>
                <Text style={styles.cornerText}>R</Text>
              </View>

              <Text style={styles.boxerName}>ARJUN</Text>
              <Text style={styles.score}>19</Text>
            </View>

            <Text style={styles.vs}>VS</Text>

            {/* BLUE BOXER */}
            <View style={styles.boxer}>
              <View style={[styles.cornerCircle, styles.blueCorner]}>
                <Text style={styles.cornerText}>B</Text>
              </View>

              <Text style={styles.boxerName}>RAHUL</Text>
              <Text style={styles.score}>18</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {}}
          >
            <Text style={styles.continueText}>
              CONTINUE SCORING →
            </Text>
          </Pressable>
        </View>

        {/* TOURNAMENT OVERVIEW */}
        <Text style={styles.sectionTitle}>
          TOURNAMENT OVERVIEW
        </Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>03</Text>
            <Text style={styles.statLabel}>ONGOING</Text>
            <View style={styles.statIndicator} />
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>08</Text>
            <Text style={styles.statLabel}>UPCOMING</Text>
            <View style={styles.statIndicatorBlue} />
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>24</Text>
            <Text style={styles.statLabel}>COMPLETED</Text>
            <View style={styles.statIndicatorGreen} />
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>48</Text>
            <Text style={styles.statLabel}>BOXERS</Text>
            <View style={styles.statIndicatorYellow} />
          </View>
        </View>

        {/* JUDGES */}
        <View style={styles.infoRow}>
          <View>
            <Text style={styles.infoTitle}>JUDGES</Text>
            <Text style={styles.infoValue}>
              12 Active Judges
            </Text>
          </View>

          <Pressable
            onPress={() => {}}
            style={({ pressed }) => [
              styles.viewButton,
              pressed && styles.smallButtonPressed,
            ]}
          >
            <Text style={styles.viewButtonText}>VIEW</Text>
          </Pressable>
        </View>

        {/* QUICK ACTIONS */}
        <Text style={styles.sectionTitle}>
          QUICK ACTIONS
        </Text>

        <View style={styles.actionsRow}>
          {/* CREATE */}
          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/create-match')}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>+</Text>
            </View>

            <Text style={styles.actionTitle}>
              CREATE
            </Text>

            <Text style={styles.actionSubtitle}>
              New Match
            </Text>
          </Pressable>

          {/* HISTORY */}
          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => {}}
          >
            <View style={styles.actionIconBlue}>
              <Text style={styles.actionIconText}>≡</Text>
            </View>

            <Text style={styles.actionTitle}>
              HISTORY
            </Text>

            <Text style={styles.actionSubtitle}>
              View Matches
            </Text>
          </Pressable>
        </View>

        {/* RECENT MATCHES */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>
            RECENT MATCHES
          </Text>

          <Pressable onPress={() => {}}>
            <Text style={styles.seeAll}>SEE ALL</Text>
          </Pressable>
        </View>

        {/* MATCH 1 */}
        <View style={styles.matchItem}>
          <View
            style={[
              styles.smallCorner,
              styles.redCorner,
            ]}
          >
            <Text style={styles.smallCornerText}>
              R
            </Text>
          </View>

          <View style={styles.matchInfo}>
            <Text style={styles.matchNames}>
              Vikram vs Sameer
            </Text>

            <Text style={styles.matchDetails}>
              Lightweight • Final
            </Text>
          </View>

          <View style={styles.winBadge}>
            <Text style={styles.winText}>
              RED WIN
            </Text>
          </View>
        </View>

        {/* MATCH 2 */}
        <View style={styles.matchItem}>
          <View
            style={[
              styles.smallCorner,
              styles.blueCorner,
            ]}
          >
            <Text style={styles.smallCornerText}>
              B
            </Text>
          </View>

          <View style={styles.matchInfo}>
            <Text style={styles.matchNames}>
              Kabir vs Aman
            </Text>

            <Text style={styles.matchDetails}>
              Welterweight • Semi-Final
            </Text>
          </View>

          <View style={styles.winBadgeBlue}>
            <Text style={styles.winText}>
              BLUE WIN
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>

        {/* HOME */}
        <Pressable
          style={styles.navItem}
          onPress={() => {}}
        >
          <Text style={styles.navIconActive}>
            ⌂
          </Text>

          <Text style={styles.navTextActive}>
            Home
          </Text>
        </Pressable>

        {/* SETTINGS */}
        <Pressable
          style={styles.navItem}
          onPress={() => {}}
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

const styles = StyleSheet.create({
  /* SCREEN */

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

  /* HEADER */

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
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 4,
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  /* LIVE MATCH */

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
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 18,
    textAlign: 'center',
  },

  boxersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 20,
  },

  boxer: {
    alignItems: 'center',
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
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  boxerName: {
    color: '#C7CCD2',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  score: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 3,
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
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  /* GENERAL SECTION */

  sectionTitle: {
    color: '#8A929C',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 12,
  },

  /* STATISTICS */

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  statCard: {
    width: '48%',
    backgroundColor: '#15191F',
    borderRadius: 15,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#252B32',
  },

  statNumber: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
  },

  statLabel: {
    color: '#747C86',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 3,
  },

  statIndicator: {
    width: 22,
    height: 3,
    backgroundColor: '#E53935',
    marginTop: 10,
  },

  statIndicatorBlue: {
    width: 22,
    height: 3,
    backgroundColor: '#1976D2',
    marginTop: 10,
  },

  statIndicatorGreen: {
    width: 22,
    height: 3,
    backgroundColor: '#43A047',
    marginTop: 10,
  },

  statIndicatorYellow: {
    width: 22,
    height: 3,
    backgroundColor: '#F9A825',
    marginTop: 10,
  },

  /* JUDGES */

  infoRow: {
    backgroundColor: '#15191F',
    borderRadius: 15,
    padding: 16,
    borderWidth: 1,
    borderColor: '#252B32',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 26,
  },

  infoTitle: {
    color: '#7D858F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  infoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },

  viewButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#252B32',
  },

  viewButtonText: {
    color: '#E53935',
    fontSize: 9,
    fontWeight: '900',
  },

  /* QUICK ACTIONS */

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  actionCard: {
    width: '48%',
    backgroundColor: '#15191F',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: '#252B32',
  },

  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#32191B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  actionIconBlue: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#14243A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  actionIconText: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '700',
  },

  actionTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  actionSubtitle: {
    color: '#6F7781',
    fontSize: 10,
    marginTop: 3,
  },

  /* RECENT MATCHES */

  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  seeAll: {
    color: '#E53935',
    fontSize: 9,
    fontWeight: '900',
  },

  matchItem: {
    backgroundColor: '#15191F',
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: '#252B32',
    flexDirection: 'row',
    alignItems: 'center',
  },

  smallCorner: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  smallCornerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  matchInfo: {
    flex: 1,
    marginLeft: 11,
  },

  matchNames: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  matchDetails: {
    color: '#69717B',
    fontSize: 9,
    marginTop: 3,
  },

  winBadge: {
    backgroundColor: '#32191B',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
  },

  winBadgeBlue: {
    backgroundColor: '#14243A',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
  },

  winText: {
    color: '#D8DCE0',
    fontSize: 8,
    fontWeight: '900',
  },

  /* BOTTOM NAVIGATION */

  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: '#111419',
    borderTopWidth: 1,
    borderTopColor: '#252B32',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },

  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },

  navIcon: {
    color: '#626A74',
    fontSize: 21,
  },

  navIconActive: {
    color: '#E53935',
    fontSize: 21,
  },

  navText: {
    color: '#626A74',
    fontSize: 9,
    marginTop: 3,
  },

  navTextActive: {
    color: '#E53935',
    fontSize: 9,
    marginTop: 3,
    fontWeight: '800',
  },

  /* PRESS EFFECTS */

  buttonPressed: {
    opacity: 0.75,
  },

  smallButtonPressed: {
    opacity: 0.7,
  },

  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});