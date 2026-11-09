import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { PHOTO_SLOT_IDS } from '@/domain/photo-slots';
import { ensureSignedIn, PHOTO_BUCKET, supabase } from '@/lib/supabase';
import type { SubmissionDraft } from '@/state/submission-draft';

async function readPhotoBytes(uri: string): Promise<ArrayBuffer> {
  // On web the camera returns a data: URI; on iOS/Android a file:// path.
  if (Platform.OS === 'web') {
    return (await fetch(uri)).arrayBuffer();
  }
  return new File(uri).arrayBuffer();
}

const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim());

/**
 * Uploads a finished draft: creates the submission as a draft row, uploads
 * every photo, records them, then opens it for verification. The server
 * refuses to open a submission that is missing any required photo.
 */
export async function submitDraft(
  draft: SubmissionDraft,
  onProgress?: (done: number, total: number) => void
): Promise<string> {
  if (!supabase) {
    throw new Error('The backend is not configured yet, so this check can’t be submitted.');
  }
  const userId = await ensureSignedIn(supabase);
  const { details } = draft;

  const { data: submission, error: insertError } = await supabase
    .from('submissions')
    .insert({
      brand: details.brand.trim(),
      model: details.model.trim(),
      colorway: blankToNull(details.colorway),
      size: blankToNull(details.size),
      purchase_source: blankToNull(details.purchaseSource),
      notes: blankToNull(details.notes),
    })
    .select('id')
    .single();
  if (insertError) throw insertError;

  const submissionId: string = submission.id;
  const total = PHOTO_SLOT_IDS.length;
  const rows = [];

  for (const [index, slot] of PHOTO_SLOT_IDS.entries()) {
    const photo = draft.photos[slot];
    if (!photo) throw new Error(`Missing photo: ${slot}`);

    const path = `${userId}/${submissionId}/${slot}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, await readPhotoBytes(photo.uri), { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;

    rows.push({
      submission_id: submissionId,
      slot,
      storage_path: path,
      width: photo.width,
      height: photo.height,
      captured_in_app: true,
      captured_at: photo.capturedAt,
    });
    onProgress?.(index + 1, total);
  }

  const { error: photosError } = await supabase.from('submission_photos').insert(rows);
  if (photosError) throw photosError;

  const { error: openError } = await supabase.rpc('open_submission', {
    p_submission_id: submissionId,
  });
  if (openError) throw openError;

  return submissionId;
}
