/**
 * edh-e-13 render folds: shapes only this round's templates build (parser/templates/zz-cloud/edh-e-13.json). Each returns null for any other shape, so the general renderers then say it
 * or refuse. No value is imported from render/fold.ts (it imports this file).
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { cloneState, type RenderState } from './state';
import { withArticle } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const onlyKeys = (x: object, keys: readonly string[]): boolean => Object.entries(x).every(([k, v]) => v === undefined || keys.includes(k));

/**
 * edh-e-13 (CR 101.4, 122.1, 122.6, 608.2d; Eye of Doom, eff.edhe13.eachPlayer.choosesPermanent.putsCounter): "each player chooses a nonland permanent and puts a doom counter on it.": a `forEach`
 * over the players in turn order in which each chooses one permanent matching the filter (any player's, so the choice is not `perPlayer`) and puts one counter on it themselves (the player who
 * puts the counters, CR 122.6). Only that exact shape.
 */
function eachPlayerChoosesPutsCounter(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const fe = list[i];
  if (fe?.op !== 'forEach' || !same(fe.over, { ref: 'each', who: 'player' }) || !onlyKeys(fe, ['op', 'over', 'as', 'do']) || fe.do.length !== 2) return null;
  const [ch, put] = fe.do;
  if (ch?.op !== 'chooseObjects' || put?.op !== 'putCounters' || !same(ch.who, { ref: 'iterating' }) || ch.min !== 1 || ch.max !== 1 || typeof ch.as !== 'string') return null;
  if (!onlyKeys(ch, ['op', 'who', 'from', 'min', 'max', 'as']) || ch.from?.ref !== 'each' || Object.keys(ch.from).some((k) => k !== 'ref' && k !== 'filter')) return null;
  if (!same(put.on, { ref: 'bound', name: ch.as }) || put.count !== 1 || !same(put.by, { ref: 'iterating' }) || !onlyKeys(put, ['op', 'on', 'kind', 'count', 'by']) || put.kind === 'any') return null;
  const what = K.np(ch.from.filter ?? {}, cloneState(st), { det: 'a' });
  return { clauses: [plain(`each player chooses ${what} and puts ${withArticle(`${put.kind} counter`)} on it`)], consumed: 1 };
}

export function foldEdhE13(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return eachPlayerChoosesPutsCounter(list, i, st);
}
