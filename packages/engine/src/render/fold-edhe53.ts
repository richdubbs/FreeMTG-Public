/**
 * edh-e-53 (Commander coordinator E, group attach, second batch): the folds of its templates (parser/templates/zz-cloud/edh-e-53.json), called from render/fold.ts#foldAt. Each applies
 * only when every part is exactly what the idiom says, with no guard, name, duration or link on any step.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * `attachToAnotherCreature` (CR 701.3a-b, 303.4a, 303.4d, 608.2d; Crown of the Ages, Kitsune Mystic, eff.edhe53.attach.toAnotherCreature; family attach-to-another-creature): "Attach
 * target Aura attached to a creature to another creature.": its controller chooses the creature as the ability resolves (only the Aura is targeted), among the creatures other than the
 * one the Aura is attached to that it could enchant, and attaches the Aura to it. Only those two steps, the choice made by you, of exactly one creature.
 */
function attachToAnotherCreature(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [c, a] = [list[i], list[i + 1]];
  if (c?.op !== 'chooseObjects' || a?.op !== 'attach' || c.as === undefined) return null;
  if (c.guard !== undefined || a.guard !== undefined || a.as !== undefined || a.hostAs !== undefined || a.asCreature !== undefined) return null;
  if (!same(c.who, { ref: 'you' }) || c.min !== 1 || c.max !== 1 || c.random !== undefined || c.distinct !== undefined || c.groupLimit !== undefined || c.perPlayer !== undefined || c.startingWith !== undefined) return null;
  if (c.from.ref !== 'each' || !same(a.to, { ref: 'bound', name: c.as })) return null;
  const f = c.from.filter;
  if (f.auraMovesTo === undefined || !same(f, { types: ['Creature'], auraMovesTo: f.auraMovesTo }) || !same(a.what, f.auraMovesTo)) return null;
  // only an Aura is moved this way (an Equipment is attached to creatures only, by another rule): the target must be described as an Aura
  if (a.what.ref !== 'target' || !(st.specs.get(a.what.id)?.filter?.subtypes ?? []).includes('Aura')) return null;
  const aura = K.obj(a.what, st, 'object');
  if (aura.plural) return null;
  return { clauses: [plain(`attach ${aura.text} to another creature`, { standalone: true })], consumed: 2 };
}

export function foldEdhE53(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return attachToAnotherCreature(list, i, st);
}
