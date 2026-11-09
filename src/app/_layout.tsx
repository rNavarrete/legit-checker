import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SubmissionDraftProvider } from '@/state/submission-draft';
import { VerifySessionProvider } from '@/state/verify-session';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SubmissionDraftProvider>
        <VerifySessionProvider>
        <Stack screenOptions={{ headerBackTitle: 'Back' }}>
          <Stack.Screen name="index" options={{ title: 'Legit Checker' }} />
          <Stack.Screen name="submit/index" options={{ title: 'New legit check' }} />
          <Stack.Screen name="submit/photos" options={{ title: 'Photos' }} />
          <Stack.Screen
            name="submit/capture"
            options={{ headerShown: false, presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="submit/review" options={{ title: 'Review' }} />
          <Stack.Screen name="submit/done" options={{ title: 'Submitted', headerBackVisible: false }} />
          <Stack.Screen name="verify/index" options={{ title: 'Verify' }} />
          <Stack.Screen name="verify/photo" options={{ title: 'Photo' }} />
          <Stack.Screen name="verify/vote" options={{ title: 'Your call' }} />
          <Stack.Screen name="verify/done" options={{ title: 'Vote cast', headerBackVisible: false }} />
        </Stack>
        <StatusBar style="auto" />
        </VerifySessionProvider>
      </SubmissionDraftProvider>
    </ThemeProvider>
  );
}
