-- End-to-end check of the schema: draft -> photos -> open -> blind votes ->
-- consensus -> reputation -> outcome report.
\set ON_ERROR_STOP 1

insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), -- submitter
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003'),
  ('00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005'),
  ('00000000-0000-0000-0000-000000000006');

do $$ begin
  assert (select count(*) from public.profiles) = 7, 'a profile is created for each user';
end $$;

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;

set role authenticated;

-- Submitter creates a draft with any model they like (free text).
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.submissions (id, brand, model, colorway, size)
values ('11111111-1111-1111-1111-111111111111', 'New Balance', '990v6 Made in USA', 'Grey', '10.5');

insert into public.submission_photos (submission_id, slot, storage_path)
select '11111111-1111-1111-1111-111111111111', s,
  '00000000-0000-0000-0000-00000000000a/11111111-1111-1111-1111-111111111111/' || s || '.jpg'
from unnest(enum_range(null::public.photo_slot)) as s
where s <> 'box_label';

-- Can't open with a photo missing.
do $$ begin
  perform public.open_submission('11111111-1111-1111-1111-111111111111');
  raise exception 'expected open_submission to fail';
exception when others then
  assert sqlerrm like 'missing photos: box_label%', 'unexpected error: ' || sqlerrm;
end $$;

-- Drafts are invisible to others.
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
do $$ begin
  assert (select count(*) from public.submissions) = 0, 'drafts must be private';
end $$;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.submission_photos (submission_id, slot, storage_path)
values ('11111111-1111-1111-1111-111111111111', 'box_label', 'x/box_label.jpg');
do $$ begin
  assert (public.open_submission('11111111-1111-1111-1111-111111111111')).status = 'collecting_votes';
end $$;

-- Submitter can't be assigned their own check.
do $$ begin
  assert (public.claim_next_assignment()).id is null, 'submitter must not get own check';
end $$;

-- Voting without an assignment is rejected.
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
do $$ begin
  insert into public.verifications (submission_id, verdict, confidence)
  values ('11111111-1111-1111-1111-111111111111', 'authentic', 4);
  raise exception 'expected vote without assignment to fail';
exception when insufficient_privilege then null;
end $$;

-- Five verifiers: four say authentic, one says replica.
create function pg_temp.vote(uid text, v public.verdict) returns void language plpgsql as $$
declare a public.verification_assignments;
begin
  perform pg_temp.act_as(uid);
  a := public.claim_next_assignment();
  assert a.submission_id = '11111111-1111-1111-1111-111111111111', 'verifier should be assigned the open check';
  insert into public.verifications (submission_id, verdict, confidence, notes)
  values (a.submission_id, v, 4, 'looks ' || v);
end $$;

select pg_temp.vote('00000000-0000-0000-0000-000000000001', 'authentic');

-- Blind: verifier 2 can't see verifier 1's vote while votes are open.
select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
do $$ begin
  assert (select count(*) from public.verifications) = 0, 'votes must be blind until settled';
end $$;

-- A flaw tag pinned to a photo region (training label).
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
insert into public.verification_flaws (verification_id, photo_id, flaw_tag_id, box_x, box_y, box_w, box_h)
select v.id, p.id, 'stitching', 0.1, 0.2, 0.3, 0.1
from public.verifications v
join public.submission_photos p on p.submission_id = v.submission_id and p.slot = 'left_side';

select pg_temp.vote('00000000-0000-0000-0000-000000000002', 'authentic');
select pg_temp.vote('00000000-0000-0000-0000-000000000003', 'cannot_tell');
select pg_temp.vote('00000000-0000-0000-0000-000000000004', 'authentic');
select pg_temp.vote('00000000-0000-0000-0000-000000000005', 'replica');

do $$ begin
  assert (select status from public.submissions) = 'collecting_votes', '4 decisive votes is not enough';
end $$;

select pg_temp.vote('00000000-0000-0000-0000-000000000006', 'authentic');

do $$
declare s public.submissions;
begin
  select * into s from public.submissions;
  assert s.status = 'settled', 'should settle at 4 of 5';
  assert s.consensus = 'authentic';
  assert s.agreement = 0.8;
  -- Once settled, everyone can read every review, including the dissent.
  assert (select count(*) from public.verifications) = 6;
  assert (select count(*) from public.verification_flaws) = 1;
end $$;

-- Reputation and counts can't be edited by users.
do $$ begin
  update public.profiles set reputation = 1000 where id = auth.uid();
  raise exception 'expected reputation update to fail';
exception when insufficient_privilege then null;
end $$;

reset role;
do $$ begin
  assert (select reputation from public.profiles where id = '00000000-0000-0000-0000-000000000001') = 1;
  assert (select reputation from public.profiles where id = '00000000-0000-0000-0000-000000000003') = 0, 'cannot_tell is neutral';
  assert (select reputation from public.profiles where id = '00000000-0000-0000-0000-000000000005') = -1;
  assert (select verifications_count from public.profiles where id = '00000000-0000-0000-0000-000000000003') = 1;
end $$;

-- The submitter later learns the pair was fake. The lone dissenter comes out ahead.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.outcome_reports (submission_id, outcome, evidence)
values ('11111111-1111-1111-1111-111111111111', 'confirmed_replica', 'Marketplace authenticator rejected it');

reset role;
do $$ begin
  assert (select reputation from public.profiles where id = '00000000-0000-0000-0000-000000000001') = -2;
  assert (select reputation from public.profiles where id = '00000000-0000-0000-0000-000000000005') = 2;
end $$;

\echo 'submission_flow: ok'
