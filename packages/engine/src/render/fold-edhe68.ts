/**
 * edh-e-68 (Commander coordinator E, groups counters/cost/replace-prevent/combat): the folds of its templates (parser/templates/zz-cloud/edh-e-68.json), called from render/fold.ts#foldAtPlain.
 * Each is the one `effect` step with one `replace` (a redirect shield) said in one sentence; only those shapes.
 *
 *   `redirectNextToSelfAndYou`   "The next time damage would be dealt to ~ and/or you this turn, that damage is dealt to any target instead." (Glarecaster; CR 614.9, 615.7)
 *   `redirectAllToObj`           "All damage that would be dealt to it this turn is dealt to target creature instead." (Karona's Zealot; CR 614.9)
 *   `redirectNextNFromRecipient` "The next X damage that would be dealt to target creature, planeswalker, or player this turn is dealt to another target creature, planeswalker, or player instead." (Captain's Maneuver; CR 614.9, 615.7, 115.3)
 *   `preventNextDivided`         "Prevent the next 4 damage that would be dealt this turn to any number of targets, divided as you choose." (Embolden; CR 615.7, 601.2d)
 *   `redirectNextCombatBackToSource` "The next time target attacking creature would deal combat damage to ~ this turn, that creature deals that damage to itself instead." (Shield Dancer; CR 614.9, 510.2)
 *   `redirectNextSourceOfChoiceToItsController` "The next time a source of your choice would deal damage this turn, that damage is dealt to that source's controller instead." (Reflect Damage; CR 609.7a, 614.9)
 *   `redirectNextCombatToOpponent` "The next time ~ would deal combat damage to an opponent this turn, it deals that damage to target creature instead." (Soltari Guerrillas; CR 614.9, 510.2)
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

type EffectOp = Extract<EffectStep, { op: 'effect' }>;
type Replace = EffectOp['effects'][number] & { s: 'replace' };

/** The one `effect` step with one plain `replace` (no condition, no optional, no self-replacement), or null. */
function oneReplace(list: EffectStep[], i: number): { e: EffectOp; r: Replace } | null {
  const e = list[i];
  if (e?.op !== 'effect' || e.guard !== undefined || e.as !== undefined || e.effects.length !== 1 || e.duration === undefined) return null;
  const r = e.effects[0]!;
  if (r.s !== 'replace' || r.condition !== undefined || r.optional !== undefined || r.selfReplacement !== undefined) return null;
  return { e, r: r as Replace };
}

function redirectNextToSelfAndYou(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = oneReplace(list, i);
  if (p === null) return null;
  const { e, r } = p;
  if (!same(r.replaces, { ev: 'damage', recipient: { object: { is: { ref: 'self' } }, player: 'you' } })) return null;
  const b = r.body;
  if (b.b !== 'redirect' || b.amount !== undefined || !same(r.shield, { uses: 1 })) return null;
  const dur = K.dur(e.duration!, st);
  const to = K.obj(b.to as never, st, 'object').text;
  return { clauses: [plain(`the next time damage would be dealt to ${K.obj({ ref: 'self' }, st, 'object').text} and/or you${dur ? ` ${dur}` : ''}, that damage is dealt to ${to} instead`, { standalone: true })], consumed: 1 };
}

function redirectAllToObj(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = oneReplace(list, i);
  if (p === null) return null;
  const { e, r } = p;
  const rep = r.replaces as { ev?: string; recipient?: { object?: { is?: unknown } } };
  if (rep.ev !== 'damage' || !same(Object.keys(r.replaces).sort(), ['ev', 'recipient']) || rep.recipient?.object?.is === undefined) return null;
  if (!same(rep.recipient, { object: { is: rep.recipient.object.is } })) return null;
  const b = r.body;
  if (b.b !== 'redirect' || b.amount !== undefined || r.shield !== undefined) return null;
  const to0 = b.to as { ref?: string; id?: string };
  if (!(to0.ref === 'self' || (to0.ref === 'target' && to0.id !== undefined && st.specs.get(to0.id)?.kind === 'object'))) return null; // a player (or anything else) is another template's shape
  const dur = K.dur(e.duration!, st);
  const from = K.obj(rep.recipient.object.is as never, st, 'object').text;
  const to = K.obj(b.to as never, st, 'object').text;
  return { clauses: [plain(`all damage that would be dealt to ${from}${dur ? ` ${dur}` : ''} is dealt to ${to} instead`, { standalone: true })], consumed: 1 };
}

