/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { boxAroundTap } from './flaw-box.ts';

const round = (b: { x: number; y: number; w: number; h: number }) =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * 100) / 100]));

test('centers the box on the tap', () => {
  assert.deepEqual(round(boxAroundTap(0.5, 0.5, 0.2)), { x: 0.4, y: 0.4, w: 0.2, h: 0.2 });
});

test('keeps the box inside the photo near the edges', () => {
  assert.deepEqual(round(boxAroundTap(0.01, 0.99, 0.2)), { x: 0, y: 0.8, w: 0.2, h: 0.2 });
  assert.deepEqual(round(boxAroundTap(1.2, -0.3, 0.2)), { x: 0.8, y: 0, w: 0.2, h: 0.2 });
});

test('stays square on a portrait photo', () => {
  assert.deepEqual(round(boxAroundTap(0.5, 0.5, 0.2, 3 / 4)), { x: 0.4, y: 0.43, w: 0.2, h: 0.15 });
});
