/**
 * edh-e-32 (Commander coordinator E, group copy): the renderer parts of its templates (parser/templates/zz-cloud/edh-e-32.json). CR cites are from the Comprehensive Rules text of
 * 2026-09-25 (fetched list for this round: unverified ones are named in the record). Imports no value from render/fold.ts (an import cycle); render/fold.ts#foldAtPlain calls `foldEdhE32`
 * after the other rounds' folds.
 *
 * `forEachControllerCopies` (CR 707.2, 111.1, 608.2c-d; Parallel Evolution, eff.edhe32.forEach.controllerCopiesThat): "For each creature token on the battlefield, its controller creates a token
 * that's a copy of that creature.": one pass over the objects of a described set, in which the controller of each creates one token copy of it. Only this exact step (one iteration step, one
 * token copy, the creating player the controller of the object).
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const onlyKeys = (e: object, keys: string[]): boolean => Object.keys(e).every((k) => keys.includes(k));

function forEachControllerCopies(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const f = list[i];
  if (f?.op !== 'forEach' || !onlyKeys(f, ['op', 'over', 'as', 'do']) || f.over.ref !== 'each' || !('filter' in f.over) || f.do.length !== 1) return null;
  const c = f.do[0]!;
  const it = { ref: 'bound', name: f.as };
  if (c.op !== 'copy' || !onlyKeys(c, ['op', 'what', 'result', 'who']) || c.result !== 'token' || !same(c.what, it) || !same(c.who, { ref: 'controllerOf', object: it })) return null;
  const filter = f.over.filter;
  if (filter.zone !== 'battlefield' || filter.types?.length !== 1 || !onlyKeys(filter, ['types', 'token', 'zone', 'subtypes'])) return null;
  const noun = K.np(filter, st, { det: 'none' });
  if (/ (control|on|in|from)\b/.test(noun)) return null;
  return { clauses: [plain(`for each ${noun} on the battlefield, its controller creates a token that's a copy of that ${filter.types[0]!.toLowerCase()}`, { standalone: true })], consumed: 1 };
}

/**
 * `copyIfThenCopyIf` (CR 707.10, 707.10c, 603.4, 113.6k; Banish into Fable, eff.edhe32.copy.ifThenCopyIf): "copy it if <condition>, then copy it if <condition>. You may choose new targets for the copies.": two
 * copies of the spell of the cast event, each made only if its condition holds as the ability resolves, both with the choice of new targets (the plural rider gave both the same `newTargets`).
 */
function copyIfThenCopyIf(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, b] = [list[i], list[i + 1]];
  if (a?.op !== 'copy' || b?.op !== 'copy') return null;
  const spell = { ref: 'event', role: 'spell' };
  for (const c of [a, b]) {
    if (!onlyKeys(c, ['op', 'what', 'result', 'who', 'guard', 'newTargets']) || !same(c.what, spell) || c.result !== 'spell' || !same(c.who, { ref: 'you' }) || c.guard === undefined) return null;
  }
  if (a.newTargets !== b.newTargets || (a.newTargets !== undefined && a.newTargets !== 'may')) return null; // both choose new targets, or neither
  const first = K.cond(a.guard!, st);
  const second = K.cond(b.guard!, st);
  return { clauses: [plain(`copy it if ${first}, then copy it if ${second}${a.newTargets === 'may' ? '. you may choose new targets for the copies' : ''}`, { standalone: true })], consumed: 2 };
}

/** The folds of edh-e-32 (render/fold.ts#foldAtPlain). */
export function foldEdhE32(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return forEachControllerCopies(list, i, st) ?? copyIfThenCopyIf(list, i, st);
}
