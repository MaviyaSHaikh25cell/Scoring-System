import React from 'react';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: {
            backgroundColor: '#080808',
          },
        }}
      >
        {/* AUTH */}
        <Stack.Screen name="index" />

        {/* ADMIN */}
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="boxer-management" />
        <Stack.Screen name="judge-management" />
        <Stack.Screen name="admin-match-review" />
        <Stack.Screen name="admin-profile" />

        {/* BOXER */}
        <Stack.Screen name="boxer-dashboard" />
        <Stack.Screen name="boxer-profile" />

        {/* MATCH SYSTEM */}
        <Stack.Screen name="create-match" />
        <Stack.Screen name="live-scoring" />
        <Stack.Screen name="match-summary" />
        <Stack.Screen name="history" />
        <Stack.Screen name="tournament-management" />

        {/* OTHER */}
        <Stack.Screen name="settings" />
        <Stack.Screen name="explore" />
      </Stack>

      <StatusBar style="light" />
    </ThemeProvider>
  );
}