/**
 * edh-e-65 (Commander effort, coordinator E, graveyard/library): the folds of its templates (parser/templates/zz-cloud/edh-e-65.json), called from render/fold.ts#foldAt.
 * Each applies only when every part is exactly what the idiom says.
 *
 * `controllerSacrificesThenRevealsUntil` (CR 701.21a, 701.20a-b, 109.4, 608.2c; Shape Anew, eff.edhe65.controllerOf.sacrifices.thenRevealsUntil): "The controller of target artifact
 * sacrifices it, then reveals cards from the top of their library until they reveal an artifact card.": the controller of the target sacrifices exactly that permanent and
 * then, as the same player, reveals from their own library. Only those two steps, with the same player in both.
 */
import type { EffectStep } from '../types/ability';
import { acting } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function controllerSacrificesThenRevealsUntil(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const [a, rv] = [list[i], list[i + 1]];
  if (a?.op !== 'sacrificeChoice' || rv?.op !== 'revealUntil' || a.who.ref !== 'controllerOf' || rv.who.ref !== 'controllerOf' || !same(a.who, rv.who) || a.who.object.ref !== 'target') return null;
  if (a.guard !== undefined || rv.guard !== undefined || a.count !== 1 || !same(a.filter, { is: a.who.object }) || rv.count !== undefined) return null;
  if (Object.keys(a).some((k) => !['op', 'who', 'filter', 'count'].includes(k)) || Object.keys(rv).some((k) => !['op', 'who', 'filter', 'as', 'revealed'].includes(k))) return null;
  const target = K.obj(a.who.object, st, 'object'); // names the target, as "the controller of target artifact"
  if (target.plural) return null;
  K.clause(a, st); // binds what the sacrifice names, for the sentences after
  const pred = K.clause(rv, st).pred;
  if (pred === undefined || !pred.startsWith('reveals ') || !pred.includes('cards from the top of their library until they reveal ')) return null;
  const text = `the controller of ${target.text} sacrifices it, then ${pred}`;
  return { clauses: [acting('x', text, text, { standalone: true })], consumed: 2 };
}

/** The folds of edh-e-65 (render/fold.ts#foldAt). */
export function foldEdhE65(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return controllerSacrificesThenRevealsUntil(list, i, st);
}
