import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { SubmissionDraftProvider } from '@/state/submission-draft';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SubmissionDraftProvider>
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
        </Stack>
        <StatusBar style="auto" />
      </SubmissionDraftProvider>
    </ThemeProvider>
  );
}
