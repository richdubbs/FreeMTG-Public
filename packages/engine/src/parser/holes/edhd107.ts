/**
 * edh-d-107 (Commander coordinator D, groups graveyard 1/3 and 2/3): the hole `SameForCards`, the cards of "..., then do the same for Aura cards" after "Return all non-Aura enchantment
 * cards from your graveyard to the battlefield" (CR 608.2c, 400.7; Estrid, the Masked): a plural card noun phrase of a plain description whose zone the first half states (your graveyard).
 * The value is that description in your graveyard; the template's renderer fold (render/fold-edhd107.ts) prints the sentence only when the first half is all cards of your graveyard.
 */
import type { ObjectFilter } from '../../types/ability';
import type { Alt, HoleCtx } from './core';
import { npAlts } from './filter';

const PLAIN: ReadonlySet<string> = new Set(['isCard', 'types', 'subtypes', 'supertypes', 'notSubtypes', 'notTypes', 'colors', 'not']);

export function sameForCards(ctx: HoleCtx, pos: number): Alt[] {
  const out: Alt[] = [];
  for (const n of npAlts(ctx, pos)) {
    const f = n.filter as ObjectFilter;
    if (n.number !== 'plural' || n.head !== 'card' || f.isCard !== true || n.flags.some((x) => x !== 'zone-unstated') || Object.keys(f).some((k) => !PLAIN.has(k))) continue;
    if (Object.keys(f).length < 2) continue; // a description, not "cards" alone
    out.push({ end: n.end, value: { ...f, zone: 'graveyard', owner: 'you' } });
  }
  return out;
}
