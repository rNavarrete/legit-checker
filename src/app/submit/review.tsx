import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { PHOTO_SLOTS } from '@/domain/photo-slots';
import { submitDraft } from '@/lib/submissions';
import { isBackendConfigured } from '@/lib/supabase';
import { useSubmissionDraft } from '@/state/submission-draft';

export default function ReviewScreen() {
  const { draft, missing, reset } = useSubmissionDraft();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { details } = draft;

  const submit = async () => {
    setError(null);
    setProgress({ done: 0, total: PHOTO_SLOTS.length });
    try {
      const id = await submitDraft(draft, (done, total) => setProgress({ done, total }));
      reset();
      router.dismissAll();
      router.push({ pathname: '/submit/done', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setProgress(null);
    }
  };

  const facts = [
    ['Size', details.size],
    ['Colorway', details.colorway],
    ['From', details.purchaseSource],
  ].filter(([, value]) => value.trim() !== '');

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}
          {!isBackendConfigured && (
            <ThemedText type="small" themeColor="textSecondary">
              Submitting is off until the backend is configured.
            </ThemedText>
          )}
          <Button
            title={progress ? `Uploading ${progress.done} of ${progress.total}…` : 'Submit for legit check'}
            loading={progress !== null && progress.done === 0}
            disabled={missing.length > 0 || progress !== null || !isBackendConfigured}
            onPress={submit}
          />
        </View>
      }>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>
          {`${details.brand} ${details.model}`}
        </ThemedText>
        {facts.map(([label, value]) => (
          <ThemedText key={label} type="small" themeColor="textSecondary">
            {`${label}: ${value}`}
          </ThemedText>
        ))}
        {details.notes.trim() !== '' && <ThemedText type="small">{details.notes}</ThemedText>}
      </View>

      <View style={styles.grid}>
        {PHOTO_SLOTS.map((slot) => {
          const photo = draft.photos[slot.id];
          return (
            <View key={slot.id} style={styles.tileWrap}>
              <ThemedView type="backgroundElement" style={styles.tile}>
                {photo && <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
              </ThemedView>
              <ThemedText type="small">{slot.title}</ThemedText>
            </View>
          );
        })}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Once submitted, verifiers are assigned your check and vote without seeing each other’s calls.
        You’ll get the result when enough of them agree.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.one },
  title: { fontSize: 26, lineHeight: 32 },
  footer: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tileWrap: { width: '30%', flexGrow: 1, maxWidth: '32%', gap: Spacing.half },
  tile: { aspectRatio: 3 / 4, borderRadius: Spacing.two, overflow: 'hidden' },
});
