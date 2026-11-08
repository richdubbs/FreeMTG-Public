/**
 * edh-d-107 (Commander coordinator D, groups graveyard 1/3 and 2/3): the fold of its dig riders (parser/templates/zz-cloud/edh-d-107.json), called from render/steps.ts#foldHere.
 *
 * `digCountInstead` (CR 608.2c, 614.15, 701.20a; Gather the Pack, See the Unwritten): "Reveal the top five cards of your library. You may put a creature card from among them into
 * your hand. Put the rest into your graveyard. If C, put up to two creature cards from among the revealed cards into your hand instead of one." The rider (template
 * rid.edhd107.dig.upToInstead.hand, rid.edhd107.dig.mayInstead.battlefield) made the choice an `if` of two choices that differ only in how many cards may be chosen; the move of the
 * chosen cards and the move of the rest follow as for the plain sentences. Printed as the plain sentences of the smaller choice (the ordinary renderings of its steps), then the
 * rider sentence in the words of its template, with the destination of the move that follows (so a rider whose words name another destination fails the gate).
 */
import type { EffectStep } from '../types/ability';
import type { Clause } from './clause';
import type { Folded } from './fold';
import type { RenderState } from './state';
import { K } from './kernel';
import { numWord } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The renderer's own functions, handed in by render/steps.ts (which imports render/fold.ts; a value import of either here would make an import cycle). */
export interface FoldDeps {
  clausesOf: (list: EffectStep[], st: RenderState) => Clause[];
}

export function foldEdhD107(list: EffectStep[], i: number, st: RenderState, deps: FoldDeps): Folded | null {
  return digCountInstead(list, i, st, deps) ?? returnAllThenSame(list, i, st, deps);
}

/**
 * `returnAllThenSame` (CR 608.2c, 400.7, 303.4f; Estrid, the Masked, template eff.edhd107.return.all.gy.bf.thenSameFor): "Return all non-Aura enchantment cards from your graveyard to the
 * battlefield, then do the same for Aura cards.": two moves of all the cards of a description in your graveyard onto the battlefield under your control, the second after the first (so an Aura
 * can enchant a permanent the first returned). Printed as the first move's ordinary rendering and the second's description; only that exact pair.
 */
function returnAllThenSame(list: EffectStep[], i: number, st: RenderState, { clausesOf }: FoldDeps): Folded | null {
  const [a, b] = [list[i], list[i + 1]];
  const bf = { zone: 'battlefield', controller: { ref: 'you' } };
  if (a?.op !== 'move' || b?.op !== 'move' || a.guard !== undefined || b.guard !== undefined || !same(a.to, bf) || !same(b.to, bf) || a.as !== undefined || b.as !== undefined) return null;
  if (a.what.ref !== 'each' || b.what.ref !== 'each' || !('filter' in a.what) || !('filter' in b.what)) return null;
  const [fa, fb] = [a.what.filter, b.what.filter];
  if (fa.zone !== 'graveyard' || fa.owner !== 'you' || fb.zone !== 'graveyard' || fb.owner !== 'you' || fb.isCard !== true) return null;
  const { zone: _z, owner: _o, ...desc } = fb;
  if (Object.keys(desc).some((k) => !['isCard', 'types', 'subtypes', 'supertypes', 'notSubtypes', 'notTypes', 'colors', 'not'].includes(k)) || Object.keys(desc).length < 2) return null;
  const first = clausesOf([a], st);
  if (first.length !== 1) return null;
  const tail = `, then do the same for ${K.np({ ...desc, zone: 'graveyard' }, st, { det: 'none', plural: true, noZone: true })}`;
  const c = first[0]!;
  return { clauses: [{ ...c, imp: c.imp + tail, sub: c.sub + tail, standalone: true, ...(c.have !== undefined ? { have: c.have + tail } : {}) }], consumed: 2 };
}

function digCountInstead(list: EffectStep[], i: number, st: RenderState, { clausesOf }: FoldDeps): Folded | null {
  const [r, f] = [list[i], list[i + 1]];
  if (r?.op !== 'reveal' || r.guard !== undefined || typeof r.as !== 'string' || r.what.ref !== 'topCards') return null;
  if (f?.op !== 'if' || f.guard !== undefined || f.else?.length !== 1 || f.then.length !== 1) return null;
  const [a, b] = [f.then[0], f.else[0]];
  if (a?.op !== 'chooseObjects' || b?.op !== 'chooseObjects' || a.guard !== undefined || b.guard !== undefined || typeof a.max !== 'number' || b.max !== 1 || a.max < 2 || a.min !== 0 || b.min !== 0) return null;
  const { max: _am, ...ra } = a;
  const { max: _bm, ...rb } = b;
  if (!same(ra, rb) || !same(a.who, { ref: 'you' }) || a.from.ref !== 'each' || a.from.filter?.anyOf?.length !== 1 || !same(a.from.filter.is, { ref: 'bound', name: r.as }) || a.random === true) return null;
  const [move, rest] = [list[i + 2], list[i + 3]];
  if (move?.op !== 'move' || move.guard !== undefined || !same(move.what, { ref: 'bound', name: a.as }) || rest?.op !== 'move' || rest.guard !== undefined) return null;
  const to = same(move.to, { zone: 'hand' }) ? 'hand' : same(move.to, { zone: 'battlefield' }) || same(move.to, { zone: 'battlefield', controller: { ref: 'you' } }) ? 'battlefield' : null;
  if (to === null) return null;
  const items = clausesOf([r, b, move, rest], st);
  const kind = a.from.filter.anyOf[0]!;
  if (Object.keys(kind).join() !== 'types' || kind.types?.length !== 1) return null; // one card type, said as "<type> cards"
  const cards = `${kind.types[0]!.toLowerCase()} cards`;
  const n = numWord(a.max);
  const c = K.cond(f.cond, st);
  const text = to === 'hand'
    ? `if ${c}, put up to ${n} ${cards} from among the revealed cards into your hand instead of one`
    : `if ${c}, you may put ${n} ${cards} onto the battlefield instead of one`;
  return { clauses: [...items, { imp: text, sub: text, actor: null, standalone: true }], consumed: 4 };
}