function redirectNextCombatToOpponent(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = oneReplace(list, i);
  if (p === null) return null;
  const { e, r } = p;
  const rep = r.replaces as { ev?: string; combat?: boolean; source?: { is?: unknown }; recipient?: unknown };
  if (rep.ev !== 'damage' || rep.combat !== true || rep.source?.is === undefined || !same(Object.keys(rep.source), ['is']) || !same(rep.recipient, { player: 'opponent' })) return null;
  if (!same(Object.keys(r.replaces).sort(), ['combat', 'ev', 'recipient', 'source'])) return null;
  const b = r.body;
  if (b.b !== 'redirect' || b.amount !== undefined || !same(r.shield, { uses: 1 })) return null;
  const dur = K.dur(e.duration!, st);
  const src = K.obj(rep.source.is as never, st, 'subject').text;
  const to = K.obj(b.to as never, st, 'object').text;
  return { clauses: [plain(`the next time ${src} would deal combat damage to an opponent${dur ? ` ${dur}` : ''}, it deals that damage to ${to} instead`, { standalone: true })], consumed: 1 };
}

function redirectNextNFromRecipient(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = oneReplace(list, i);
  if (p === null) return null;
  const { e, r } = p;
  const rep = r.replaces as { ev?: string; recipient?: { object?: { is?: { ref?: string; id?: string } }; player?: unknown } };
  const t = rep.recipient?.object?.is;
  if (rep.ev !== 'damage' || !same(Object.keys(r.replaces).sort(), ['ev', 'recipient']) || t?.ref !== 'target' || t.id === undefined) return null;
  if (!same(rep.recipient, { object: { is: t }, player: t })) return null;
  const b = r.body;
  if (b.b !== 'redirect' || b.amount === undefined || !same(r.shield, { uses: 'all', amount: b.amount })) return null;
  const dur = K.dur(e.duration!, st);
  const from = K.obj(t as never, st, 'object').text;
  const to = K.obj(b.to as never, st, 'object').text;
  return { clauses: [plain(`the next ${K.qty(b.amount, st)} damage that would be dealt to ${from}${dur ? ` ${dur}` : ''} is dealt to ${to} instead`, { standalone: true })], consumed: 1 };
}

function preventNextDivided(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = oneReplace(list, i);
  if (p === null || (p.e as { divided?: boolean }).divided !== true) return null;
  const { e, r } = p;
  const rep = r.replaces as { ev?: string; recipient?: { object?: { is?: { ref?: string; id?: string } }; player?: unknown } };
  const t = rep.recipient?.object?.is;
  if (rep.ev !== 'damage' || !same(Object.keys(r.replaces).sort(), ['ev', 'recipient']) || t?.ref !== 'target' || t.id === undefined || !same(rep.recipient, { object: { is: t }, player: t })) return null;
  const b = r.body;
  if (b.b !== 'prevent' || b.amount === 'all' || b.then !== undefined || b.as !== undefined || b.oncePerBatch !== undefined || !same(r.shield, { uses: 'all' })) return null;
  const dur = K.dur(e.duration!, st);
  const to = K.obj(t as never, st, 'object').text;
  return { clauses: [plain(`prevent the next ${K.qty(b.amount, st)} damage that would be dealt${dur ? ` ${dur}` : ''} to ${to}, divided as you choose`, { standalone: true })], consumed: 1 };
}

/**
 * `preventNextDividedKicked` (CR 614.15, 608.2c, 702.33a, 601.2d; Pollen Remedy, rid.edhe68.instead.prevent.next.divided.kicked): the `if` step the rider makes of a divided prevention: the same shield on the same
 * targets, its amount the one the kicked branch states, else the first sentence's. "Prevent the next 3 damage ... divided as you choose. If ~ was kicked, prevent the next 6 damage this way instead."
 */
