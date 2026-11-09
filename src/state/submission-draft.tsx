import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { missingSlots, type PhotoSlotId } from '@/domain/photo-slots';

export type CapturedPhoto = {
  uri: string;
  width: number;
  height: number;
  capturedAt: string;
};

export type SneakerDetails = {
  brand: string;
  model: string;
  colorway: string;
  size: string;
  purchaseSource: string;
  notes: string;
};

export type SubmissionDraft = {
  details: SneakerDetails;
  photos: Partial<Record<PhotoSlotId, CapturedPhoto>>;
};

const emptyDraft = (): SubmissionDraft => ({
  details: { brand: '', model: '', colorway: '', size: '', purchaseSource: '', notes: '' },
  photos: {},
});

type DraftContextValue = {
  draft: SubmissionDraft;
  setDetails: (details: SneakerDetails) => void;
  setPhoto: (slot: PhotoSlotId, photo: CapturedPhoto) => void;
  missing: PhotoSlotId[];
  reset: () => void;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function SubmissionDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<SubmissionDraft>(emptyDraft);

  const setDetails = useCallback((details: SneakerDetails) => {
    setDraft((d) => ({ ...d, details }));
  }, []);

  const setPhoto = useCallback((slot: PhotoSlotId, photo: CapturedPhoto) => {
    setDraft((d) => ({ ...d, photos: { ...d.photos, [slot]: photo } }));
  }, []);

  const reset = useCallback(() => setDraft(emptyDraft()), []);

  const value = useMemo(
    () => ({ draft, setDetails, setPhoto, reset, missing: missingSlots(draft.photos) }),
    [draft, setDetails, setPhoto, reset]
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useSubmissionDraft() {
  const value = useContext(DraftContext);
  if (!value) throw new Error('useSubmissionDraft must be used inside SubmissionDraftProvider');
  return value;
}
