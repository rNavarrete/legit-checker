-- Cast a vote and its flaw tags in one transaction.
--
-- Inserting the vote and then the flaws as separate calls breaks on the vote
-- that settles a check: the submission flips to 'settled' as soon as the vote
-- lands, and the flaw insert policy only allows tagging while votes are open.
-- This RPC does both at once and applies the same rules as the RLS policies.

create function public.cast_vote(
  p_submission_id uuid,
  p_verdict public.verdict,
  p_confidence smallint,
  p_notes text default null,
  -- [{ "photo_id": uuid, "flaw_tag_id": text, "box_x": real, "box_y": real,
  --    "box_w": real, "box_h": real, "note": text }]
  p_flaws jsonb default '[]'::jsonb
) returns public.verifications
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v public.verifications;
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  perform 1
  from public.verification_assignments a
  join public.submissions s on s.id = a.submission_id
  where a.submission_id = p_submission_id
    and a.verifier_id = me
    and a.status = 'pending'
    and a.expires_at > now()
    and s.status = 'collecting_votes';
  if not found then
    raise exception 'this check is not assigned to you, or it has closed';
  end if;

  -- Validate flaws before the vote lands, so a bad tag doesn't leave a vote
  -- without its flaws.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_flaws, '[]'::jsonb)) as f(photo_id uuid, flaw_tag_id text)
    where not exists (
        select 1 from public.submission_photos p
        where p.id = f.photo_id and p.submission_id = p_submission_id
      )
      or not exists (
        select 1 from public.flaw_tags t
        where t.id = f.flaw_tag_id and (t.approved or t.proposed_by = me)
      )
  ) then
    raise exception 'a flaw points at an unknown photo or tag';
  end if;

  insert into public.verifications (submission_id, verifier_id, verdict, confidence, notes)
  values (p_submission_id, me, p_verdict, p_confidence, nullif(trim(p_notes), ''))
  returning * into v;

  insert into public.verification_flaws (verification_id, photo_id, flaw_tag_id, box_x, box_y, box_w, box_h, note)
  select v.id, f.photo_id, f.flaw_tag_id, f.box_x, f.box_y, f.box_w, f.box_h, nullif(trim(f.note), '')
  from jsonb_to_recordset(coalesce(p_flaws, '[]'::jsonb))
    as f(photo_id uuid, flaw_tag_id text, box_x real, box_y real, box_w real, box_h real, note text);

  return v;
end;
$$;

-- Pass on an assigned check (e.g. a brand you don't know). It won't come back.
create function public.skip_assignment(p_submission_id uuid) returns void
language sql security invoker set search_path = '' as $$
  update public.verification_assignments
  set status = 'skipped'
  where submission_id = p_submission_id and verifier_id = auth.uid() and status = 'pending';
$$;
