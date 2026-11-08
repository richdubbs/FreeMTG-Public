/**
 * edh-d-111 ADDITION: the `ColorOrTypeCard` hole, a card description of an article, one color, "or", one card type and the card noun: "a blue or artifact card" (CR 105.2, 205.2a,
 * 608.2c; Tezzeret's Gatebreaker). The value is the filter without `isCard` (as DiscardDesc's): a card of that color or a card of that card type (`anyOf`). The `Filter` hole reads
 * lists of colors ("a red or green card") and lists of card types ("an artifact or creature card") but no list that mixes the two, so a template using this hole never competes with
 * theirs.
 */
import type { ObjectFilter } from '../../types/ability';
import type { Alt, HoleFn } from './core';

export const colorOrTypeCard: HoleFn = (ctx, pos) => {
  const art = ctx.toks[pos]?.norm;
  if (art !== 'a' && art !== 'an') return [];
  const c = ctx.toks[pos + 1];
  const color = c !== undefined && c.kind === 'WORD' ? ctx.vocab.colors.get(c.norm) : undefined;
  if (color === undefined || ctx.toks[pos + 2]?.norm !== 'or') return [];
  const t = ctx.toks[pos + 3];
  const type = t !== undefined && t.kind === 'WORD' ? ctx.vocab.types.get(t.norm) : undefined;
  if (type === undefined || type.plural || ctx.toks[pos + 4]?.norm !== 'card') return [];
  const value: ObjectFilter[] = [{ colors: [color] } as ObjectFilter, { types: [type.name] } as ObjectFilter];
  const out: Alt[] = [{ end: pos + 5, value }];
  return out;
};
