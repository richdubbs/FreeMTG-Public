/**
 * edh-e-39 (coordinator E, Commander cards 2026-11-06): the fold of the shape parser/lower/riders.ts builds for "If A, X. If B, Y. Otherwise, Z." (Misfortune Teller; CR 608.2c).
 *
 * `ifIfOtherwise`: three consecutive `if` steps, the first two with no `else`, the third on "neither": `not(any[A, B])` with exactly the two conditions of the first two. Oracle prints
 * them as two sentences and an "Otherwise" sentence, the same words as `if A then X; if B then Y else Z`, so the last two steps are written as that (the first stays as it is). Only that
 * exact shape: no guard, no `else` anywhere, a single `any` of the two conditions in order.
 */
import type { EffectStep } from '../types/ability';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function ifIfOtherwise(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const a = list[i];
  const b = list[i + 1];
  const c = list[i + 2];
  if (a?.op !== 'if' || b?.op !== 'if' || c?.op !== 'if') return null;
  if (a.else !== undefined || b.else !== undefined || c.else !== undefined || a.guard !== undefined || b.guard !== undefined || c.guard !== undefined) return null;
  if (c.cond.cond !== 'not' || c.cond.of.cond !== 'any' || c.cond.of.of.length !== 2 || !same(c.cond.of.of[0], a.cond) || !same(c.cond.of.of[1], b.cond)) return null;
  const first = K.clause(a, st);
  const second = K.clause({ ...b, else: c.then } as EffectStep, st);
  return { clauses: [first, second], consumed: 3 };
}

export function foldEdhE39(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return ifIfOtherwise(list, i, st);
}
