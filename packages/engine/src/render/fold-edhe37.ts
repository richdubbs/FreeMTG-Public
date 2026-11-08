/**
 * edh-e-37 (Commander coordinator E, graveyard 1/3): the folds of its templates (parser/templates/zz-cloud/edh-e-37.json), called from render/fold.ts#foldAt. Each applies only when every
 * part is exactly what the idiom says.
 *
 * `returnGreatestPowerFromGraveyard` (CR 608.2d, 608.2c, 400.3, 208.1; Desecrator Hag; templates eff.edhe37.return.greatestPower.fromYourGraveyard.hand and
 * eff.edhe37.tiedGreatestPower.youChoose): "Return to your hand the creature card in your graveyard with the greatest power. If two or more cards are tied for greatest power, you choose one of them.":
 * of the described cards in your graveyard, the ones whose power equals the greatest power among them are the choices (so a tie is yours to break), and the one you choose goes to your hand.
 * The second sentence adds no step: the choice among tied cards is the `chooseObjects` itself. Exactly the two steps of the first template.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';
import { bind } from './steps-util';
import { alt } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function returnGreatestPowerFromGraveyard(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const a = list[i];
  const b = list[i + 1];
  if (a?.op !== 'chooseObjects' || a.guard !== undefined || a.random !== undefined || a.groupLimit !== undefined || a.startingWith !== undefined || a.perPlayer !== undefined || a.min !== 1 || a.max !== 1 || a.as === undefined) return null;
  if (!same(a.who, { ref: 'you' }) || a.from.ref !== 'each') return null;
  const f = a.from.filter;
  if (f.anyOf?.length !== 1 || f.zone !== 'graveyard' || f.owner !== 'you' || f.isCard !== true || Object.keys(f).some((k) => !['anyOf', 'zone', 'owner', 'isCard', 'power'].includes(k))) return null;
  const { power: _p, ...pool } = f;
  const greatest = { op: '==', value: { q: 'stat', stat: 'power', of: { ref: 'each', filter: pool }, agg: 'max' } };
  if (!same(f.power, greatest)) return null;
  if (b?.op !== 'move' || b.guard !== undefined || b.as !== undefined || b.until !== undefined || b.link !== undefined || !same(b.what, { ref: 'bound', name: a.as }) || !same(b.to, { zone: 'hand' })) return null;
  if (list.slice(i + 2).some((x) => JSON.stringify(x).includes(`"${a.as}"`))) return null;
  const kind = f.anyOf[0]!;
  bind(st, a.as, { nouns: [...K.nounsOf(kind), 'card'], plural: false });
  const card = K.np({ ...kind, isCard: true, zone: 'graveyard' }, st, { det: 'the', noZone: true });
  return { clauses: [plain(`return to your hand ${card} in your graveyard with the greatest power. if two or more cards are tied for greatest power, you choose one of them`, { standalone: true })], consumed: 2 };
}

/**
 * `controllerReturnsSelfFromGraveyard` (CR 303.4f-g, 400.3, 110.2a, 603.10a; Traveling Plague; template eff.edhe37.thatControllerReturnsSelf.ownersGraveyard.bf): "When enchanted creature leaves the
 * battlefield, that creature's controller returns this Aura from its owner's graveyard to the battlefield.": the source itself (an Aura now in its owner's graveyard) is put onto the
 * battlefield under the control of the player who controlled the creature that left (the event's subject, as it last existed); that player also chooses what the Aura enchants. Exactly
 * the one `move` of the template, said either as the Oracle does or as the generic "put it onto the battlefield under that player's control".
 */
function controllerReturnsSelfFromGraveyard(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const m = list[i];
  if (m?.op !== 'move' || m.guard !== undefined || m.as !== undefined || m.until !== undefined || m.link !== undefined || Object.keys(m).sort().join(',') !== 'op,to,what') return null;
  if (!same(m.what, { ref: 'self', moved: true })) return null; // (`moved`: the lowering marks a card that moved, CR 400.7)
  if (!same(m.to, { zone: 'battlefield', controller: { ref: 'controllerOf', object: { ref: 'event', role: 'subject' } } })) return null;
  const self = K.obj({ ref: 'self' }, st, 'subject').text;
  return { clauses: [plain(alt(`that creature's controller returns ${self} from its owner's graveyard to the battlefield`, `put ${self} onto the battlefield under that creature's controller's control`), { standalone: true })], consumed: 1 };
}

/** The folds of edh-e-37 (render/fold.ts#foldAt). */
export function foldEdhE37(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return returnGreatestPowerFromGraveyard(list, i, st) ?? controllerReturnsSelfFromGraveyard(list, i, st);
}
