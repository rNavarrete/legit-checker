import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getPhotoSlot, PHOTO_SLOTS, type PhotoSlotId } from '@/domain/photo-slots';
import { useTheme } from '@/hooks/use-theme';
import { useSubmissionDraft } from '@/state/submission-draft';

const openCamera = (slot: PhotoSlotId) =>
  router.push({ pathname: '/submit/capture', params: { slot } });

export default function PhotosScreen() {
  const { draft, missing } = useSubmissionDraft();
  const theme = useTheme();
  const done = PHOTO_SLOTS.length - missing.length;
  const next = missing[0];

  return (
    <Screen
      footer={
        next ? (
          <Button title={`Shoot ${getPhotoSlot(next)?.title.toLowerCase()}`} onPress={() => openCamera(next)} />
        ) : (
          <Button title="Review and submit" onPress={() => router.push('/submit/review')} />
        )
      }>
      <ThemedText themeColor="textSecondary">
        {`${done} of ${PHOTO_SLOTS.length} photos. All of them are required, and they have to be taken in the app so verifiers can trust them.`}
      </ThemedText>

      <View style={styles.grid}>
        {PHOTO_SLOTS.map((slot) => {
          const photo = draft.photos[slot.id];
          return (
            <Pressable
              key={slot.id}
              accessibilityRole="button"
              accessibilityLabel={`${slot.title}: ${photo ? 'taken, tap to retake' : 'not taken yet'}`}
              onPress={() => openCamera(slot.id)}
              style={({ pressed }) => [styles.tileWrap, pressed && { opacity: 0.8 }]}>
              <ThemedView type="backgroundElement" style={styles.tile}>
                {photo ? (
                  <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.tileHint}>
                    Tap to shoot
                  </ThemedText>
                )}
              </ThemedView>
              <ThemedText type="smallBold" style={photo ? { color: theme.success } : undefined}>
                {photo ? `✓ ${slot.title}` : slot.title}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  tileWrap: { width: '30%', flexGrow: 1, maxWidth: '31%', gap: Spacing.one },
  tile: {
    aspectRatio: 3 / 4,
    borderRadius: Spacing.two,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileHint: { textAlign: 'center' },
});
