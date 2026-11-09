-- Legit Checker: initial schema
--
-- Covers the whole loop, even though the app only uses part of it so far:
--   submissions + the required photo set
--   blind, assigned verification votes
--   consensus (settles a submission once enough verifiers agree)
--   flaw tags pinned to photo regions (labels for a future vision model)
--   outcome reports + a reputation ledger for verifiers
--
-- Every sneaker model is accepted: brand and model are free text, never a
-- fixed list.

------------------------------------------------------------------------------
-- Types
------------------------------------------------------------------------------

-- Keep in sync with src/domain/photo-slots.ts. Only ever add values.
create type public.photo_slot as enum (
  'front',
  'back',
  'left_side',
  'right_side',
  'sole',
  'inside_tag',
  'size_tag',
  'insole_removed',
  'box_label'
);

create type public.submission_status as enum ('draft', 'collecting_votes', 'settled', 'withdrawn');
create type public.verdict as enum ('authentic', 'replica', 'cannot_tell');
create type public.consensus_verdict as enum ('authentic', 'replica', 'inconclusive');
create type public.assignment_status as enum ('pending', 'completed', 'expired', 'skipped');
create type public.outcome_kind as enum ('confirmed_authentic', 'confirmed_replica');
create type public.reputation_reason as enum (
  'agreed_with_consensus',
  'disagreed_with_consensus',
  'matched_outcome',
  'missed_outcome'
);

------------------------------------------------------------------------------
-- People
------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text,
  avatar_url text,
  -- Reputation is the sum of reputation_events.delta; cached here for ranking.
  reputation numeric not null default 0,
  verifications_count integer not null default 0,
  -- Votes that matched the settled consensus or a reported outcome.
  accurate_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Create a profile for every new auth user (anonymous users included).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Brands a verifier knows well. Used to route submissions, never to restrict them.
create table public.verifier_specialties (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  brand text not null check (length(trim(brand)) > 0),
  primary key (profile_id, brand)
);

create table public.badges (
  id text primary key,
  name text not null,
  description text not null
);

create table public.profile_badges (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  badge_id text not null references public.badges (id),
  awarded_at timestamptz not null default now(),
  primary key (profile_id, badge_id)
);

insert into public.badges (id, name, description) values
  ('first_check', 'First check', 'Cast your first verification vote.'),
  ('fifty_checks', '50 checks', 'Cast 50 verification votes.'),
  ('expert', 'Expert', 'High reputation across many settled checks.');

------------------------------------------------------------------------------
-- Submissions and photos
------------------------------------------------------------------------------

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  brand text not null check (length(trim(brand)) > 0),
  model text not null check (length(trim(model)) > 0),
  colorway text,
  size text,
  purchase_source text,
  notes text,
  status public.submission_status not null default 'draft',
  consensus public.consensus_verdict,
  -- Share of decisive votes that agreed with the consensus (0 to 1).
  agreement numeric,
  opened_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index submissions_open_idx on public.submissions (opened_at) where status = 'collecting_votes';
create index submissions_submitter_idx on public.submissions (submitter_id, created_at desc);

create table public.submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  slot public.photo_slot not null,
  -- Path inside the `submission-photos` storage bucket: <submitter_id>/<submission_id>/<slot>.jpg
  storage_path text not null,
  width integer,
  height integer,
  -- Always true today: the app only accepts photos taken with its own camera.
  captured_in_app boolean not null default true,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  unique (submission_id, slot)
);

------------------------------------------------------------------------------
-- Verification
------------------------------------------------------------------------------

-- Blind, assigned voting: verifiers are handed a submission and can only vote
-- on submissions assigned to them.
create table public.verification_assignments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  verifier_id uuid not null references public.profiles (id) on delete cascade,
  status public.assignment_status not null default 'pending',
  assigned_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  unique (submission_id, verifier_id)
);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  verifier_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  verdict public.verdict not null,
  confidence smallint not null check (confidence between 1 and 5),
  -- The written review. Shown to everyone once the check settles, so the
  -- submitter can read dissenting opinions.
  notes text,
  created_at timestamptz not null default now(),
  unique (submission_id, verifier_id)
);

