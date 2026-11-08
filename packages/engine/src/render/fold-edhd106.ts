/**
 * edh-d-106 render folds: shapes only this round's templates build (parser/templates/zz-cloud/edh-d-106.json). Each returns null for any other shape, so the general renderers then say
 * it or refuse. No value is imported from render/fold.ts (it imports this file).
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { cloneState, type RenderState } from './state';
import { firstAlt } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * edh-d-106 (CR 111.1, 508.1d, 611.2a, 702.10a; Furygale Flocking, eff.edhd106.eachOpp.createAttackThatOpponent.haste): "For each opponent, create two 3/3 blue and red Elemental creature
 * tokens with flying that attack that opponent this turn if able. They gain haste until end of turn.": a `forEach` over the opponents (CR 101.4: APNAP order) that creates the tokens, makes
 * them attack the opponent it is at this turn if able (encore's requirement, statics/requirements.ts: a player who left the game can't be attacked, CR 800.4a) and gives them haste until end
 * of turn. Only that exact shape.
 */
function eachOpponentTokensAttackThatOpponent(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const fe = list[i];
  if (fe?.op !== 'forEach' || !same(fe.over, { ref: 'each', who: 'opponent' }) || fe.do.length !== 3 || Object.keys(fe).some((k) => !['op', 'over', 'as', 'do'].includes(k))) return null;
  const [mk, req, haste] = fe.do;
  if (mk?.op !== 'createToken' || mk.as === undefined || !same(mk.who, { ref: 'you' }) || Object.keys(mk).some((k) => !['op', 'who', 'count', 'token', 'as'].includes(k))) return null;
  const them = { ref: 'bound', name: mk.as };
  if (!same(req, { op: 'effect', effects: [{ s: 'restrict', subject: them, mode: 'mustIfAble', action: 'attack', otherPlayer: { ref: 'iterating' } }], duration: { d: 'endOfTurn' } })) return null;
  if (!same(haste, { op: 'effect', effects: [{ s: 'continuous', affects: them, mods: [{ layer: 6, add: [{ kind: 'keyword', keyword: 'haste', text: 'haste' }] }] }], duration: { d: 'endOfTurn' } })) return null;
  const { as: _as, ...plainMake } = mk;
  const made = firstAlt(K.steps([plainMake as EffectStep], cloneState(st))).replace(/\.$/, ''); // the plain reading ("create ...", not "you create ...")
  const m = /^create (.+)$/i.exec(made);
  if (m === null || /[.!?]\s/.test(made)) return null;
  const one = mk.count === 1;
  return { clauses: [plain(`for each opponent, create ${m[1]!} ${one ? 'that attacks' : 'that attack'} that opponent this turn if able. ${one ? 'it gains' : 'they gain'} haste until end of turn`, { standalone: true })], consumed: 1 };
}

/** The folds of this round's templates, called from render/fold.ts#foldAtPlain. */
export function foldEdhD106(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return eachOpponentTokensAttackThatOpponent(list, i, st);
}
