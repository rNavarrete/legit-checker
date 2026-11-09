/**
 * Consensus rules for a legit check.
 *
 * Keep this in sync with `public.compute_consensus` in
 * supabase/migrations/0001_initial_schema.sql. The database is the source of
 * truth when a submission settles; this copy lets the app show "what happens
 * next" and is covered by unit tests.
 *
 * - Votes are blind: verifiers can't see other votes until the check settles.
 * - "cannot_tell" votes are kept (they're useful signal about photo quality)
 *   but don't count toward a verdict.
 * - Once MIN_DECISIVE_VOTES decisive votes are in, the check settles if one
 *   side has at least SUPERMAJORITY of them (4 of 5 qualifies, 3 of 5 doesn't).
 * - A split check keeps pulling in verifiers until MAX_DECISIVE_VOTES, then
 *   settles as "inconclusive".
 */

export type Verdict = 'authentic' | 'replica' | 'cannot_tell';
export type ConsensusVerdict = 'authentic' | 'replica' | 'inconclusive';

export const MIN_DECISIVE_VOTES = 5;
export const MAX_DECISIVE_VOTES = 9;
export const SUPERMAJORITY = 0.75;

export type ConsensusResult =
  | {
      settled: false;
      authentic: number;
      replica: number;
      cannotTell: number;
      /** How many more decisive votes are needed before it can settle. */
      votesNeeded: number;
    }
  | {
      settled: true;
      verdict: ConsensusVerdict;
      authentic: number;
      replica: number;
      cannotTell: number;
      /** Share of decisive votes that agree with the verdict (0 to 1). */
      agreement: number;
    };

export function computeConsensus(
  votes: readonly Verdict[],
  options: { minVotes?: number; maxVotes?: number; supermajority?: number } = {}
): ConsensusResult {
  const minVotes = options.minVotes ?? MIN_DECISIVE_VOTES;
  const maxVotes = options.maxVotes ?? MAX_DECISIVE_VOTES;
  const supermajority = options.supermajority ?? SUPERMAJORITY;

  let authentic = 0;
  let replica = 0;
  let cannotTell = 0;
  for (const vote of votes) {
    if (vote === 'authentic') authentic += 1;
    else if (vote === 'replica') replica += 1;
    else cannotTell += 1;
  }

  const decisive = authentic + replica;
  if (decisive < minVotes) {
    return { settled: false, authentic, replica, cannotTell, votesNeeded: minVotes - decisive };
  }

  const top = Math.max(authentic, replica);
  const agreement = top / decisive;
  if (agreement >= supermajority) {
    const verdict: ConsensusVerdict = authentic > replica ? 'authentic' : 'replica';
    return { settled: true, verdict, authentic, replica, cannotTell, agreement };
  }

  if (decisive >= maxVotes) {
    return { settled: true, verdict: 'inconclusive', authentic, replica, cannotTell, agreement };
  }

  return { settled: false, authentic, replica, cannotTell, votesNeeded: 1 };
}