-- Catalog of flaw types verifiers can tag. Generic on purpose (not tied to a
-- model) so it works for every sneaker. New tags can be proposed and approved.
create table public.flaw_tags (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  label text not null,
  description text,
  -- Slots where this flaw usually shows up; used to suggest tags, not to limit them.
  typical_slots public.photo_slot[] not null default '{}',
  approved boolean not null default false,
  proposed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.flaw_tags (id, label, description, typical_slots, approved) values
  ('stitching', 'Stitching', 'Uneven, loose, doubled or wrongly spaced stitching.', '{front,back,left_side,right_side,insole_removed}', true),
  ('shape', 'Shape', 'Toe box, heel or overall silhouette is off.', '{front,back,left_side,right_side}', true),
  ('logo', 'Logo', 'Logo size, placement, proportions or embroidery is off.', '{back,left_side,right_side,inside_tag}', true),
  ('font', 'Font / print', 'Wrong font, spacing or print quality on text.', '{inside_tag,size_tag,box_label}', true),
  ('material', 'Material', 'Leather, suede, mesh or rubber looks or reads wrong.', '{front,left_side,right_side,sole}', true),
  ('color', 'Color', 'Shade does not match the retail colorway.', '{front,back,left_side,right_side,sole}', true),
  ('glue', 'Glue stains', 'Excess or messy glue.', '{left_side,right_side,sole,insole_removed}', true),
  ('sole_pattern', 'Sole pattern', 'Tread pattern, stars or molding is off.', '{sole}', true),
  ('tag_details', 'Tag details', 'Wrong layout, dates or codes on a tag.', '{inside_tag,size_tag}', true),
  ('code_mismatch', 'Code mismatch', 'Style code or size differs between size tag and box label.', '{size_tag,box_label}', true),
  ('box', 'Box', 'Box construction, color or label layout is off.', '{box_label}', true),
  ('insole', 'Insole', 'Insole print, foam or the board underneath is off.', '{insole_removed}', true),
  ('photo_unclear', 'Photo unclear', 'Photo too blurry, dark or cropped to judge.', '{}', true);

-- A flaw a verifier pinned on a specific photo, optionally with a box around
-- it. Box coordinates are fractions of the photo size (0 to 1), so they survive
-- resizing. These rows are the training labels for the future vision model.
create table public.verification_flaws (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.verifications (id) on delete cascade,
  photo_id uuid not null references public.submission_photos (id) on delete cascade,
  flaw_tag_id text not null references public.flaw_tags (id),
  box_x real check (box_x between 0 and 1),
  box_y real check (box_y between 0 and 1),
  box_w real check (box_w between 0 and 1),
  box_h real check (box_h between 0 and 1),
  note text,
  created_at timestamptz not null default now(),
  check (
    (box_x is null and box_y is null and box_w is null and box_h is null)
    or (box_x is not null and box_y is not null and box_w is not null and box_h is not null)
  )
);

------------------------------------------------------------------------------
-- Outcomes and reputation
------------------------------------------------------------------------------

-- What actually happened to the pair after the check (e.g. a marketplace
-- authenticator ruled on it, or the seller refunded it as fake). This is the
-- strongest signal for verifier reputation. One report per submission.
create table public.outcome_reports (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.submissions (id) on delete cascade,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  outcome public.outcome_kind not null,
  evidence text,
  evidence_path text,
  created_at timestamptz not null default now()
);

-- Append-only ledger. profiles.reputation is the running sum.
create table public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  verification_id uuid references public.verifications (id) on delete cascade,
  reason public.reputation_reason not null,
  delta numeric not null,
  created_at timestamptz not null default now(),
  unique (verification_id, reason)
);

create index reputation_events_profile_idx on public.reputation_events (profile_id, created_at desc);

