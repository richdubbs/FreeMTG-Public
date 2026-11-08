/**
 * edh-d-111 folds: shapes only the round's own templates build (parser/templates/zz-cloud/edh-d-111.json).
 *
 * `mayPutOneTopRestBottom` (CR 701.20e, 608.2c-d, 401.4; Voda Sea Scavenger, eff.edhd111.dig.mayPutOne.top): "You may put one of those cards on top of your library. Put the rest on the
 * bottom of your library in a random order (in any order).": you choose at most one card of the group looked at (any card of it: no description), put it on top, and the others of the group
 * on the bottom. Only that exact shape, with nothing after it reading the choice.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { groupPool, restOfGroup } from './refs';
import type { RenderState } from './state';
import { bind } from './steps-util';
import { alt } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function mayPutOneTopRestBottom(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, m, n] = [list[i], list[i + 1], list[i + 2]];
  if (a?.op !== 'chooseObjects' || m?.op !== 'move' || n?.op !== 'move' || a.as === undefined || !same(a.who, { ref: 'you' }) || a.min !== 0 || a.max !== 1) return null;
  if (a.random === true || a.guard !== undefined || a.distinct !== undefined || a.groupLimit !== undefined || a.perPlayer !== undefined || a.startingWith !== undefined) return null;
  if (m.guard !== undefined || m.as !== undefined || m.until !== undefined || m.link !== undefined || m.remember !== undefined || !same(m.what, { ref: 'bound', name: a.as }) || !same(m.to, { zone: 'library', position: 'top' })) return null;
  if (n.guard !== undefined || n.as !== undefined || n.until !== undefined || n.link !== undefined || n.remember !== undefined || n.what.ref !== 'each') return null;
  const order = same(n.to, { zone: 'library', position: 'bottom', order: 'random' }) ? 'a random order' : same(n.to, { zone: 'library', position: 'bottom', order: 'chosen' }) ? 'any order' : null;
  const pool = groupPool(a.from);
  if (pool === null || pool.desc !== null || order === null || pool.group.ref !== 'bound') return null;
  const rest = restOfGroup(n.what.filter);
  if (rest === null || rest.chosen !== a.as || rest.group !== pool.group.name) return null;
  if (list.slice(i + 3).some((x) => JSON.stringify(x).includes(`"name":"${a.as}"`))) return null;
  const them = K.obj(pool.group, st, 'object');
  if (!them.plural) return null;
  const text = `you may put one of ${alt(them.text, 'those cards', 'them')} on top of your library. put the rest on the bottom of your library in ${order}`;
  bind(st, a.as, { nouns: ['card'], plural: false });
  return { clauses: [plain(text, { closesScope: true })], consumed: 3 };
}

/**
 * `hitHandRestBottomAny` (CR 701.20a, 608.2c, 401.4; Explosive Revelation, eff.edhd111.putThat.hand.rest.bottomChosen): "Put the nonland card into your hand and the rest on the bottom of your
 * library in any order." after your own "reveal cards from the top of your library until you reveal a nonland card": the card it stopped at, named with its description again (`untilDesc`,
 * render/steps-cards.ts#revealUntil), beside the plain "that card". Only those two moves: the card into your hand, the other revealed cards to the bottom in an order you choose.
 */
function hitHandRestBottomAny(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [m, n] = [list[i], list[i + 1]];
  if (m?.op !== 'move' || n?.op !== 'move' || m.what.ref !== 'bound' || n.what.ref !== 'each') return null;
  if ([m, n].some((x) => x.guard !== undefined || x.as !== undefined || x.until !== undefined || x.link !== undefined || x.remember !== undefined)) return null;
  if (!same(m.to, { zone: 'hand' }) || !same(n.to, { zone: 'library', position: 'bottom', order: 'chosen' })) return null;
  const desc = st.info.get(`b:${m.what.name}`)?.untilDesc;
  const f = n.what.filter;
  if (desc === undefined || f.is?.ref !== 'bound' || f.not?.is?.ref !== 'bound' || f.not.is.name !== m.what.name || f.zone !== 'library') return null;
  const that = K.obj(m.what, st, 'object').text;
  const rest = K.obj(n.what, st, 'object').text;
  const tail = `into your hand and ${rest} on the bottom of your library in any order`;
  return { clauses: [plain(alt(`put ${that} ${tail}`, `put the ${desc} ${tail}`))], consumed: 2 };
}

export function foldEdhD111(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return mayPutOneTopRestBottom(list, i, st) ?? hitHandRestBottomAny(list, i, st);
}
