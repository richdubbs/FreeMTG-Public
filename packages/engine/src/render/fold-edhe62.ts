/**
 * edh-e-62 (Commander coordinator E, groups copy / control / dice-random; code edhe62): the folds of its templates (parser/templates/zz-cloud/edh-e-62.json), called from
 * render/steps.ts#foldHere. Each applies only when every part is exactly what the idiom says. A value import of render/fold.ts here would make an import cycle (render/steps.ts imports both).
 *
 * `tapThenGainsControlOfThem` (CR 701.26a, 611.2a, 613.1b, 608.2c; Rohgahh of Kher Keep): "Tap ~ and all creatures named X, then an opponent gains control of them.": the tap of a set of
 * permanents, then the permanent change of control of the SAME set (the group named again by `them`, judged when the control effect is created, not by what the tap did: an already tapped
 * permanent still changes control). Exactly the two steps of template eff.edhe62.tap.thenPlayerGainsControlOfThem.
 */
import type { EffectStep } from '../types/ability';
import { plain } from './clause';
import { bind } from './steps-util';
import type { Folded } from './fold';
import type { RenderState } from './state';
import type { FoldDeps } from './fold-edhn72';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function tapThenGainsControlOfThem(list: EffectStep[], i: number, st: RenderState, { clause }: FoldDeps): Folded | null {
  const [t, e] = [list[i], list[i + 1]];
  if (t?.op !== 'tap' || e?.op !== 'effect' || t.guard !== undefined || e.guard !== undefined || t.as !== undefined || e.as !== undefined) return null;
  if (!same(e.duration, { d: 'permanent' }) || e.effects.length !== 1) return null;
  const c = e.effects[0]!;
  if (c.s !== 'continuous' || c.mods.length !== 1 || !same(c.affects, t.what)) return null;
  const m = c.mods[0]!;
  if (m.layer !== 2 || Object.keys(m).sort().join() !== 'controller,layer') return null;
  const first = clause(t, st);
  const second = clause(e, st);
  // the players' words are everything before " gains control of" (the object words after it may carry alternative wordings of their own, which "them" replaces)
  const at = second.sub.indexOf(' gains control of ');
  if (at <= 0 || !first.imp.startsWith('tap ')) return null;
  return { clauses: [plain(`${first.imp}, then ${second.sub.slice(0, at)} gains control of them`, { standalone: true })], consumed: 2 };
}

const TIED_LOWEST_LIFE = { ref: 'extremePlayer', stat: 'life', fewest: true, tied: true };

/**
 * `tiedYouChooseOneGainsControl` (CR 603.4, 608.2d, 119.1, 613.1b; Loxodon Peacekeeper): "If two or more players are tied for lowest life total, you choose one of them, and that player gains control
 * of this creature.": when the condition holds, you choose one of the players tied (`chooseValue` with `among`), and that player gets control (a permanent change of control). Exactly the one `if` of
 * template eff.edhe62.ifTiedLowestLife.youChooseOne.gainsControl.
 */
function tiedYouChooseOneGainsControl(list: EffectStep[], i: number, st: RenderState, { clause }: FoldDeps): Folded | null {
  const s = list[i];
  if (s?.op !== 'if' || s.guard !== undefined || s.else !== undefined || s.then.length !== 2) return null;
  if (!same(s.cond, { cond: 'hasPlayer', who: TIED_LOWEST_LIFE })) return null;
  const [c, e] = s.then;
  if (c?.op !== 'chooseValue' || c.guard !== undefined || c.what !== 'player' || !same(c.who, { ref: 'you' }) || !same(c.among, TIED_LOWEST_LIFE) || Object.keys(c).sort().join() !== 'among,as,op,what,who') return null;
  if (e?.op !== 'effect' || e.guard !== undefined || e.as !== undefined || !same(e.duration, { d: 'permanent' }) || e.effects.length !== 1) return null;
  const k = e.effects[0]!;
  if (k.s !== 'continuous' || k.mods.length !== 1 || !same(k.mods[0], { layer: 2, controller: { ref: 'bound', name: c.as } })) return null;
  bind(st, c.as, { nouns: ['player'], plural: false, player: true, rebinds: 'chosenPlayer' });
  const gain = clause(e, st);
  return { clauses: [plain(`if two or more players are tied for lowest life total, you choose one of them, and ${gain.sub}`, { standalone: true })], consumed: 1 };
}

export function foldEdhE62(list: EffectStep[], i: number, st: RenderState, deps: FoldDeps): Folded | null {
  return tapThenGainsControlOfThem(list, i, st, deps) ?? tiedYouChooseOneGainsControl(list, i, st, deps);
}
