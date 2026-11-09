import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getPhotoSlot, PHOTO_SLOTS, isPhotoSlotId } from '@/domain/photo-slots';
import { useSubmissionDraft, type CapturedPhoto } from '@/state/submission-draft';

/**
 * In-app camera for one photo slot. There is deliberately no "pick from
 * gallery" option: photos have to be taken live so they can't be lifted from
 * a listing or someone else's legit check.
 */
export default function CaptureScreen() {
  const params = useLocalSearchParams<{ slot: string }>();
  const slot = isPhotoSlotId(params.slot) ? getPhotoSlot(params.slot) : undefined;
  const { setPhoto, missing } = useSubmissionDraft();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<CapturedPhoto | null>(null);

  if (!slot) {
    return (
      <Centered>
        <ThemedText style={styles.light}>Unknown photo.</ThemedText>
        <Button title="Go back" onPress={() => router.back()} />
      </Centered>
    );
  }

  if (!permission) return <Centered />;

  if (!permission.granted) {
    return (
      <Centered>
        <ThemedText type="smallBold" style={[styles.light, styles.center]}>
          Legit Checker needs your camera to take the photos for your check.
        </ThemedText>
        {permission.canAskAgain ? (
          <Button title="Allow camera" onPress={requestPermission} />
        ) : (
          <ThemedText type="small" style={[styles.light, styles.center]}>
            Camera access is off. Turn it on in your device settings.
          </ThemedText>
        )}
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
      </Centered>
    );
  }

  const position = PHOTO_SLOTS.findIndex((s) => s.id === slot.id) + 1;

  const takePicture = async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.85, exif: false });
      setPreview({
        uri: picture.uri,
        width: picture.width,
        height: picture.height,
        capturedAt: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  };

  const usePhoto = () => {
    if (!preview) return;
    setPhoto(slot.id, preview);
    const next = missing.find((id) => id !== slot.id);
    if (next) {
      router.replace({ pathname: '/submit/capture', params: { slot: next } });
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.root}>
      {preview ? (
        <Image source={{ uri: preview.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : (
        <CameraView
          key={slot.id}
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setReady(true)}
        />
      )}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <ThemedText type="smallBold" style={styles.light}>
              Close
            </ThemedText>
          </Pressable>
          <ThemedText type="small" style={styles.light}>{`${position} of ${PHOTO_SLOTS.length}`}</ThemedText>
        </View>

        <View style={styles.guidance}>
          <ThemedText type="smallBold" style={[styles.light, styles.slotTitle]}>
            {slot.title}
          </ThemedText>
          <ThemedText type="small" style={styles.light}>
            {slot.guidance}
          </ThemedText>
        </View>

        <View style={styles.controls}>
          {preview ? (
            <View style={styles.previewButtons}>
              <View style={styles.flex}>
                <Button title="Retake" variant="secondary" onPress={() => setPreview(null)} />
              </View>
              <View style={styles.flex}>
                <Button title="Use photo" onPress={usePhoto} />
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Take ${slot.title} photo`}
              disabled={!ready || busy}
              onPress={takePicture}
              style={({ pressed }) => [styles.shutter, (pressed || busy || !ready) && { opacity: 0.6 }]}>
              <View style={styles.shutterInner} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function Centered({ children }: { children?: React.ReactNode }) {
  return (
    <SafeAreaView style={[styles.root, styles.centered]}>
      <View style={styles.centeredInner}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  light: { color: '#fff' },
  center: { textAlign: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  centeredInner: { gap: Spacing.three, padding: Spacing.four, width: '100%', maxWidth: 420 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  guidance: {
    marginHorizontal: Spacing.four,
    marginTop: 'auto',
    marginBottom: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: Spacing.one,
  },
  slotTitle: { fontSize: 18 },
  controls: { alignItems: 'center', paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
  previewButtons: { flexDirection: 'row', gap: Spacing.three, width: '100%', maxWidth: 480 },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },
});