------------------------------------------------------------------------------
-- Consensus
------------------------------------------------------------------------------

-- Keep in sync with src/domain/consensus.ts.
create function public.compute_consensus(
  authentic_votes integer,
  replica_votes integer,
  min_votes integer default 5,
  max_votes integer default 9,
  supermajority numeric default 0.75
) returns table (settled boolean, verdict public.consensus_verdict, agreement numeric)
language plpgsql immutable as $$
declare
  decisive integer := authentic_votes + replica_votes;
  share numeric;
begin
  if decisive < min_votes then
    return query select false, null::public.consensus_verdict, null::numeric;
    return;
  end if;

  share := greatest(authentic_votes, replica_votes)::numeric / decisive;

  if share >= supermajority then
    return query select true,
      (case when authentic_votes > replica_votes then 'authentic' else 'replica' end)::public.consensus_verdict,
      share;
  elsif decisive >= max_votes then
    return query select true, 'inconclusive'::public.consensus_verdict, share;
  else
    return query select false, null::public.consensus_verdict, share;
  end if;
end;
$$;

create function public.add_reputation(
  p_profile_id uuid,
  p_submission_id uuid,
  p_verification_id uuid,
  p_reason public.reputation_reason,
  p_delta numeric,
  p_accurate boolean
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.reputation_events (profile_id, submission_id, verification_id, reason, delta)
  values (p_profile_id, p_submission_id, p_verification_id, p_reason, p_delta)
  on conflict (verification_id, reason) do nothing;

  if found then
    update public.profiles
    set reputation = reputation + p_delta,
        accurate_count = accurate_count + (case when p_accurate then 1 else 0 end)
    where id = p_profile_id;
  end if;
end;
$$;

-- After each vote: close the assignment, bump counts, and settle the
-- submission if consensus is reached.
create function public.on_verification_inserted() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  sub public.submissions;
  n_authentic integer;
  n_replica integer;
  result record;
  v public.verifications;
begin
  -- Lock the submission so concurrent votes settle it exactly once.
  select * into sub from public.submissions where id = new.submission_id for update;

  update public.verification_assignments
  set status = 'completed'
  where submission_id = new.submission_id and verifier_id = new.verifier_id;

  update public.profiles
  set verifications_count = verifications_count + 1
  where id = new.verifier_id;

  if sub.status <> 'collecting_votes' then
    return new;
  end if;

  select
    count(*) filter (where verdict = 'authentic'),
    count(*) filter (where verdict = 'replica')
  into n_authentic, n_replica
  from public.verifications
  where submission_id = new.submission_id;

  select * into result from public.compute_consensus(n_authentic, n_replica);

  if not result.settled then
    return new;
  end if;

  update public.submissions
  set status = 'settled', consensus = result.verdict, agreement = result.agreement, settled_at = now()
  where id = new.submission_id;

  -- Expire assignments nobody got to.
  update public.verification_assignments
  set status = 'expired'
  where submission_id = new.submission_id and status = 'pending';

  -- Small reputation nudge for agreeing with a clear consensus.
  if result.verdict <> 'inconclusive' then
    for v in
      select * from public.verifications
      where submission_id = new.submission_id and verdict <> 'cannot_tell'
    loop
      if v.verdict::text = result.verdict::text then
        perform public.add_reputation(v.verifier_id, v.submission_id, v.id, 'agreed_with_consensus', 1, true);
      else
        perform public.add_reputation(v.verifier_id, v.submission_id, v.id, 'disagreed_with_consensus', -1, false);
      end if;
    end loop;
  end if;

  return new;
end;
$$;

create trigger verification_inserted
  after insert on public.verifications
  for each row execute function public.on_verification_inserted();

-- A reported outcome outweighs consensus: it rewards verifiers who were right
-- even when the crowd was wrong.
create function public.on_outcome_reported() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  truth public.verdict := case new.outcome
    when 'confirmed_authentic' then 'authentic'::public.verdict
    else 'replica'::public.verdict
  end;
  v public.verifications;
begin
  for v in
    select * from public.verifications
    where submission_id = new.submission_id and verdict <> 'cannot_tell'
  loop
    if v.verdict = truth then
      perform public.add_reputation(v.verifier_id, v.submission_id, v.id, 'matched_outcome', 3, true);
    else
      perform public.add_reputation(v.verifier_id, v.submission_id, v.id, 'missed_outcome', -3, false);
    end if;
  end loop;
  return new;
end;
$$;

create trigger outcome_reported
  after insert on public.outcome_reports
  for each row execute function public.on_outcome_reported();

------------------------------------------------------------------------------
-- RPCs called by the app
------------------------------------------------------------------------------

-- Move a draft into the verification queue once every required photo is in.
create function public.open_submission(p_submission_id uuid) returns public.submissions
language plpgsql security definer set search_path = '' as $$
declare
  sub public.submissions;
  missing text[];
begin
  select * into sub from public.submissions
  where id = p_submission_id and submitter_id = auth.uid()
  for update;

  if not found then
    raise exception 'submission not found';
  end if;
  if sub.status <> 'draft' then
    return sub;
  end if;

  select array_agg(s::text) into missing
  from unnest(enum_range(null::public.photo_slot)) as s
  where not exists (
    select 1 from public.submission_photos p
    where p.submission_id = p_submission_id and p.slot = s
  );

  if missing is not null then
    raise exception 'missing photos: %', array_to_string(missing, ', ');
  end if;

  update public.submissions
  set status = 'collecting_votes', opened_at = now()
  where id = p_submission_id
  returning * into sub;

  return sub;
end;
$$;

-- Hand the caller the next submission to verify (blind assignment). Prefers
-- brands the verifier lists as specialties, then the oldest open check.
-- Returns the existing pending assignment if the caller already has one.
create function public.claim_next_assignment() returns public.verification_assignments
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  a public.verification_assignments;
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  select * into a from public.verification_assignments
  where verifier_id = me and status = 'pending' and expires_at > now()
  order by assigned_at
  limit 1;
  if found then
    return a;
  end if;

  insert into public.verification_assignments (submission_id, verifier_id)
  select s.id, me
  from public.submissions s
  where s.status = 'collecting_votes'
    and s.submitter_id <> me
    and not exists (
      select 1 from public.verification_assignments x
      where x.submission_id = s.id and x.verifier_id = me
    )
  order by
    exists (
      select 1 from public.verifier_specialties vs
      where vs.profile_id = me and lower(vs.brand) = lower(s.brand)
    ) desc,
    s.opened_at
  limit 1
  returning * into a;

  return a; -- null when nothing is waiting
end;
$$;

------------------------------------------------------------------------------
-- Row level security
------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.verifier_specialties enable row level security;
alter table public.badges enable row level security;
alter table public.profile_badges enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_photos enable row level security;
alter table public.verification_assignments enable row level security;
alter table public.verifications enable row level security;
alter table public.flaw_tags enable row level security;
alter table public.verification_flaws enable row level security;
alter table public.outcome_reports enable row level security;
alter table public.reputation_events enable row level security;

-- Public-ish reads (leaderboards, badges, tag catalog).
create policy "profiles are readable" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Reputation and counts are only changed by the triggers above.
revoke update on public.profiles from authenticated;
grant update (username, display_name, avatar_url) on public.profiles to authenticated;

create policy "specialties are readable" on public.verifier_specialties for select to authenticated using (true);
create policy "manage own specialties" on public.verifier_specialties for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "badges are readable" on public.badges for select to authenticated using (true);
create policy "profile badges are readable" on public.profile_badges for select to authenticated using (true);

create policy "approved flaw tags are readable" on public.flaw_tags for select to authenticated
  using (approved or proposed_by = auth.uid());
create policy "propose flaw tags" on public.flaw_tags for insert to authenticated
  with check (proposed_by = auth.uid() and approved = false);

-- Submissions: anyone signed in can see open and settled checks; drafts are private.
create policy "read submissions" on public.submissions for select to authenticated
  using (status <> 'draft' or submitter_id = auth.uid());
create policy "create own submission" on public.submissions for insert to authenticated
  with check (submitter_id = auth.uid() and status = 'draft');
create policy "edit own draft" on public.submissions for update to authenticated
  using (submitter_id = auth.uid() and status = 'draft')
  with check (submitter_id = auth.uid() and status in ('draft', 'withdrawn'));
create policy "delete own draft" on public.submissions for delete to authenticated
  using (submitter_id = auth.uid() and status = 'draft');

create policy "read photos" on public.submission_photos for select to authenticated
  using (exists (
    select 1 from public.submissions s
    where s.id = submission_id and (s.status <> 'draft' or s.submitter_id = auth.uid())
  ));
create policy "add photos to own draft" on public.submission_photos for insert to authenticated
  with check (exists (
    select 1 from public.submissions s
    where s.id = submission_id and s.submitter_id = auth.uid() and s.status = 'draft'
  ));
create policy "replace photos on own draft" on public.submission_photos for update to authenticated
  using (exists (
    select 1 from public.submissions s
    where s.id = submission_id and s.submitter_id = auth.uid() and s.status = 'draft'
  ));

-- Assignments are created by claim_next_assignment(); verifiers see their own.
create policy "read own assignments" on public.verification_assignments for select to authenticated
  using (verifier_id = auth.uid());
create policy "skip own assignment" on public.verification_assignments for update to authenticated
  using (verifier_id = auth.uid()) with check (verifier_id = auth.uid() and status = 'skipped');

-- Blind voting: you see your own vote; everyone sees all votes once settled.
create policy "read votes" on public.verifications for select to authenticated
  using (
    verifier_id = auth.uid()
    or exists (select 1 from public.submissions s where s.id = submission_id and s.status = 'settled')
  );
create policy "vote on assigned submission" on public.verifications for insert to authenticated
  with check (
    verifier_id = auth.uid()
    and exists (
      select 1 from public.verification_assignments a
      join public.submissions s on s.id = a.submission_id
      where a.submission_id = verifications.submission_id
        and a.verifier_id = auth.uid()
        and a.status = 'pending'
        and a.expires_at > now()
        and s.status = 'collecting_votes'
    )
  );

create policy "read flaws" on public.verification_flaws for select to authenticated
  using (exists (
    select 1 from public.verifications v
    where v.id = verification_id
      and (
        v.verifier_id = auth.uid()
        or exists (select 1 from public.submissions s where s.id = v.submission_id and s.status = 'settled')
      )
  ));
create policy "tag flaws on own pending vote" on public.verification_flaws for insert to authenticated
  with check (exists (
    select 1 from public.verifications v
    join public.submissions s on s.id = v.submission_id
    join public.submission_photos p on p.id = photo_id and p.submission_id = v.submission_id
    where v.id = verification_id and v.verifier_id = auth.uid() and s.status = 'collecting_votes'
  ));

create policy "read outcomes" on public.outcome_reports for select to authenticated using (true);
create policy "submitter reports outcome" on public.outcome_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id and s.submitter_id = auth.uid() and s.status = 'settled'
    )
  );

create policy "read own reputation events" on public.reputation_events for select to authenticated
  using (profile_id = auth.uid());

revoke execute on function public.add_reputation from public, anon, authenticated;

------------------------------------------------------------------------------
-- Storage
------------------------------------------------------------------------------

-- Private bucket. Paths are <submitter_id>/<submission_id>/<slot>.jpg
insert into storage.buckets (id, name, public)
values ('submission-photos', 'submission-photos', false)
on conflict (id) do nothing;

create policy "upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'submission-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "overwrite own uploads" on storage.objects for update to authenticated
  using (bucket_id = 'submission-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "signed-in users read submission photos" on storage.objects for select to authenticated
  using (bucket_id = 'submission-photos');
