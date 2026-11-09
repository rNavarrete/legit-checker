import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  getAssignedCheck,
  getFlawTags,
  type AssignedCheck,
  type FlawTag,
  type TaggedFlaw,
} from '@/lib/verification';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

type VerifySessionValue = {
  status: Status;
  error: string | null;
  check: AssignedCheck | null;
  tags: FlawTag[];
  flaws: TaggedFlaw[];
  /** Load the verifier's assigned check (or get a new one). */
  load: () => Promise<void>;
  addFlaw: (flaw: Omit<TaggedFlaw, 'key'>) => void;
  removeFlaw: (key: string) => void;
};

const VerifySessionContext = createContext<VerifySessionValue | null>(null);

let nextKey = 0;

export function VerifySessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<AssignedCheck | null>(null);
  const [tags, setTags] = useState<FlawTag[]>([]);
  const [flaws, setFlaws] = useState<TaggedFlaw[]>([]);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    setFlaws([]);
    try {
      const [assigned, flawTags] = await Promise.all([getAssignedCheck(), getFlawTags()]);
      setCheck(assigned);
      setTags(flawTags);
      setStatus(assigned ? 'ready' : 'empty');
    } catch (e) {
      setCheck(null);
      setError(e instanceof Error ? e.message : 'Could not load a check.');
      setStatus('error');
    }
  }, []);

  const addFlaw = useCallback((flaw: Omit<TaggedFlaw, 'key'>) => {
    nextKey += 1;
    setFlaws((current) => [...current, { ...flaw, key: `flaw-${nextKey}` }]);
  }, []);

  const removeFlaw = useCallback((key: string) => {
    setFlaws((current) => current.filter((f) => f.key !== key));
  }, []);

  const value = useMemo(
    () => ({ status, error, check, tags, flaws, load, addFlaw, removeFlaw }),
    [status, error, check, tags, flaws, load, addFlaw, removeFlaw]
  );

  return <VerifySessionContext.Provider value={value}>{children}</VerifySessionContext.Provider>;
}

export function useVerifySession() {
  const value = useContext(VerifySessionContext);
  if (!value) throw new Error('useVerifySession must be used inside VerifySessionProvider');
  return value;
}
