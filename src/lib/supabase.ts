import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Backend: Supabase (Postgres + Auth + Storage).
 *
 * Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in `.env`
 * (see `.env.example`). Without them the app still runs, so the capture flow
 * can be tried, but submitting is disabled.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const PHOTO_BUCKET = 'submission-photos';

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isBackendConfigured = supabase !== null;

/**
 * Returns the signed-in user's id, signing in anonymously if needed.
 *
 * Anonymous sign-in keeps the first version friction-free (no account wall
 * before your first legit check). Supabase lets an anonymous user be upgraded
 * to an email or social account later, keeping their submissions and
 * reputation. Enable "Anonymous sign-ins" in the Supabase dashboard.
 */
export async function ensureSignedIn(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signIn, error } = await client.auth.signInAnonymously();
  if (error || !signIn.user) {
    throw new Error(error?.message ?? 'Could not sign in.');
  }
  return signIn.user.id;
}
