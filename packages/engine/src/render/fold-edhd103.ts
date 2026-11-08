/**
 * edh-d-103 (Commander coordinator D, groups replace-prevent and cost): the folds of its templates (parser/templates/zz-cloud/edh-d-103.json), called from render/fold.ts#foldAt. Each
 * is the choice of a source as the effect resolves (CR 609.7a) and the one prevention of the damage that source would deal, with an additional instruction about damage from a source of a
 * color, said in Oracle's words; only those exact shapes, the chosen source named nowhere else.
 *
 *   `nextSourceOfChoiceColorBack`  "The next time a source of your choice would deal damage to any target this turn, prevent that damage. If damage from a red source is prevented this way,
 *                                  ~ deals that much damage to the source's controller." (Honorable Passage; CR 615.5, 615.7, 105.2)
 *   `allFromSourceOfChoiceColorGain` "Prevent all damage that would be dealt to you this turn by a source of your choice. Whenever damage from a black or red source is prevented this way
 *                                  this turn, you gain that much life." (Samite Ministration; CR 615.5, 603.12, 119.3)
 *   `nextSourceOfChosenColor`      "The next time a source of your choice of the chosen color would deal damage to you this turn, prevent that damage." (Story Circle; CR 609.7a, 615.7,
 *                                  607.2d): the source chosen among the objects of the color the face's "As ~ enters, choose a color." chose, and the shield names that color too (CR 615.9)
 *   `nextCreatureWithShadow`       "The next time a creature of your choice with shadow would deal damage to you this turn, prevent that damage." (Circle of Protection: Shadow)
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';
import { COLOR_WORD, withArticle } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const ZONES = ['battlefield', 'stack', 'command'];
const SOURCE = { ref: 'event', role: 'source' };

/** The choice step and the one `effect` step with one `replace` after it, or null. */
function pair(list: EffectStep[], i: number): { as: string; e: Extract<EffectStep, { op: 'effect' }>; r: Extract<EffectStep, { op: 'effect' }>['effects'][number] & { s: 'replace' } } | null {
  const c = list[i];
  const e = list[i + 1];
  if (c?.op !== 'chooseObjects' || c.who.ref !== 'you' || c.guard !== undefined || c.as === undefined || c.min !== 1 || c.max !== 1 || c.random !== undefined || c.damageSource !== true) return null;
  if (c.perPlayer !== undefined || c.startingWith !== undefined || !same(c.from, { ref: 'each', filter: { zone: ZONES } })) return null;
  if (e?.op !== 'effect' || e.guard !== undefined || e.as !== undefined || e.effects.length !== 1 || e.duration === undefined) return null;
  const r = e.effects[0]!;
  if (r.s !== 'replace' || r.condition !== undefined || r.optional !== undefined || r.selfReplacement !== undefined || r.replaces.ev !== 'damage') return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"name":${JSON.stringify(c.as)}`))) return null;
  return { as: c.as, e, r: r as never };
}

/** The colors of a "damage from a <color> source" condition on the damage's source, said with an article, or null. */
function colorsOf(cond: unknown, n: number): string | null {
  const c = cond as { cond?: string; object?: unknown; filter?: { colors?: string[] } };
  if (c?.cond !== 'matches' || !same(c.object, SOURCE) || !same(Object.keys(c.filter ?? {}), ['colors'])) return null;
  const cs = c.filter!.colors!;
  if (cs.length !== n || cs.some((x) => COLOR_WORD[x] === undefined) || new Set(cs).size !== n) return null;
  return withArticle(cs.map((x) => COLOR_WORD[x]!).join(' or '));
}

function nextSourceOfChoiceColorBack(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = pair(list, i);
  if (p === null) return null;
  const { r, e } = p;
  const rep = r.replaces as { ev?: string; source?: unknown; recipient?: { player?: { ref?: string; id?: string }; object?: unknown } };
  const t = rep.recipient?.player;
  if (!same(Object.keys(rep), ['ev', 'source', 'recipient']) || !same(rep.source, { is: { ref: 'bound', name: p.as } }) || t?.ref !== 'target' || t.id === undefined) return null;
  if (!same(rep.recipient, { object: { is: { ref: 'target', id: t.id } }, player: { ref: 'target', id: t.id } }) || st.specs.get(t.id)?.kind !== 'anyTarget') return null;
  if (!same(r.shield, { uses: 1 })) return null;
  const b = r.body as { b: string; amount?: unknown; then?: EffectStep[] };
  if (!same(Object.keys(b), ['b', 'amount', 'then']) || b.b !== 'prevent' || b.amount !== 'all' || b.then?.length !== 1) return null;
  const f = b.then[0]!;
  if (f.op !== 'if' || f.else !== undefined || f.guard !== undefined || f.then.length !== 1) return null;
  const color = colorsOf(f.cond, 1);
  const d = f.then[0]!;
  if (color === null || !same(d, { op: 'damage', source: { ref: 'self' }, to: { ref: 'controllerOf', object: SOURCE }, amount: { q: 'preventedAmount' } })) return null;
  const dur = K.dur(e.duration, st);
  const to = K.obj(t as never, st, 'object').text;
  const self = K.obj({ ref: 'self' }, st, 'subject').text;
  return { clauses: [plain(`the next time a source of your choice would deal damage to ${to}${dur ? ` ${dur}` : ''}, prevent that damage. if damage from ${color} source is prevented this way, ${self} deals that much damage to the source's controller`, { standalone: true })], consumed: 2 };
}

