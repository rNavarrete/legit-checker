/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeConsensus, type Verdict } from './consensus.ts';

const votes = (a: number, r: number, c = 0): Verdict[] => [
  ...Array<Verdict>(a).fill('authentic'),
  ...Array<Verdict>(r).fill('replica'),
  ...Array<Verdict>(c).fill('cannot_tell'),
];

test('waits for the minimum number of decisive votes', () => {
  const result = computeConsensus(votes(4, 0, 3));
  assert.equal(result.settled, false);
  assert.equal(result.settled === false && result.votesNeeded, 1);
});

test('4 of 5 settles', () => {
  const result = computeConsensus(votes(4, 1));
  assert.deepEqual(result.settled && [result.verdict, result.agreement], ['authentic', 0.8]);
});

test('5 of 5 replica settles as replica', () => {
  const result = computeConsensus(votes(0, 5));
  assert.equal(result.settled && result.verdict, 'replica');
});

test('3 of 5 keeps collecting votes', () => {
  const result = computeConsensus(votes(3, 2));
  assert.equal(result.settled, false);
});

test('a split that reaches the max settles as inconclusive', () => {
  const result = computeConsensus(votes(5, 4));
  assert.equal(result.settled && result.verdict, 'inconclusive');
});

test('cannot_tell votes do not count toward the verdict', () => {
  const result = computeConsensus(votes(4, 1, 4));
  assert.equal(result.settled && result.verdict, 'authentic');
  assert.equal(result.cannotTell, 4);
});
