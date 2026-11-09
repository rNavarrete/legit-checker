import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { PHOTO_SLOTS } from '@/domain/photo-slots';
import { isBackendConfigured } from '@/lib/supabase';

const STEPS = [
  {
    title: 'Shoot the pair in the app',
    body: `${PHOTO_SLOTS.length} guided photos: every angle, the tags, under the insole and the box label.`,
  },
  {
    title: 'The community checks it',
    body: 'Verifiers vote blind, so nobody just follows the crowd. They point out the exact flaws they see.',
  },
  {
    title: 'Get a consensus',
    body: 'You get the result once enough verifiers agree, and you can read every review, including the ones that disagreed.',
  },
];

export default function HomeScreen() {
  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button title="Start a legit check" onPress={() => router.push('/submit')} />
          <Button title="Verify sneakers" variant="secondary" onPress={() => router.push('/verify')} />
        </View>
      }>
      <View style={styles.hero}>
        <ThemedText type="subtitle">Free legit checks, from people who know sneakers.</ThemedText>
        <ThemedText themeColor="textSecondary">
          Any brand, any model. No fees, no certificates. Just honest calls from the community.
        </ThemedText>
      </View>

      {STEPS.map((step, i) => (
        <ThemedView key={step.title} type="backgroundElement" style={styles.step}>
          <ThemedText type="smallBold" themeColor="accent">
            {`STEP ${i + 1}`}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.stepTitle}>
            {step.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {step.body}
          </ThemedText>
        </ThemedView>
      ))}

      {!isBackendConfigured && (
        <ThemedText type="small" themeColor="textSecondary">
          Dev note: the backend isn’t configured, so you can try the photo flow but not submit. See
          README.
        </ThemedText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two },
  hero: { gap: Spacing.two, marginBottom: Spacing.two },
  step: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  stepTitle: { fontSize: 17 },
});