function allFromSourceOfChoiceColorGain(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = pair(list, i);
  if (p === null) return null;
  const { r, e } = p;
  if (r.shield !== undefined || !same(r.replaces, { ev: 'damage', source: { is: { ref: 'bound', name: p.as } }, recipient: { player: 'you' } })) return null;
  const b = r.body as { b: string; amount?: unknown; as?: string; then?: EffectStep[] };
  if (!same(Object.keys(b), ['b', 'amount', 'as', 'then']) || b.b !== 'prevent' || b.amount !== 'all' || b.as === undefined || b.then?.length !== 1) return null;
  const f = b.then[0]!;
  if (f.op !== 'reflexive' || f.when.did !== b.as || f.targets.length !== 0 || f.modes !== undefined || f.guard !== undefined || f.as !== undefined || f.do.length !== 1) return null;
  const colors = colorsOf(f.when.if, 2);
  if (colors === null || !same(f.do[0], { op: 'gainLife', who: { ref: 'you' }, amount: { q: 'preventedAmount' } })) return null;
  if (!same(e.duration, { d: 'endOfTurn' })) return null; // "this turn" twice: the prevention's and the trigger's
  return { clauses: [plain(`prevent all damage that would be dealt to you this turn by a source of your choice. whenever damage from ${colors} source is prevented this way this turn, you gain that much life`, { standalone: true })], consumed: 2 };
}

function nextSourceOfChosenColor(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const c = list[i];
  const e = list[i + 1];
  if (c?.op !== 'chooseObjects' || c.who.ref !== 'you' || c.guard !== undefined || c.as === undefined || c.min !== 1 || c.max !== 1 || c.random !== undefined || c.damageSource !== true) return null;
  if (c.perPlayer !== undefined || c.startingWith !== undefined || c.from.ref !== 'each' || !('filter' in c.from)) return null;
  const chosen = c.from.filter.chosen;
  if (chosen === undefined || chosen.quality !== 'color' || typeof chosen.link !== 'string' || chosen.link.startsWith('$') || chosen.link.startsWith('@')) return null;
  if (!same(c.from.filter, { zone: ZONES, chosen })) return null;
  if (e?.op !== 'effect' || e.guard !== undefined || e.as !== undefined || e.effects.length !== 1 || e.duration === undefined) return null;
  const r = e.effects[0]!;
  if (r.s !== 'replace' || r.condition !== undefined || r.optional !== undefined || r.selfReplacement !== undefined) return null;
  if (!same(r.replaces, { ev: 'damage', source: { is: { ref: 'bound', name: c.as }, chosen }, recipient: { player: 'you' } })) return null;
  if (!same(r.body, { b: 'prevent', amount: 'all' }) || !same(r.shield, { uses: 1 })) return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"name":${JSON.stringify(c.as)}`))) return null;
  const dur = K.dur(e.duration, st);
  return { clauses: [plain(`the next time a source of your choice of the chosen color would deal damage to you${dur ? ` ${dur}` : ''}, prevent that damage`)], consumed: 2 };
}

/** "The next time a creature of your choice with shadow would deal damage to you this turn, prevent that damage." (Circle of Protection: Shadow; CR 609.7a, 615.7, 702.28a). */
function nextCreatureWithShadow(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const c = list[i];
  const e = list[i + 1];
  if (c?.op !== 'chooseObjects' || c.who.ref !== 'you' || c.guard !== undefined || c.as === undefined || c.min !== 1 || c.max !== 1 || c.random !== undefined || c.damageSource !== undefined) return null;
  if (c.perPlayer !== undefined || c.startingWith !== undefined || !same(c.from, { ref: 'each', filter: { types: ['Creature'], keyword: 'shadow' } })) return null;
  if (e?.op !== 'effect' || e.guard !== undefined || e.as !== undefined || e.effects.length !== 1 || e.duration === undefined) return null;
  const r = e.effects[0]!;
  if (r.s !== 'replace' || r.condition !== undefined || r.optional !== undefined || r.selfReplacement !== undefined) return null;
  if (!same(r.replaces, { ev: 'damage', source: { is: { ref: 'bound', name: c.as }, keyword: 'shadow' }, recipient: { player: 'you' } })) return null;
  if (!same(r.body, { b: 'prevent', amount: 'all' }) || !same(r.shield, { uses: 1 })) return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"name":${JSON.stringify(c.as)}`))) return null;
  const dur = K.dur(e.duration, st);
  return { clauses: [plain(`the next time a creature of your choice with shadow would deal damage to you${dur ? ` ${dur}` : ''}, prevent that damage`)], consumed: 2 };
}

/** The folds of edh-d-103 (render/fold.ts#foldAt). */
export function foldEdhD103(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return nextSourceOfChoiceColorBack(list, i, st) ?? allFromSourceOfChoiceColorGain(list, i, st) ?? nextSourceOfChosenColor(list, i, st) ?? nextCreatureWithShadow(list, i, st);
}
