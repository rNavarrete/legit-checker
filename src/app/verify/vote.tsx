import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Verdict } from '@/domain/consensus';
import { useTheme } from '@/hooks/use-theme';
import { castVote } from '@/lib/verification';
import { useVerifySession } from '@/state/verify-session';

const VERDICTS: { id: Verdict; label: string; hint: string }[] = [
  { id: 'authentic', label: 'Authentic', hint: 'Everything checks out.' },
  { id: 'replica', label: 'Replica', hint: 'You see signs it’s not genuine.' },
  { id: 'cannot_tell', label: 'Can’t tell', hint: 'The photos aren’t enough to judge.' },
];

const CONFIDENCE = [1, 2, 3, 4, 5];

export default function VoteScreen() {
  const { check, flaws, tags } = useVerifySession();
  const theme = useTheme();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [confidence, setConfidence] = useState(3);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!check) {
    return (
      <Screen footer={<Button title="Back" onPress={() => router.back()} />}>
        <ThemedText>There’s no check to vote on.</ThemedText>
      </Screen>
    );
  }

  const flawSummary = Object.entries(
    flaws.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.flawTagId]: (acc[f.flawTagId] ?? 0) + 1 }), {})
  ).map(([id, n]) => `${tags.find((t) => t.id === id)?.label ?? id}${n > 1 ? ` ×${n}` : ''}`);

  const submit = async () => {
    if (!verdict) return;
    setSubmitting(true);
    setError(null);
    try {
      await castVote({ submissionId: check.submissionId, verdict, confidence, notes, flaws });
      // Stack is home > verify > vote; swap the vote screen for the thank-you.
      router.replace('/verify/done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your vote.');
      setSubmitting(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}
          <Button title="Cast vote" disabled={!verdict} loading={submitting} onPress={submit} />
        </View>
      }>
      <ThemedText type="smallBold">{`${check.brand} ${check.model}`}</ThemedText>

      <View style={styles.options}>
        {VERDICTS.map((option) => {
          const selected = verdict === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setVerdict(option.id)}
              style={[
                styles.option,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: selected ? theme.accent : 'transparent',
                },
              ]}>
              <ThemedText type="smallBold" style={styles.optionLabel}>
                {option.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {option.hint}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">How sure are you?</ThemedText>
        <View style={styles.scale}>
          {CONFIDENCE.map((n) => {
            const selected = confidence === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityLabel={`Confidence ${n} of 5`}
                accessibilityState={{ checked: selected }}
                onPress={() => setConfidence(n)}
                style={[styles.scaleItem, { backgroundColor: selected ? theme.accent : theme.backgroundElement }]}>
                <ThemedText type="smallBold" style={selected ? { color: theme.onAccent } : undefined}>
                  {n}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.scaleLegend}>
          <ThemedText type="small" themeColor="textSecondary">
            Guessing
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Certain
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Flaws you tagged</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {flawSummary.length ? flawSummary.join(', ') : 'None. Go back to the photos to tag any.'}
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold">Your review</ThemedText>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="What gave it away, or what convinced you? The owner reads this once the check settles."
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: Spacing.two },
  options: { gap: Spacing.two },
  option: { padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 2, gap: Spacing.half },
  optionLabel: { fontSize: 17 },
  section: { gap: Spacing.one },
  scale: { flexDirection: 'row', gap: Spacing.two },
  scaleItem: { flex: 1, height: 44, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  scaleLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  input: { minHeight: 110, borderRadius: Spacing.two, padding: Spacing.three, fontSize: 16, textAlignVertical: 'top' },
});
