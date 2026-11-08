/**
 * edh-e-47: the folds of its templates (parser/templates/zz-cloud/edh-e-47.json), called from render/fold.ts#foldAt. Each applies only when every part is exactly what the
 * idiom says.
 *
 * `destroyLeastPower` (CR 701.8a, 701.19c, 208.1, 608.2d; Porphyry Nodes, eff.edhe47.destroy.leastPower.youChooseTie): "Destroy the creature with the least power. It can't be
 * regenerated. If two or more creatures are tied for least power, you choose one of them.": your choice of one of the creatures whose power is the least among all creatures
 * (named `leastPower`), and its destruction with no regeneration. A creature with indestructible is never the one chosen (rulings 2021-03-19: if one of the creatures with the least power has
 * indestructible you must destroy one without it, and if all of them have it none is destroyed). Exactly those two steps.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function destroyLeastPower(list: EffectStep[], i: number): Folded | null {
  const [c, d] = [list[i], list[i + 1]];
  if (c?.op !== 'chooseObjects' || d?.op !== 'destroy' || c.guard !== undefined || d.guard !== undefined) return null;
  const least = { types: ['Creature'], not: { keyword: 'indestructible' }, power: { op: '<=', value: { q: 'stat', stat: 'power', agg: 'min', of: { ref: 'each', filter: { types: ['Creature'] } } } } };
  if (!same(c, { op: 'chooseObjects', who: { ref: 'you' }, from: { ref: 'each', filter: least }, min: 1, max: 1, as: 'leastPower' })) return null;
  if (!same(d, { op: 'destroy', what: { ref: 'bound', name: 'leastPower' }, regeneration: 'cant' })) return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes('"leastPower"'))) return null;
  return { clauses: [plain("destroy the creature with the least power. it can't be regenerated. if two or more creatures are tied for least power, you choose one of them", { standalone: true })], consumed: 2 };
}

/**
 * `counterTargetIfSameManaValue` (CR 701.6a, 202.3, 115.1, 608.2c; Hisoka, Minamo Sensei; parser template eff.edhc9.counter.ifSameManaValueAsRevealed): "Counter target spell if it
 * has the same mana value as the discarded card.": the counter of the one target spell, done only when its mana value equals that of the cards discarded to pay the cost.
 * Exactly that one `if` step, the target a spell announced by this sentence and the compared object the discarded card.
 */
function counterTargetIfSameManaValue(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const s = list[i];
  if (s?.op !== 'if' || s.guard !== undefined || Object.keys(s).some((k) => !['op', 'cond', 'then'].includes(k))) return null;
  const c = s.cond;
  if (c.cond !== 'compare' || c.op !== '==' || s.then.length !== 1 || s.else !== undefined) return null;
  const t = s.then[0]!;
  if (t.op !== 'counter' || t.guard !== undefined || t.what.ref !== 'target' || Object.keys(t).some((k) => !['op', 'what'].includes(k))) return null;
  const id = t.what.id;
  if (st.specs.get(id)?.kind !== 'spell') return null;
  if (!same(c.left, { q: 'stat', stat: 'manaValue', of: { ref: 'target', id } }) || !same(c.right, { q: 'stat', stat: 'manaValue', of: { ref: 'costDiscarded' } })) return null;
  const spell = K.obj({ ref: 'target', id }, st, 'object').text;
  return { clauses: [plain(`counter ${spell} if it has the same mana value as the discarded card`)], consumed: 1 };
}

/**
 * `counterIfCounteredControllerMayPut` (CR 701.6a, 608.2d, 608.2c, 400.7; Fold into Aether, eff.edhe47.counter.ifCountered.controllerMayPutFromHand): "Counter target spell. If that spell is
 * countered this way, its controller may put a creature card from their hand onto the battlefield.": the counter (named `countered`), then, only if it countered, the choice of up to one
 * card of the described kind from the hand of the spell's controller and its move onto the battlefield. Exactly those three steps.
 */
function counterIfCounteredControllerMayPut(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [c, ch, mv] = [list[i], list[i + 1], list[i + 2]];
  if (c?.op !== 'counter' || ch?.op !== 'chooseObjects' || mv?.op !== 'move' || c.what.ref !== 'target') return null;
  const id = c.what.id;
  if (st.specs.get(id)?.kind !== 'spell') return null;
  if (!same(c, { op: 'counter', what: { ref: 'target', id }, as: 'countered' })) return null;
  const ctl = { ref: 'controllerOf', object: { ref: 'target', id } };
  const did = { cond: 'did', step: 'countered' };
  if (ch.from.ref !== 'each' || ch.from.filter.anyOf?.length !== 1) return null;
  const kind = ch.from.filter.anyOf[0]!;
  if (!same(ch, { op: 'chooseObjects', who: ctl, from: { ref: 'each', filter: { anyOf: [kind], zone: 'hand', owner: ctl, isCard: true } }, min: 0, max: 1, as: 'put', guard: did })) return null;
  if (!same(mv, { op: 'move', what: { ref: 'bound', name: 'put' }, to: { zone: 'battlefield', controller: 'owner' }, guard: did })) return null;
  if (list.slice(i + 3).some((x) => JSON.stringify(x).includes('"put"'))) return null;
  const spell = K.obj({ ref: 'target', id }, st, 'object').text;
  const what = K.np({ ...kind, zone: 'hand', owner: 'you' }, st, { det: 'a', noZone: true });
  return { clauses: [plain(`counter ${spell}. if that spell is countered this way, its controller may put ${what} from their hand onto the battlefield`, { standalone: true })], consumed: 3 };
}

export function foldEdhE47(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return destroyLeastPower(list, i) ?? counterTargetIfSameManaValue(list, i, st) ?? counterIfCounteredControllerMayPut(list, i, st);
}
