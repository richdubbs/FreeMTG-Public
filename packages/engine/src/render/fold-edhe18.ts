/**
 * edh-e-18 (Commander coordinator E, group replace-prevent): the folds of its templates (parser/templates/zz-cloud/edh-e-18.json), called from render/fold.ts#foldAtPlain.
 * Each is the choice of a source as the effect resolves (CR 609.7a) and the one shield on the damage that source would deal, said in one sentence; only those shapes, the chosen source
 * named nowhere else (a source that the later steps read would not be "a source of your choice").
 *
 *   `preventNextBySourceOfChoice`   "Prevent the next 3 damage that would be dealt to any target this turn by a source of your choice." (Healing Grace; CR 615.1a, 615.7)
 *   `redirectAllBySourceOfChoice`   "All damage that would be dealt this turn to target creature you control by a source of your choice is dealt to another target creature instead." (Kor Chant, Kor Dirge; CR 614.9)
 *   `redirectNextFromSourceOfChoice` "The next 2 damage that a source of your choice would deal to you and/or permanents you control this turn is dealt to any target instead." (Harm's Way; CR 614.9, 615.7)
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { alt } from './text';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const ZONES = ['battlefield', 'stack', 'command'];

/** The choice step and the one `effect` step with one `replace` after it, or null. */
function pair(list: EffectStep[], i: number): { as: string; e: Extract<EffectStep, { op: 'effect' }>; r: Extract<EffectStep, { op: 'effect' }>['effects'][number] & { s: 'replace' } } | null {
  const c = list[i];
  const e = list[i + 1];
  if (c?.op !== 'chooseObjects' || c.who.ref !== 'you' || c.guard !== undefined || c.as === undefined || c.min !== 1 || c.max !== 1 || c.random !== undefined || c.damageSource !== true) return null;
  if (c.perPlayer !== undefined || c.startingWith !== undefined || !same(c.from, { ref: 'each', filter: { zone: ZONES } })) return null;
  if (e?.op !== 'effect' || e.guard !== undefined || e.as !== undefined || e.effects.length !== 1 || e.duration === undefined) return null;
  const r = e.effects[0]!;
  if (r.s !== 'replace' || r.condition !== undefined || r.optional !== undefined || r.selfReplacement !== undefined) return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"name":${JSON.stringify(c.as)}`))) return null;
  return { as: c.as, e, r: r as never };
}

function preventNextBySourceOfChoice(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = pair(list, i);
  if (p === null) return null;
  const { r, e } = p;
  const rep = r.replaces as { ev?: string; source?: unknown; recipient?: { player?: { ref?: string; id?: string }; object?: unknown } };
  const t = rep.recipient?.player;
  if (rep.ev !== 'damage' || !same(rep.source, { is: { ref: 'bound', name: p.as } }) || t?.ref !== 'target' || t.id === undefined) return null;
  if (!same(rep.recipient, { object: { is: { ref: 'target', id: t.id } }, player: { ref: 'target', id: t.id } }) || st.specs.get(t.id)?.kind !== 'anyTarget') return null;
  const b = r.body;
  if (b.b !== 'prevent' || b.amount === 'all' || b.then !== undefined || b.as !== undefined || b.oncePerBatch !== undefined || !same(r.shield, { uses: 'all' })) return null;
  const dur = K.dur(e.duration!, st);
  const to = K.obj({ ref: 'target', id: t.id }, st, 'object').text;
  return { clauses: [plain(`prevent the next ${K.qty(b.amount, st)} damage that would be dealt to ${to}${dur ? ` ${dur}` : ''} by a source of your choice`, { standalone: true })], consumed: 2 };
}

function redirectAllBySourceOfChoice(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = pair(list, i);
  if (p === null) return null;
  const { r, e } = p;
  const rep = r.replaces as { ev?: string; source?: unknown; recipient?: { player?: unknown; object?: { is?: unknown } } };
  if (rep.ev !== 'damage' || !same(rep.source, { is: { ref: 'bound', name: p.as } }) || rep.recipient === undefined || rep.recipient.player !== undefined) return null;
  if (!same(rep.recipient, { object: { is: rep.recipient.object?.is } }) || rep.recipient.object?.is === undefined) return null;
  const b = r.body;
  if (b.b !== 'redirect' || b.amount !== undefined || r.shield !== undefined) return null;
  const dur = K.dur(e.duration!, st);
  const from = K.obj(rep.recipient.object.is as never, st, 'object').text;
  const to = K.obj(b.to as never, st, 'object').text;
  return { clauses: [plain(`all damage that would be dealt${dur ? ` ${dur}` : ''} to ${from} by a source of your choice is dealt to ${to} instead`, { standalone: true })], consumed: 2 };
}

function redirectNextFromSourceOfChoice(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = pair(list, i);
  if (p === null) return null;
  const { r, e } = p;
  if (!same(r.replaces, { ev: 'damage', source: { is: { ref: 'bound', name: p.as } }, recipient: { player: 'you', object: { controller: 'you' } } })) return null;
  const b = r.body;
  if (b.b !== 'redirect' || b.amount === undefined || !same(r.shield, { uses: 'all', amount: b.amount })) return null;
  const dur = K.dur(e.duration!, st);
  const to = K.obj(b.to as never, st, 'object').text;
  return { clauses: [plain(`the next ${K.qty(b.amount, st)} damage that a source of your choice would deal to you and/or permanents you control${dur ? ` ${dur}` : ''} is dealt to ${to} instead`, { standalone: true })], consumed: 2 };
}

function preventNextFromSourceOfChoiceThenDamage(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const p = pair(list, i);
  if (p === null) return null;
  const { r, e } = p;
  if (!same(r.replaces, { ev: 'damage', source: { is: { ref: 'bound', name: p.as } }, recipient: { player: 'you', object: { controller: 'you' } } })) return null;
  const b = r.body;
  if (b.b !== 'prevent' || b.amount === 'all' || b.then === undefined || b.then.length !== 1 || b.as !== undefined || b.oncePerBatch !== undefined || !same(r.shield, { uses: 'all' })) return null;
  const d = b.then[0]!;
  if (d.op !== 'damage' || !same(d.source, { ref: 'self' }) || !same(d.amount, { q: 'preventedAmount' }) || Object.keys(d).some((k) => !['op', 'source', 'to', 'amount'].includes(k))) return null;
  const dur = K.dur(e.duration!, st);
  const to = K.obj(d.to as never, st, 'object').text;
  return { clauses: [plain(`prevent the next ${K.qty(b.amount, st)} damage that a source of your choice would deal to you and/or permanents you control${dur ? ` ${dur}` : ''}. if damage is prevented this way, ${K.obj(d.source, st, 'subject').text} deals that much damage to ${to}`, { standalone: true })], consumed: 2 };
}

/**
 * `redirectAllByObjToPlayer` (CR 614.9, 611.2a, 120.3; Reverberation, eff.edhe18.redirect.all.byObj.dur): the one `effect` step with one `replace` of all the damage one object (a target) would
 * deal, to anything, dealt to a player instead, for the duration: "All damage that would be dealt this turn by target sorcery spell is dealt to that spell's controller instead."
 */
function redirectAllByObjToPlayer(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const e = list[i];
  if (e?.op !== 'effect' || e.guard !== undefined || e.as !== undefined || e.effects.length !== 1 || e.duration === undefined) return null;
  const r = e.effects[0]!;
  if (r.s !== 'replace' || r.condition !== undefined || r.optional !== undefined || r.selfReplacement !== undefined || r.shield !== undefined) return null;
  const rep = r.replaces as { ev?: string; source?: { is?: unknown } };
  if (rep.ev !== 'damage' || !same(Object.keys(rep).sort(), ['ev', 'source']) || rep.source?.is === undefined || !same(Object.keys(rep.source), ['is'])) return null;
  const b = r.body;
  if (b.b !== 'redirect' || b.amount !== undefined) return null;
  const dur = K.dur(e.duration, st);
  const from = K.obj(rep.source.is as never, st, 'object').text;
  const to = K.player(b.to as never, st, 'object').text;
  const toText = to === 'its controller' ? alt("that spell's controller", 'its controller') : to;
  return { clauses: [plain(`all damage that would be dealt${dur ? ` ${dur}` : ''} by ${from} is dealt to ${toText} instead`, { standalone: true })], consumed: 1 };
}

export function foldEdhE18(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return preventNextBySourceOfChoice(list, i, st) ?? redirectAllBySourceOfChoice(list, i, st) ?? redirectNextFromSourceOfChoice(list, i, st) ?? preventNextFromSourceOfChoiceThenDamage(list, i, st) ?? redirectAllByObjToPlayer(list, i, st);
}
