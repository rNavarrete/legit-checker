import type { Verdict } from '@/domain/consensus';
import { PHOTO_SLOT_IDS, type PhotoSlotId } from '@/domain/photo-slots';
import { ensureSignedIn, PHOTO_BUCKET, supabase } from '@/lib/supabase';

export type CheckPhoto = {
  id: string;
  slot: PhotoSlotId;
  url: string;
  width: number | null;
  height: number | null;
};

export type AssignedCheck = {
  submissionId: string;
  brand: string;
  model: string;
  colorway: string | null;
  size: string | null;
  purchaseSource: string | null;
  notes: string | null;
  photos: CheckPhoto[];
};

export type FlawTag = {
  id: string;
  label: string;
  description: string | null;
  typicalSlots: PhotoSlotId[];
};

/** A flaw pinned on a photo. Box values are fractions of the photo size. */
export type TaggedFlaw = {
  key: string;
  photoId: string;
  flawTagId: string;
  box: { x: number; y: number; w: number; h: number };
};

function client() {
  if (!supabase) throw new Error('The backend is not configured yet.');
  return supabase;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Gets the check assigned to the signed-in verifier, assigning a new one if
 * they don't have one. Returns null when nothing is waiting.
 */
export async function getAssignedCheck(): Promise<AssignedCheck | null> {
  const db = client();
  await ensureSignedIn(db);

  const { data: assignment, error } = await db.rpc('claim_next_assignment');
  if (error) throw error;
  // A function returning a null composite comes back as null or as all-null fields.
  const submissionId: string | null = assignment?.submission_id ?? null;
  if (!submissionId) return null;

  const { data: submission, error: subError } = await db
    .from('submissions')
    .select('id, brand, model, colorway, size, purchase_source, notes, submission_photos(id, slot, storage_path, width, height)')
    .eq('id', submissionId)
    .single();
  if (subError) throw subError;

  type PhotoRow = { id: string; slot: PhotoSlotId; storage_path: string; width: number | null; height: number | null };
  const rows = [...((submission.submission_photos ?? []) as PhotoRow[])].sort(
    (a, b) => PHOTO_SLOT_IDS.indexOf(a.slot) - PHOTO_SLOT_IDS.indexOf(b.slot)
  );

  const { data: signed, error: urlError } = await db.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_TTL_SECONDS
    );
  if (urlError) throw urlError;

  return {
    submissionId,
    brand: submission.brand,
    model: submission.model,
    colorway: submission.colorway,
    size: submission.size,
    purchaseSource: submission.purchase_source,
    notes: submission.notes,
    photos: rows.map((r, i) => ({
      id: r.id,
      slot: r.slot,
      url: signed?.[i]?.signedUrl ?? '',
      width: r.width,
      height: r.height,
    })),
  };
}

export async function getFlawTags(): Promise<FlawTag[]> {
  const { data, error } = await client()
    .from('flaw_tags')
    .select('id, label, description, typical_slots')
    .eq('approved', true)
    .order('label');
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    typicalSlots: t.typical_slots ?? [],
  }));
}

export async function castVote(input: {
  submissionId: string;
  verdict: Verdict;
  confidence: number;
  notes: string;
  flaws: TaggedFlaw[];
}): Promise<void> {
  const { error } = await client().rpc('cast_vote', {
    p_submission_id: input.submissionId,
    p_verdict: input.verdict,
    p_confidence: input.confidence,
    p_notes: input.notes,
    p_flaws: input.flaws.map((f) => ({
      photo_id: f.photoId,
      flaw_tag_id: f.flawTagId,
      box_x: f.box.x,
      box_y: f.box.y,
      box_w: f.box.w,
      box_h: f.box.h,
    })),
  });
  if (error) throw error;
}

export async function skipCheck(submissionId: string): Promise<void> {
  const { error } = await client().rpc('skip_assignment', { p_submission_id: submissionId });
  if (error) throw error;
}