function preventNextDividedKicked(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const s = list[i];
  if (s?.op !== 'if' || s.guard !== undefined || s.as !== undefined || s.intervening !== undefined || s.then.length !== 1 || s.else === undefined || s.else.length !== 1) return null;
  if (!same(s.cond, { cond: 'wasCast', kicked: true })) return null;
  const a = s.then[0]!;
  const b = s.else[0]!;
  const first = preventNextDivided([b], 0, st);
  if (first === null || a.op !== 'effect' || b.op !== 'effect') return null;
  const ra = a.effects[0] as Replace | undefined;
  const rb = b.effects[0] as Replace | undefined;
  if (ra?.s !== 'replace' || rb?.s !== 'replace' || ra.body.b !== 'prevent' || ra.body.amount === 'all' || a.divided !== true) return null;
  // the two branches are the same shield but for the amount
  const swap = { ...a, effects: [{ ...ra, body: { ...ra.body, amount: (rb.body as { amount: unknown }).amount } }] };
  if (!same(swap, b)) return null;
  return { clauses: [...first.clauses, plain(`if ${K.cond(s.cond, st)}, prevent the next ${K.qty(ra.body.amount, st)} damage this way instead`, { standalone: true })], consumed: 1 };
}

function redirectNextCombatBackToSource(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = oneReplace(list, i);
  if (p === null) return null;
  const { e, r } = p;
  const rep = r.replaces as { ev?: string; combat?: boolean; source?: { is?: { ref?: string; id?: string } }; recipient?: unknown };
  const t = rep.source?.is;
  if (rep.ev !== 'damage' || rep.combat !== true || t?.ref !== 'target' || !same(Object.keys(rep.source!), ['is']) || !same(rep.recipient, { object: { is: { ref: 'self' } } })) return null;
  if (!same(Object.keys(r.replaces).sort(), ['combat', 'ev', 'recipient', 'source'])) return null;
  const b = r.body;
  if (b.b !== 'redirect' || b.amount !== undefined || !same(b.to, t) || !same(r.shield, { uses: 1 })) return null;
  const dur = K.dur(e.duration!, st);
  const src = K.obj(t as never, st, 'subject').text;
  return { clauses: [plain(`the next time ${src} would deal combat damage to ${K.obj({ ref: 'self' }, st, 'object').text}${dur ? ` ${dur}` : ''}, that creature deals that damage to itself instead`, { standalone: true })], consumed: 1 };
}

/** The choice of a damage source (as in fold-edhe18.ts) and the one `effect` step with one `replace` after it, or null. */
function chosenSourceShield(list: EffectStep[], i: number): { as: string; e: EffectOp; r: Replace } | null {
  const c = list[i];
  if (c?.op !== 'chooseObjects' || c.who.ref !== 'you' || c.guard !== undefined || c.as === undefined || c.min !== 1 || c.max !== 1 || c.random !== undefined || c.damageSource !== true) return null;
  if (c.perPlayer !== undefined || c.startingWith !== undefined || !same(c.from, { ref: 'each', filter: { zone: ['battlefield', 'stack', 'command'] } })) return null;
  const p = oneReplace(list, i + 1);
  if (p === null) return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"name":${JSON.stringify(c.as)}`))) return null; // a source the later steps read would not be "a source of your choice"
  return { as: c.as, ...p };
}

function redirectNextSourceOfChoiceToItsController(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = chosenSourceShield(list, i);
  if (p === null) return null;
  const { r, e } = p;
  if (!same(r.replaces, { ev: 'damage', source: { is: { ref: 'bound', name: p.as } } })) return null;
  const b = r.body;
  if (b.b !== 'redirect' || b.amount !== undefined || !same(b.to, { ref: 'controllerOf', object: { ref: 'bound', name: p.as } }) || !same(r.shield, { uses: 1 })) return null;
  const dur = K.dur(e.duration!, st);
  return { clauses: [plain(`the next time a source of your choice would deal damage${dur ? ` ${dur}` : ''}, that damage is dealt to that source's controller instead`, { standalone: true })], consumed: 2 };
}

export function foldEdhE68(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return redirectNextToSelfAndYou(list, i, st) ?? redirectAllToObj(list, i, st) ?? redirectNextCombatToOpponent(list, i, st) ?? redirectNextNFromRecipient(list, i, st) ?? preventNextDivided(list, i, st) ?? preventNextDividedKicked(list, i, st) ?? redirectNextCombatBackToSource(list, i, st) ?? redirectNextSourceOfChoiceToItsController(list, i, st);
}
