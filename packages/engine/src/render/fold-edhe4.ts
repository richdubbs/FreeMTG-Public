/**
 * edh-e-4 (Commander coordinator E, group vote-secret): the folds of its templates (parser/templates/zz-cloud/edh-e-4.json), called from render/fold.ts#foldAtPlain.
 *
 * `exileSeparatePiles` (CR 700.3, 700.3a, 701.13a, 608.2c-d; template eff.edhe4.exileTargets.separateTwoPiles; Split the Spoils): "Exile up to five target permanent cards from your
 * graveyard and separate them into two piles. An opponent chooses one of those piles. Put that pile into your hand and the other into your graveyard.": your exile of the
 * targets, your separation of exactly those cards into two piles, another player's choice of a pile, then your moves of the chosen pile and of the other. Only that exact shape.
 */
import type { EffectStep, ObjRef } from '../types/ability';
import { acting, fragment, plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { destPhrase } from './steps-util';
import type { RenderState } from './state';

const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([x], [y]) => (x < y ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const boundTo = (r: unknown, name: string | undefined): boolean => name !== undefined && same(r, { ref: 'bound', name });

function exileSeparatePiles(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const x = list[i];
  const p = list[i + 1];
  const m1 = list[i + 2];
  const m2 = list[i + 3];
  if (x?.op !== 'move' || p?.op !== 'piles' || m1?.op !== 'move' || m2?.op !== 'move' || p.faceDown !== undefined) return null;
  if (x.guard !== undefined || p.guard !== undefined || m1.guard !== undefined || m2.guard !== undefined || m1.until || m2.until || x.until) return null;
  if (!same(x.to, { zone: 'exile' }) || x.as === undefined || !boundTo(p.cards, x.as) || !same(p.separator, { ref: 'you' })) return null;
  if (!same(p.chooser, { ref: 'anOpponent' }) || !boundTo(m1.what, p.chosen) || !boundTo(m2.what, p.other)) return null;
  const simple = (z: string): boolean => z === 'hand' || z === 'graveyard';
  if (!simple(m1.to.zone) || !simple(m2.to.zone) || m1.to.zone === m2.to.zone) return null;
  if (list.slice(i + 4).some((s) => [x.as, p.chosen, p.other].some((n) => n !== undefined && JSON.stringify(s).includes(`"${n}"`)))) return null;
  const exile = fragment(K.clause(x, st));
  K.clause(p, st); // binds the pile names
  const saved = st.actor;
  st.actor = 'you';
  const moves = `put that pile ${destPhrase(m1.to, st, false, true)} and the other ${destPhrase(m2.to, st, false, true)}`;
  st.actor = saved;
  const text = `${exile} and separate them into two piles. an opponent chooses one of those piles. ${moves}`;
  return { clauses: [acting('you', text, text, { standalone: true })], consumed: 4 };
}

/**
 * `exileItAndTopNPileCloak` (CR 406.3, 701.58a, 701.58e, 701.24a, 608.2c; template eff.edhe4.exileItAndTopN.pile.cloak; Become Anonymous): "exile target nontoken creature you own and
 * the top two cards of your library in a face-down pile, shuffle that pile, then cloak those cards": the object and your top N cards exiled face down, then exactly those cards
 * cloaked in a random order (the pile's shuffle, the `shuffle` argument of the cloak). Only that exact shape.
 */
function exileItAndTopNPileCloak(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [m1, m2, a] = [list[i], list[i + 1], list[i + 2]];
  const plain = (m: EffectStep | undefined): boolean => m?.op === 'move' && m.guard === undefined && m.until === undefined && m.as !== undefined && same(m.to, { zone: 'exile', faceDown: true });
  if (m1?.op !== 'move' || m2?.op !== 'move' || a?.op !== 'action' || !plain(m1) || !plain(m2) || a.guard !== undefined || m1.what.ref === 'each' || m1.what.ref === 'topCards') return null;
  if (m2.what.ref !== 'topCards' || !same(m2.what.player, { ref: 'you' }) || typeof m2.what.count !== 'number' || m2.what.count < 2) return null;
  if (a.action !== 'cloak' || a.arg !== 'shuffle' || !same(a.who, { ref: 'you' }) || a.n !== undefined || a.as !== undefined) return null;
  if (!same(a.subject, { ref: 'union', of: [{ ref: 'bound', name: m1.as }, { ref: 'bound', name: m2.as }] })) return null;
  if (list.slice(i + 3).some((s) => [m1.as, m2.as].some((n) => JSON.stringify(s).includes(`"${n}"`)))) return null;
  const what = K.obj(m1.what as ObjRef, st, 'object').text;
  const text = `exile ${what} and the top ${m2.what.count} cards of your library in a face-down pile, shuffle that pile, then cloak those cards`;
  // (CR 614.1c) `tapped` is the sentence "They enter tapped." after the cloak
  const tail = a.tapped === true ? '. they enter tapped' : '';
  return { clauses: [acting('you', `${text}${tail}`, `you ${text}${tail}`, { standalone: a.tapped === true })], consumed: 3 };
}

const SECRET_NUMBER = { op: 'chooseValue', who: { ref: 'each', who: 'player' }, what: 'number', min: 0, secret: true, reveal: true, as: 'secretNumber', link: 'secretNumber' };
const HIGHEST = { ref: 'choseNumber', link: 'secretNumber', extreme: 'highest' };

/**
 * `secretNumberHighestLosesLife` (CR 608.2d, 107.1b, 119.3, 101.4; templates eff.edhe4.eachPlayer.secretlyChoosesNumber, rid.edhe4.thoseNumbersRevealed,
 * eff.edhe4.eachPlayerWithHighestNumber.losesThatMuchLife, eff.edhe4.ifYouAreOneOfThosePlayers.putCounters; Menacing Ogre): "Each player secretly chooses a number. Then those numbers
 * are revealed. Each player with the highest number loses that much life." and, as a third step, "If you are one of those players, put two +1/+1 counters on this creature."
 * Exactly those steps, in that order.
 */
function secretNumberHighestLosesLife(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [c, l, f] = [list[i], list[i + 1], list[i + 2]];
  if (c?.op !== 'chooseValue' || !same(c, SECRET_NUMBER) || l?.op !== 'loseLife' || l.guard !== undefined || Object.keys(l).some((k) => !['op', 'who', 'amount'].includes(k))) return null;
  if (!same(l.who, HIGHEST) || !same(l.amount, { q: 'chosenNumber', link: 'secretNumber', extreme: 'highest' })) return null;
  let text = 'each player secretly chooses a number. then those numbers are revealed. each player with the highest number loses that much life';
  let consumed = 2;
  if (f?.op === 'if' && f.guard === undefined && f.else === undefined && f.then.length === 1 && same(f.cond, { cond: 'playerIs', who: { ref: 'you' }, is: 'you', among: HIGHEST })) {
    const put = f.then[0]!;
    if (put.op !== 'putCounters' || put.guard !== undefined) return null;
    text += `. if you are one of those players, ${K.steps([put], st)}`;
    consumed = 3;
  }
  return { clauses: [plain(text, { standalone: true })], consumed };
}

export function foldEdhE4(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return exileSeparatePiles(list, i, st) ?? exileItAndTopNPileCloak(list, i, st) ?? secretNumberHighestLosesLife(list, i, st);
}
