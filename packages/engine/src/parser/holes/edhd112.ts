/**
 * edh-d-112 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups counters 1/3 and 2/3; code edhd112): the round's hole readings.
 */
import type { Condition } from '../../types/ability';
import type { Alt, HoleCtx } from './core';
import { P, cmpAt, phraseAt } from './core';

const W_COLORS_OF_MANA_WERE_SPENT_TO_CAST = P('colors of mana were spent to cast');

/**
 * edh-d-112 (CR 601.2h, 106.1, 105.1; Steel Exemplar: "This creature enters with two +1/+1 counters on it unless two or more colors of mana were spent to cast it."): "N or more colors of
 * mana were spent to cast ~ / it": the number of colors of mana spent to cast the object itself (`colorsSpent`, converge's count: 0 for an object that was not cast, CR 707.10), at
 * least N. Only "N or more" / "at least N" with a literal number of 2 or more ("one or more colors" is no wording Oracle prints); the object is `~` or the plain "it" of the
 * object's own entering replacement (`$self`, parser/lower/static-anaphora.ts#resolveEntersSelfMarker: any other antecedent leaves the marker and the sentence manual).
 */
/** The object of "spent to cast <it>": `~` or a plain "it" (the same objects as parser/holes/cond.ts#spentObjects reads, without its spell anaphor; no import of cond.ts: a cycle). */
function spentObjects(ctx: HoleCtx, pos: number): { end: number; value: never; flags?: string[] }[] {
  return ctx.call('Obj', pos).filter((o) => {
    const v = o.value as { ref?: string; $anaphor?: { head?: string; text?: string } };
    return v.ref === 'self' || (v.$anaphor !== undefined && v.$anaphor.head === undefined && v.$anaphor.text === 'it');
  }).map((o) => ({ end: o.end, value: o.value as never, ...(o.flags ? { flags: o.flags } : {}) }));
}

export function colorsSpentAtLeast(ctx: HoleCtx, pos: number): Alt[] {
  const out: Alt[] = [];
  for (const c of cmpAt(ctx, pos)) {
    const n = c.cmp.value as unknown;
    if (c.cmp.op !== '>=' || typeof n !== 'number' || !Number.isInteger(n) || n < 2 || n > 5) continue;
    const e = phraseAt(ctx, c.end, W_COLORS_OF_MANA_WERE_SPENT_TO_CAST);
    if (e < 0) continue;
    for (const o of spentObjects(ctx, e)) {
      const self = (o.value as { ref?: string }).ref === 'self';
      const value = { cond: 'compare', left: { q: 'colorsSpent' }, op: '>=', right: n, ...(self ? {} : { $self: o.value }) } as unknown as Condition;
      out.push({ end: o.end, value, ...(o.flags ? { flags: o.flags } : {}) });
    }
  }
  return out;
}
