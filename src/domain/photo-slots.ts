/**
 * The required photo set for every legit check.
 *
 * Every submission must include one in-app photo for each slot below, so
 * verifiers always see the same angles and the photos form a consistent,
 * labeled dataset for training an authenticity model later.
 *
 * The `id` values are stored in the database (`photo_slot` enum in
 * supabase/migrations). Never rename an existing id; add new ones instead.
 */
export const PHOTO_SLOT_IDS = [
  'front',
  'back',
  'left_side',
  'right_side',
  'sole',
  'inside_tag',
  'size_tag',
  'insole_removed',
  'box_label',
] as const;

export type PhotoSlotId = (typeof PHOTO_SLOT_IDS)[number];

export type PhotoSlot = {
  id: PhotoSlotId;
  title: string;
  /** Short instruction shown over the camera. */
  guidance: string;
};

export const PHOTO_SLOTS: readonly PhotoSlot[] = [
  {
    id: 'front',
    title: 'Front',
    guidance: 'Toe box facing the camera, shoe centered, laces visible.',
  },
  {
    id: 'back',
    title: 'Back',
    guidance: 'Heel facing the camera. Get the heel tab and any logo sharp.',
  },
  {
    id: 'left_side',
    title: 'Outer side',
    guidance: 'Outside profile of the shoe, full length in frame.',
  },
  {
    id: 'right_side',
    title: 'Inner side',
    guidance: 'Inside (medial) profile of the shoe, full length in frame.',
  },
  {
    id: 'sole',
    title: 'Sole',
    guidance: 'Outsole flat to the camera, toe to heel in frame.',
  },
  {
    id: 'inside_tag',
    title: 'Inside tag',
    guidance: 'Tag inside the tongue or collar. Text must be readable.',
  },
  {
    id: 'size_tag',
    title: 'Size tag',
    guidance: 'Size tag with the style code and production dates readable.',
  },
  {
    id: 'insole_removed',
    title: 'Insole removed',
    guidance: 'Pull the insole out and shoot the stitching underneath.',
  },
  {
    id: 'box_label',
    title: 'Box label',
    guidance: 'Box label straight on, with style code, size and barcode readable.',
  },
];

export function getPhotoSlot(id: string): PhotoSlot | undefined {
  return PHOTO_SLOTS.find((slot) => slot.id === id);
}

export function isPhotoSlotId(id: unknown): id is PhotoSlotId {
  return typeof id === 'string' && (PHOTO_SLOT_IDS as readonly string[]).includes(id);
}

/** Slots that still need a photo, in capture order. */
export function missingSlots(captured: Partial<Record<PhotoSlotId, unknown>>): PhotoSlotId[] {
  return PHOTO_SLOT_IDS.filter((id) => !captured[id]);
}
