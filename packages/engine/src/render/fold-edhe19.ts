/**
 * edh-e-19 (coordinator E, group combat 1/2): the fold of its template (parser/templates/zz-cloud/edh-e-19.json), called from render/fold.ts#foldAt.
 *
 * `nextTurnCreaturesAttackYou` (CR 508.1d, 508.1b, 611.2a, 500.1; Taunt; eff.edhe19.duringTheirNextTurn.creaturesAttackYou): "During target player's next turn, creatures that player
 * controls attack you if able.": one lasting requirement for every creature the player controls to attack the ability's controller, through that player's next turn.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function nextTurnCreaturesAttackYou(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const s = list[i];
  if (s?.op !== 'effect' || s.guard !== undefined || s.as !== undefined || s.effects.length !== 1 || s.duration?.d !== 'duringNextTurn' || s.duration.turn !== undefined || s.duration.whose === undefined) return null;
  const whose = s.duration.whose;
  if (whose.ref !== 'target') return null;
  const e = s.effects[0]!;
  if (e.s !== 'restrict' || e.mode !== 'mustIfAble' || e.action !== 'attack' || !same(e.otherPlayer, { ref: 'you' }) || !Object.keys(e).every((k) => ['s', 'subject', 'mode', 'action', 'otherPlayer'].includes(k))) return null;
  const sub = e.subject as { ref?: string; filter?: unknown };
  if (sub.ref !== 'each' || !same(sub.filter, { types: ['Creature'], controller: whose })) return null;
  const who = K.player(whose, st, 'possessive');
  return { clauses: [plain(`during ${who.text} next turn, creatures that player controls attack you if able`, { standalone: true })], consumed: 1 };
}

export function foldEdhE19(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return nextTurnCreaturesAttackYou(list, i, st);
}
