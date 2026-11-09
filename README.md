# Legit Checker

A free, community-driven app for legit checking sneakers. You shoot a fixed set
of photos in the app, verifiers from the community vote blind, and you get a
consensus result plus every written review, including the dissenting ones.

Built with React Native and Expo, so one codebase runs on iOS, Android and the
web. The backend is Supabase (Postgres, auth and photo storage).

## What's here so far

- **Submission flow** (`src/app/submit/`): sneaker details (any brand, any
  model, free text), then nine required photos taken with the in-app camera
  (front, back, outer side, inner side, sole, inside tag, size tag, insole
  removed, box label), then review and submit. There's no gallery upload on
  purpose: live photos can't be lifted from a listing.
- **Data model** (`supabase/migrations/0001_initial_schema.sql`) for the whole
  loop, not just submissions:
  - `submissions`, `submission_photos`: one row per required photo slot.
  - `verification_assignments`, `verifications`: blind, assigned voting.
    Verifiers can only vote on checks handed to them by
    `claim_next_assignment()`, and nobody sees other votes until the check
    settles.
  - Consensus: settles at 5 decisive votes when at least 75% agree (4 of 5).
    Split checks pull in more verifiers, up to 9, then settle as
    inconclusive. Logic lives in `public.compute_consensus` and is mirrored in
    `src/domain/consensus.ts`.
  - `flaw_tags`, `verification_flaws`: verifiers pin flaws to a photo, with an
    optional box around the spot. These are the labels for training an
    authenticity model later.
  - `outcome_reports`, `reputation_events`, `profiles.reputation`: verifiers
    gain reputation for agreeing with a clear consensus (+1) and much more
    for matching what actually happened to the pair (+3), so a lone dissenter
    who was right comes out ahead.
  - `verifier_specialties`, `badges`: brand specialties for routing (never
    restrictions) and badges for gamification.

Not built yet: the verifier screens, results screen, profiles and
leaderboards. The schema already supports them.

## Run it

```bash
npm install
cp .env.example .env   # fill in your Supabase URL and anon key
npx expo start         # press i, a or w for iOS, Android or web
```

Without a `.env` the app still runs and you can try the photo flow; only the
final submit is disabled. The camera needs a real device (or a webcam on web).

## Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/migrations/0001_initial_schema.sql` in the SQL editor, or
   use the Supabase CLI: `supabase link` then `supabase db push`.
3. Turn on **Authentication > Sign In / Providers > Anonymous sign-ins**. The
   app signs people in anonymously so there's no account wall before the
   first check. Anonymous users can be upgraded to a real account later and
   keep their history.
4. Copy the project URL and anon key into `.env`.

## Checks

```bash
npm run typecheck
npm test          # unit tests (consensus rules)
npm run test:db   # runs the migration + an end-to-end SQL test on a throwaway Postgres
```

`test:db` needs Postgres binaries installed locally (`initdb`, `pg_ctl`,
`psql`) and must run as a non-root user. CI runs all three on every pull
request.
