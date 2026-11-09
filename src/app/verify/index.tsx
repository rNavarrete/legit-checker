import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getPhotoSlot } from '@/domain/photo-slots';
import { isBackendConfigured } from '@/lib/supabase';
import { skipCheck } from '@/lib/verification';
import { useVerifySession } from '@/state/verify-session';

export default function VerifyScreen() {
  const { status, error, check, flaws, load } = useVerifySession();
  const [skipping, setSkipping] = useState(false);

  // Always ask the server on entry: it returns the pending assignment if there
  // is one, so a vote cast earlier never shows the same pair again.
  useEffect(() => {
    if (isBackendConfigured) load();
  }, [load]);

  if (!isBackendConfigured) {
    return (
      <Message title="Verifying needs the backend" body="Set up Supabase (see the README) to get checks assigned." />
    );
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <Screen>
        <ActivityIndicator style={styles.spinner} />
      </Screen>
    );
  }

  if (status === 'error') {
    return <Message title="Couldn’t load a check" body={error ?? ''} action={<Button title="Try again" onPress={load} />} />;
  }

  if (status === 'empty' || !check) {
    return (
      <Message
        title="Nothing to check right now"
        body="Every open check already has enough verifiers on it. Come back in a bit."
        action={<Button title="Check again" variant="secondary" onPress={load} />}
      />
    );
  }

  const skip = async () => {
    setSkipping(true);
    try {
      await skipCheck(check.submissionId);
      await load();
    } finally {
      setSkipping(false);
    }
  };

  const facts = [check.size && `Size ${check.size}`, check.colorway, check.purchaseSource && `From ${check.purchaseSource}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button title="Make your call" onPress={() => router.push('/verify/vote')} />
          <Button title="Skip this pair" variant="secondary" loading={skipping} onPress={skip} />
        </View>
      }>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.title}>{`${check.brand} ${check.model}`}</ThemedText>
        {facts !== '' && (
          <ThemedText type="small" themeColor="textSecondary">
            {facts}
          </ThemedText>
        )}
        {check.notes && <ThemedText type="small">{`“${check.notes}”`}</ThemedText>}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Tap a photo to look closer and tag any flaws. Other verifiers can’t see your call, and you won’t see theirs
        until the check settles.
      </ThemedText>

      <View style={styles.grid}>
        {check.photos.map((photo, index) => {
          const count = flaws.filter((f) => f.photoId === photo.id).length;
          const title = getPhotoSlot(photo.slot)?.title ?? photo.slot;
          return (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={`${title} photo${count ? `, ${count} flaws tagged` : ''}`}
              onPress={() => router.push({ pathname: '/verify/photo', params: { index: String(index) } })}
              style={({ pressed }) => [styles.tileWrap, pressed && { opacity: 0.8 }]}>
              <ThemedView type="backgroundElement" style={styles.tile}>
                <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                {count > 0 && (
                  <View style={styles.badge}>
                    <ThemedText type="smallBold" style={styles.badgeText}>
                      {count}
                    </ThemedText>
                  </View>
                )}
              </ThemedView>
              <ThemedText type="small">{title}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

function Message({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <Screen footer={action}>
      <View style={styles.message}>
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText themeColor="textSecondary">{body}</ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  spinner: { marginTop: Spacing.six },
  message: { gap: Spacing.two, paddingTop: Spacing.five },
  actions: { gap: Spacing.two },
  header: { gap: Spacing.one },
  title: { fontSize: 26, lineHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tileWrap: { width: '30%', flexGrow: 1, maxWidth: '32%', gap: Spacing.half },
  tile: { aspectRatio: 3 / 4, borderRadius: Spacing.two, overflow: 'hidden' },
  badge: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, lineHeight: 16 },
});
