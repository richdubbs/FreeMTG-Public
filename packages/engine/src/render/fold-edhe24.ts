/**
 * edh-e-24 (Commander coordinator E): the folds of its templates (parser/templates/zz-cloud/edh-e-24.json), called from render/fold.ts#foldAt. Each applies only when every part
 * is exactly what the idiom says.
 *
 * `sacrificeAAndB` (CR 701.21a, 608.2d; Perilous Predicament, eff.edhe24.player.sacrifices.aAndB.ofTheirChoice): "Each opponent sacrifices an artifact creature and a nonartifact creature of
 * their choice.": two sacrifices of one player, each of a described permanent, said as one sentence. The template writes `mode: 'choose'` (the default way, CR 701.21a) on both, which
 * marks the pair as this wording: Vile Mutilator's "sacrifices a nontoken enchantment of their choice, then sacrifices a nontoken creature of their choice" keeps its own.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function sacrificeAAndB(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, b] = [list[i], list[i + 1]];
  if (list.length !== 2 || i !== 0 || a?.op !== 'sacrificeChoice' || b?.op !== 'sacrificeChoice') return null; // (the whole effect: Smallpox's "sacrifices a creature, then sacrifices a land" is a longer list and keeps its own wording)
  for (const s of [a, b]) {
    if (s.guard !== undefined || s.mode !== 'choose' || s.cantAs !== undefined || s.exploit !== undefined || s.keepTypes !== undefined || s.keepFilter !== undefined || s.chooser !== undefined || s.as !== undefined || s.count !== 1) return null;
  }
  if (!same(a.who, b.who)) return null;
  const who = K.player(a.who, st, 'subject');
  if (who.person !== 'sg') return null; // (a group of players says "sacrifices" too: "each opponent"; a plural subject would say "sacrifice")
  const one = K.np({ ...a.filter, controller: undefined }, st, { det: 'a', noController: true });
  const two = K.np({ ...b.filter, controller: undefined }, st, { det: 'a', noController: true });
  return { clauses: [plain(`${who.text} sacrifices ${one} and ${two} of their choice`, { standalone: true })], consumed: 2 };
}

export function foldEdhE24(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return sacrificeAAndB(list, i, st);
}
