-- cast_vote() and skip_assignment(): the calls the verifier screens use.
\set ON_ERROR_STOP 1

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000b0'), -- submitter
  ('00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000b3'),
  ('00000000-0000-0000-0000-0000000000b4'),
  ('00000000-0000-0000-0000-0000000000b5'),
  ('00000000-0000-0000-0000-0000000000b6');

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;

set role authenticated;

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b0');
insert into public.submissions (id, brand, model)
values ('22222222-2222-2222-2222-222222222222', 'Asics', 'Gel-Kayano 14');
insert into public.submission_photos (submission_id, slot, storage_path)
select '22222222-2222-2222-2222-222222222222', s, 'x/' || s || '.jpg'
from unnest(enum_range(null::public.photo_slot)) as s;
select public.open_submission('22222222-2222-2222-2222-222222222222');

-- Can't vote without an assignment.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.cast_vote('22222222-2222-2222-2222-222222222222', 'authentic', 3::smallint);
  raise exception 'expected cast_vote without assignment to fail';
exception when others then
  assert sqlerrm like 'this check is not assigned%', 'unexpected error: ' || sqlerrm;
end $$;

-- Skipping: verifier b1 passes, and the check doesn't come back to them.
do $$ begin
  assert (public.claim_next_assignment()).submission_id = '22222222-2222-2222-2222-222222222222';
  perform public.skip_assignment('22222222-2222-2222-2222-222222222222');
  assert (public.claim_next_assignment()).id is null, 'a skipped check must not come back';
end $$;

-- A flaw on a photo from another submission is rejected, and no vote is left behind.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
do $$ begin
  perform public.claim_next_assignment();
  perform public.cast_vote('22222222-2222-2222-2222-222222222222', 'replica', 4::smallint, null,
    jsonb_build_array(jsonb_build_object('photo_id', gen_random_uuid(), 'flaw_tag_id', 'stitching')));
  raise exception 'expected bad flaw to fail';
exception when others then
  assert sqlerrm like 'a flaw points at%', 'unexpected error: ' || sqlerrm;
end $$;
do $$ begin
  assert (select count(*) from public.verifications
          where submission_id = '22222222-2222-2222-2222-222222222222') = 0, 'no vote should be saved';
end $$;

-- Five votes; the fifth (which settles the check) carries flaw tags.
create function pg_temp.vote(uid text, v public.verdict, flaws jsonb) returns void language plpgsql as $$
begin
  perform pg_temp.act_as(uid);
  perform public.claim_next_assignment();
  perform public.cast_vote('22222222-2222-2222-2222-222222222222', v, 4::smallint, '  ', flaws);
end $$;

select pg_temp.vote('00000000-0000-0000-0000-0000000000b2', 'replica', '[]');
select pg_temp.vote('00000000-0000-0000-0000-0000000000b3', 'replica', '[]');
select pg_temp.vote('00000000-0000-0000-0000-0000000000b4', 'replica', '[]');
select pg_temp.vote('00000000-0000-0000-0000-0000000000b5', 'authentic', '[]');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000b6');
select public.claim_next_assignment();
select public.cast_vote(
  '22222222-2222-2222-2222-222222222222', 'replica', 5::smallint, 'Heel shape is off',
  (select jsonb_agg(jsonb_build_object(
      'photo_id', p.id, 'flaw_tag_id', t.tag,
      'box_x', 0.4, 'box_y', 0.5, 'box_w', 0.15, 'box_h', 0.15, 'note', 'here'))
   from public.submission_photos p
   cross join (values ('shape'), ('stitching')) as t(tag)
   where p.submission_id = '22222222-2222-2222-2222-222222222222' and p.slot = 'back'));

do $$
declare s public.submissions;
begin
  select * into s from public.submissions where id = '22222222-2222-2222-2222-222222222222';
  assert s.status = 'settled' and s.consensus = 'replica', 'should settle as replica at 4 of 5';
  assert (select count(*) from public.verification_flaws f
          join public.verifications v on v.id = f.verification_id
          where v.submission_id = s.id) = 2, 'flaws on the settling vote must be saved';
  assert (select count(*) from public.verifications where submission_id = s.id and notes is null) = 4,
    'blank notes are stored as null';
end $$;

\echo 'verifier_flow: ok'
