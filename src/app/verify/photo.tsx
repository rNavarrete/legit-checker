import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { boxAroundTap } from '@/domain/flaw-box';
import { getPhotoSlot } from '@/domain/photo-slots';
import { useTheme } from '@/hooks/use-theme';
import { useVerifySession } from '@/state/verify-session';

/**
 * One photo, large, with flaw tagging: pick a flaw type, then tap where it is.
 * Each tag becomes a labeled box on the photo (training data for the model).
 */
export default function PhotoScreen() {
  const params = useLocalSearchParams<{ index: string }>();
  const { check, tags, flaws, addFlaw, removeFlaw } = useVerifySession();
  const theme = useTheme();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const photoRef = useRef<ComponentRef<typeof View>>(null);

  const index = Number(params.index ?? 0);
  const photo = check?.photos[index];

  if (!check || !photo) {
    return (
      <Screen footer={<Button title="Back" onPress={() => router.back()} />}>
        <ThemedText>This photo isn’t available anymore.</ThemedText>
      </Screen>
    );
  }

  const slot = getPhotoSlot(photo.slot);
  const photoFlaws = flaws.filter((f) => f.photoId === photo.id);
  const tagLabel = (id: string) => tags.find((t) => t.id === id)?.label ?? id;
  // Tags that usually apply to this angle first, then the rest.
  const orderedTags = [...tags].sort(
    (a, b) => Number(b.typicalSlots.includes(photo.slot)) - Number(a.typicalSlots.includes(photo.slot))
  );
  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 3 / 4;

  const onTapPhoto = (e: GestureResponderEvent) => {
    if (!activeTag) return;
    const tagId = activeTag;
    // Page coordinates work the same on iOS, Android and web (locationX
    // isn't reliable on web), so measure the photo and work out the offset.
    const { pageX, pageY } = e.nativeEvent;
    photoRef.current?.measure((_x, _y, width, height, left, top) => {
      const tapX = (pageX - left) / width;
      const tapY = (pageY - top) / height;
      if (!Number.isFinite(tapX) || !Number.isFinite(tapY)) return;
      addFlaw({ photoId: photo.id, flawTagId: tagId, box: boxAroundTap(tapX, tapY, undefined, width / height) });
      setActiveTag(null);
    });
  };

  const go = (delta: number) =>
    router.setParams({ index: String((index + delta + check.photos.length) % check.photos.length) });

  return (
    <Screen
      footer={
        <View style={styles.nav}>
          <View style={styles.flex}>
            <Button title="Previous" variant="secondary" onPress={() => go(-1)} />
          </View>
          <View style={styles.flex}>
            <Button title="Next" variant="secondary" onPress={() => go(1)} />
          </View>
        </View>
      }>
      <Stack.Screen options={{ title: `${slot?.title ?? 'Photo'} (${index + 1} of ${check.photos.length})` }} />

      <Pressable
        accessibilityLabel={activeTag ? `Tap where the ${tagLabel(activeTag)} flaw is` : `${slot?.title} photo`}
        ref={photoRef}
        onPress={onTapPhoto}
        style={[styles.photo, { aspectRatio, backgroundColor: theme.backgroundElement }]}>
        <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} contentFit="fill" />
        {photoFlaws.map((flaw) => (
          <View
            key={flaw.key}
            pointerEvents="none"
            style={[
              styles.box,
              {
                left: `${flaw.box.x * 100}%`,
                top: `${flaw.box.y * 100}%`,
                width: `${flaw.box.w * 100}%`,
                height: `${flaw.box.h * 100}%`,
              },
            ]}>
            <View style={styles.boxLabelWrap}>
              <ThemedText type="smallBold" numberOfLines={1} style={styles.boxLabel}>
                {tagLabel(flaw.flawTagId)}
              </ThemedText>
            </View>
          </View>
        ))}
      </Pressable>

      <ThemedText type="smallBold">
        {activeTag ? `Now tap where the ${tagLabel(activeTag).toLowerCase()} problem is` : 'See a flaw? Pick what it is, then tap the spot.'}
      </ThemedText>
      <View style={styles.chips}>
        {orderedTags.map((tag) => {
          const selected = activeTag === tag.id;
          return (
            <Pressable
              key={tag.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setActiveTag(selected ? null : tag.id)}
              style={[
                styles.chip,
                { backgroundColor: selected ? theme.accent : theme.backgroundElement },
              ]}>
              <ThemedText type="small" style={selected ? { color: theme.onAccent } : undefined}>
                {tag.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {photoFlaws.length > 0 && (
        <View style={styles.tagged}>
          <ThemedText type="smallBold">Tagged on this photo</ThemedText>
          {photoFlaws.map((flaw) => (
            <View key={flaw.key} style={styles.taggedRow}>
              <ThemedText type="small">{tagLabel(flaw.flawTagId)}</ThemedText>
              <Pressable accessibilityRole="button" onPress={() => removeFlaw(flaw.key)} hitSlop={8}>
                <ThemedText type="smallBold" themeColor="danger">
                  Remove
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { flexDirection: 'row', gap: Spacing.three },
  photo: { width: '100%', borderRadius: Spacing.two, overflow: 'hidden' },
  box: { position: 'absolute', borderWidth: 2, borderColor: '#FF3B30', borderRadius: 4 },
  boxLabelWrap: { position: 'absolute', top: -22, left: -2, width: 160, alignItems: 'flex-start' },
  boxLabel: {
    backgroundColor: '#FF3B30',
    color: '#fff',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  tagged: { gap: Spacing.one },
  taggedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
