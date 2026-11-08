/**
 * trek-23: the fold of its templates (parser/templates/zz-cloud/trek-23.json), called from render/fold.ts#foldAt.
 *
 * `looksThenExilesBy`: "Target opponent looks at the top card of your library, then exiles it face down." / "You look at the top two cards of their library, then exile them face
 * down." (Vulcan Mind-Meld; CR 701.20e, 406.3, 608.2c): a player looks at the top cards of a library, then that same player (the move's `by`, the look's `who`) exiles exactly the
 * cards they looked at, face down, as one sentence with that player as the subject of both verbs. The cards stay named for a later sentence ("each card exiled this way") by the
 * move's binding. Only that shape: a move with `by` is built by these templates alone.
 */
import type { EffectStep, ObjRef } from '../types/ability';
import { acting, plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import { identityOf } from './refs';
import type { RenderState } from './state';
import { bind } from './steps-util';

const isBound = (ref: ObjRef, name: string | undefined): boolean => name !== undefined && ref.ref === 'bound' && ref.name === name;

function looksThenExilesBy(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const a = list[i];
  const b = list[i + 1];
  if (a?.op !== 'look' || b?.op !== 'move' || a.as === undefined || a.guard !== undefined || b.guard !== undefined || b.until !== undefined || b.link !== undefined || b.remember !== undefined) return null;
  if (b.by === undefined || JSON.stringify(b.by) !== JSON.stringify(a.who) || a.at.ref !== 'topCards' || a.rebind !== undefined || !isBound(b.what, a.as)) return null;
  if (JSON.stringify(b.to) !== '{"zone":"exile","faceDown":true}') return null;
  const one = a.at.count === 1;
  const look = K.clause(a, st);
  const them = one ? 'it' : 'them'; // Oracle's words only (no new equivalence: render/equivalence.ts#ALT_SITES)
  if (b.as !== undefined) bind(st, b.as, { nouns: ['card'], plural: !one, zone: 'exile', sameAs: identityOf(st, `b:${a.as}`) });
  if (a.who.ref === 'you') return { clauses: [acting('you', `${look.imp}, then exile ${them} face down`, `${look.sub}, then exile ${them} face down`)], consumed: 2 };
  if (look.pred === undefined) return null;
  return { clauses: [plain(`${look.sub}, then exiles ${them} face down`)], consumed: 2 };
}

export function foldTrek23(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return looksThenExilesBy(list, i, st);
}
