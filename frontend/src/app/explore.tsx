import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Explore</Text>
        <Text style={styles.subtitle}>
          Boxing Scoring System
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About the App</Text>
          <Text style={styles.cardText}>
            Manage boxing matches, score live rounds, manage judges,
            view match history, and maintain boxer profiles.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Features</Text>

          <Text style={styles.feature}>• Create and manage matches</Text>
          <Text style={styles.feature}>• Live round scoring</Text>
          <Text style={styles.feature}>• Match summaries</Text>
          <Text style={styles.feature}>• Judge management</Text>
          <Text style={styles.feature}>• Boxer profiles</Text>
          <Text style={styles.feature}>• Match history</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#151515',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#242424',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 15,
    lineHeight: 23,
    color: '#B5B5B5',
  },
  feature: {
    fontSize: 15,
    color: '#D0D0D0',
    marginBottom: 10,
  },
});