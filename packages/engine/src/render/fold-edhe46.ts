/**
 * edh-e-46 render folds: shapes only this round's templates build (parser/templates/zz-cloud/edh-e-46.json). Each returns null for any other shape, so the general renderers then say it
 * or refuse. No value is imported from render/fold.ts (it imports this file).
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * edh-e-46 (CR 615.1a, 510.1, 118.8, 608.2c; Undergrowth, eff.edhe46.fog.combat.exceptWhenAdditionalPaid): "Prevent all combat damage that would be dealt this turn. If this spell's additional
 * cost was paid, this effect doesn't affect combat damage that would be dealt by red creatures.": if the optional additional cost was paid, all combat damage this turn is prevented except
 * what a source of the description deals; otherwise all of it. Only that exact shape (a duration of this turn, the same prevention in both branches but for the excluded sources).
 */
function fogExceptWhenAdditionalPaid(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const step = list[i];
  if (step?.op !== 'if' || !same(step.cond, { cond: 'wasCast', kicked: 'additional' }) || step.then.length !== 1 || step.else?.length !== 1) return null;
  const [paid, unpaid] = [step.then[0], step.else[0]];
  const body = { b: 'prevent', amount: 'all' };
  const mk = (source?: unknown) => ({ op: 'effect', duration: { d: 'endOfTurn' }, effects: [{ s: 'replace', replaces: { ev: 'damage', combat: true, ...(source !== undefined ? { source } : {}) }, body }] });
  if (!same(unpaid, mk())) return null;
  const rep = paid?.op === 'effect' ? paid.effects?.[0] : undefined;
  const source = rep?.s === 'replace' ? (rep.replaces as { source?: { not?: object } }).source : undefined;
  if (source?.not === undefined || Object.keys(source).length !== 1 || !same(paid, mk(source))) return null;
  const who = K.np(source.not as never, st, { det: 'none', plural: true });
  return { clauses: [plain(`prevent all combat damage that would be dealt this turn. if ~'s additional cost was paid, this effect doesn't affect combat damage that would be dealt by ${who}`, { standalone: true })], consumed: 1 };
}

/** The folds of this round's templates, called from render/fold.ts#foldAtPlain. */
export function foldEdhE46(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return fogExceptWhenAdditionalPaid(list, i, st);
}
