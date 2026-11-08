/**
 * edh-e-38 (Commander coordinator E, group graveyard 2/3 second batch): the folds of its templates (parser/templates/zz-cloud/edh-e-38.json), called from render/fold.ts#foldAt.
 * Each applies only when every part is exactly what the idiom says.
 */
import type { EffectStep, ObjectFilter } from '../types/ability';
import { acting } from './clause';
import type { Folded } from './fold';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** A plain "return a <creature type> card from your graveyard to your hand" pair: the creature type, or null for any other pair of steps. */
function typeReturn(a: EffectStep | undefined, b: EffectStep | undefined): string | null {
  if (a?.op !== 'chooseObjects' || b?.op !== 'move' || a.as === undefined || !same(a.who, { ref: 'you' }) || a.min !== 1 || a.max !== 1) return null;
  if (a.random === true || a.guard !== undefined || a.distinct !== undefined || a.groupLimit !== undefined || a.perPlayer !== undefined || a.startingWith !== undefined) return null;
  if (b.guard !== undefined || b.as !== undefined || b.until !== undefined || b.link !== undefined || b.remember !== undefined || !same(b.what, { ref: 'bound', name: a.as }) || !same(b.to, { zone: 'hand' })) return null;
  if (a.from.ref !== 'each') return null;
  const f = a.from.filter as ObjectFilter;
  const any = f.anyOf;
  if (!same({ ...f, anyOf: undefined }, { zone: 'graveyard', owner: 'you', isCard: true, anyOf: undefined }) || any === undefined || any.length !== 1) return null;
  const sub = any[0]!;
  if (!same({ ...sub, subtypes: undefined }, { subtypes: undefined }) || sub.subtypes === undefined || sub.subtypes.length !== 1) return null;
  return sub.subtypes[0]!;
}

/**
 * `returnFourTypesDoTheSame` (CR 608.2c, 400.3, 205.3m; Grim Captain's Call, eff.edhe38.return.fourCreatureTypes.graveyard.hand): "Return a Pirate card from your graveyard to your
 * hand, then do the same for Vampire, Dinosaur, and Merfolk.": four separate returns of one card of a creature type each, from your graveyard to your hand, in that order. Only that
 * exact shape (four plain pairs of steps, four different types), with nothing after it reading the choices.
 */
function returnFourTypesDoTheSame(list: EffectStep[], i: number): Folded | null {
  const types = [0, 1, 2, 3].map((k) => typeReturn(list[i + 2 * k], list[i + 2 * k + 1]));
  if (types.some((t) => t === null) || new Set(types).size !== 4) return null;
  const names = [0, 1, 2, 3].map((k) => (list[i + 2 * k] as Extract<EffectStep, { op: 'chooseObjects' }>).as!);
  if (list.slice(i + 8).some((x) => names.some((n) => JSON.stringify(x).includes(`"name":"${n}"`)))) return null;
  const text = `return a ${types[0]!} card from your graveyard to your hand, then do the same for ${types[1]!}, ${types[2]!}, and ${types[3]!}`;
  return { clauses: [acting('you', text, `you ${text}`, { closesScope: true })], consumed: 8 };
}

export function foldEdhE38(list: EffectStep[], i: number, _st: RenderState): Folded | null {
  return returnFourTypesDoTheSame(list, i);
}
