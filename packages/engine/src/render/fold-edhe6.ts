/**
 * edh-e-6 (Commander coordinator E, graveyard 1/3): the folds of its templates (parser/templates/zz-cloud/edh-e-6.json), called from render/fold.ts#foldAtPlain.
 * Each applies only when every part is exactly what the idiom says.
 *
 * `opponentChoosesFromRevealedPutRest` (CR 608.2c, 608.2d, 701.20a, 401.4; Animal Magnetism): "An opponent chooses a creature card from among them. Put that card onto the battlefield
 * and the rest into your graveyard.": after a reveal of the top cards of your library, an opponent picks one card of the description from the revealed group, you put it onto the
 * battlefield under your control and every other revealed card goes to its owner's graveyard (the cards were in your library: your graveyard).
 */
import type { EffectStep, ObjectFilter } from '../types/ability';
import type { Folded } from './fold';
import { plain } from './clause';
import { K } from './kernel';
import type { RenderState } from './state';

const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v);
/** Whole-value equality, key order aside: a field the idiom does not name (random, unchosen, upTo, ...) makes the step another one. */
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function opponentChoosesFromRevealedPutRest(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const c = list[i];
  const a = list[i + 1];
  const b = list[i + 2];
  if (c?.op !== 'chooseObjects' || a?.op !== 'move' || b?.op !== 'move' || c.as === undefined || [c, a, b].some((x) => x.guard !== undefined)) return null;
  if (c.from.ref !== 'each') return null;
  const f = c.from.filter as ObjectFilter & { anyOf?: ObjectFilter[]; is?: { ref: string; name?: string } };
  const group = f.is;
  if (group?.ref !== 'bound' || group.name === undefined || f.zone !== 'library' || f.anyOf?.length !== 1 || !same(Object.keys(f).sort(), ['anyOf', 'is', 'zone'])) return null;
  if (!same(c, { op: 'chooseObjects', who: { ref: 'anOpponent' }, from: { ref: 'each', filter: f }, min: 1, max: 1, as: c.as })) return null;
  const rev = list[i - 1];
  if (rev?.op !== 'reveal' || rev.as !== group.name || !same(rev.who, { ref: 'you' }) || !same(Object.keys(rev).sort(), ['as', 'op', 'what', 'who'])) return null;
  if (!same(a, { op: 'move', what: { ref: 'bound', name: c.as }, to: { zone: 'battlefield', controller: { ref: 'you' } } })) return null;
  if (!same(b, { op: 'move', what: { ref: 'each', filter: { is: { ref: 'bound', name: group.name }, not: { is: { ref: 'bound', name: c.as } }, zone: 'library' } }, to: { zone: 'graveyard' } })) return null;
  const np = K.np({ ...f.anyOf[0]!, zone: 'library' }, st, { det: 'a', noZone: true });
  return { clauses: [plain(`an opponent chooses ${np} from among them. put that card onto the battlefield and the rest into your graveyard`, { standalone: true })], consumed: 3 };
}

/**
 * `revealOpponentMayGiveElse` (CR 608.2c, 608.2d, 701.20a, 400.3; Covenant of Minds): "Reveal the top three cards of your library. Target opponent may choose to put those cards into
 * your hand. If they don't, put those cards into your graveyard and draw five cards.": the revealed cards go to your hand if that player chooses to, else to your graveyard and you draw.
 */
function revealOpponentMayGiveElse(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const r = list[i];
  const m = list[i + 1];
  if (r?.op !== 'reveal' || m?.op !== 'may' || r.as === undefined || r.guard !== undefined || m.guard !== undefined || m.otherwise?.length !== 2 || m.do.length !== 1) return null;
  if (typeof (r.what as { count?: unknown }).count !== 'number' || !same(r, { op: 'reveal', who: { ref: 'you' }, what: { ref: 'topCards', player: { ref: 'you' }, count: (r.what as { count: number }).count }, as: r.as })) return null;
  if (!same(m, { op: 'may', who: m.who, do: m.do, otherwise: m.otherwise })) return null;
  const bound = { ref: 'bound', name: r.as };
  if (!same(m.do, [{ op: 'move', what: bound, to: { zone: 'hand' } }])) return null;
  const [back, draw] = m.otherwise as [EffectStep, EffectStep];
  if (!same(back, { op: 'move', what: bound, to: { zone: 'graveyard' } }) || draw?.op !== 'draw' || typeof draw.count !== 'number' || !same(draw, { op: 'draw', who: { ref: 'you' }, count: draw.count })) return null;
  const who = K.player(m.who, st, 'subject');
  if (who.person !== 'sg' || who.text !== 'target opponent') return null;
  return { clauses: [plain(`reveal the top ${(r.what as { count: number }).count} cards of your library. ${who.text} may choose to put those cards into your hand. if they don't, put those cards into your graveyard and draw ${draw.count} cards`, { standalone: true })], consumed: 2 };
}

/**
 * `opponentChoosesTopTwoGraveyard` (CR 608.2c, 608.2d, 404.1, 406.1; Phyrexian Grimoire): "Target opponent chooses one of the top two cards of your graveyard. Exile that card and put the
 * other one into your hand.": the chosen card of the two on top of your graveyard is exiled and the other, now on top, goes to your hand.
 */
function opponentChoosesTopTwoGraveyard(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const c = list[i];
  const x = list[i + 1];
  const h = list[i + 2];
  if (c?.op !== 'chooseObjects' || x?.op !== 'move' || h?.op !== 'move' || c.as === undefined || [c, x, h].some((y) => y.guard !== undefined)) return null;
  const top = (count: number) => ({ ref: 'topCards', player: { ref: 'you' }, count, zone: 'graveyard' });
  if (!same(c, { op: 'chooseObjects', who: c.who, from: top(2), min: 1, max: 1, as: c.as })) return null;
  if (!same(x, { op: 'move', what: { ref: 'bound', name: c.as }, to: { zone: 'exile' } }) || !same(h, { op: 'move', what: top(1), to: { zone: 'hand' } })) return null;
  const who = K.player(c.who, st, 'subject');
  if (who.person !== 'sg' || who.text !== 'target opponent') return null;
  return { clauses: [plain(`${who.text} chooses one of the top two cards of your graveyard. exile that card and put the other one into your hand`, { standalone: true })], consumed: 3 };
}

export function foldEdhE6(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return opponentChoosesFromRevealedPutRest(list, i, st) ?? revealOpponentMayGiveElse(list, i, st) ?? opponentChoosesTopTwoGraveyard(list, i, st);
}
