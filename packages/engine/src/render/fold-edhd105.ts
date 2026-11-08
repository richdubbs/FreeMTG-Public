/**
 * edh-d-105 (Commander coordinator D, EDHREC top 30,000, groups copy and type-change; code edhd105): the folds of its readings (parser/templates/zz-cloud/edh-d-105.json), called from
 * render/fold.ts#foldAt. Each applies only when every part is exactly what the idiom says.
 *
 * `choiceOfTwo` (CR 608.2d, 611.2c, 613.1d, 613.4b): a choice between two answers made by you as the ability resolves, then one `if` per answer, each holding ONE continuous effect on the
 * same object for the same duration, said as one sentence with "or":
 *   - "Target land becomes a Plains or an Island until end of turn." (Tundra Kavu, eff.edhd105.becomes.landTypeChoiceOfTwo): each answer a land type the effect sets (CR 305.7);
 *   - "Until end of turn, target creature has base power 1 or base toughness 1." (Vhati il-Dal, eff.edhd105.basePowerOrToughness): one answer sets the base power, the other the
 *     base toughness (layer 7b);
 *   - "you may have ~'s base power and toughness become 4/1 or 1/4 until end of turn." (Master of Winds, eff.edhd105.may.basePt.choiceOfTwo): inside your option, each answer a base power
 *     and toughness.
 * Nothing after the steps reads the choice.
 */
import type { ContinuousEffectDef, EffectStep, ObjRef } from '../types/ability';
import { plain } from './clause';
import type { Folded } from './fold';
import { K } from './kernel';
import type { RenderState } from './state';
import { article } from './text';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

interface Branches { effects: ContinuousEffectDef[]; answers: string[]; duration: NonNullable<Extract<EffectStep, { op: 'effect' }>['duration']> }

/** The chooseValue at list[i] and its two guarded effects (one continuous effect each, same object and duration), or null. */
function branchesAt(list: EffectStep[], i: number): Branches | null {
  const c = list[i];
  if (c?.op !== 'chooseValue' || c.what !== 'option' || c.link === undefined || c.who.ref !== 'you' || c.guard !== undefined) return null;
  if (c.min !== undefined || c.max !== undefined || c.exclude !== undefined || c.secret !== undefined || c.random !== undefined || c.forEachPlayer !== undefined) return null;
  const answers = c.options ?? [];
  if (answers.length !== 2 || answers[0] === answers[1]) return null;
  const effects: ContinuousEffectDef[] = [];
  let duration: Branches['duration'] | undefined;
  for (let k = 0; k < 2; k++) {
    const b = list[i + 1 + k];
    if (b?.op !== 'if' || b.else !== undefined || b.guard !== undefined || b.as !== undefined || b.then.length !== 1) return null;
    if (b.cond.cond !== 'chosen' || b.cond.link !== c.link || b.cond.equals !== answers[k] || Object.keys(b.cond).length !== 3) return null;
    const e = b.then[0]!;
    if (e.op !== 'effect' || e.effects.length !== 1 || e.guard !== undefined || e.as !== undefined || e.duration === undefined) return null;
    if (Object.keys(e).some((x) => !['op', 'duration', 'effects'].includes(x))) return null;
    const ce = e.effects[0]!;
    if (ce.s !== 'continuous' || Object.keys(ce).some((x) => !['s', 'affects', 'mods'].includes(x)) || ce.mods.length !== 1) return null;
    if (duration !== undefined && !same(duration, e.duration)) return null;
    if (effects.length > 0 && !same(effects[0]!.affects, ce.affects)) return null;
    duration = e.duration;
    effects.push(ce);
  }
  if (JSON.stringify(list.slice(i + 3)).includes(`"${c.link}"`)) return null;
  return { effects, answers: [...answers], duration: duration! };
}

/** A layer-4 change that sets the land subtypes to exactly this one basic land type, and nothing else. */
function setsLandType(e: ContinuousEffectDef, name: string): boolean {
  return same(e.mods[0], { layer: 4, subtypes: { set: [name] } }) && ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(name);
}

/** A layer-7b change with these keys and number values only. */
function base7b(e: ContinuousEffectDef, keys: string): Record<string, number> | null {
  const m = e.mods[0] as unknown as Record<string, unknown>;
  if (m['layer'] !== '7b' || Object.keys(m).filter((k) => k !== 'layer').sort().join(',') !== keys) return null;
  for (const k of keys.split(',')) if (typeof m[k] !== 'number') return null;
  return m as Record<string, number>;
}

function choiceOfTwo(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const b = branchesAt(list, i);
  if (b === null) return null;
  const [e1, e2] = b.effects as [ContinuousEffectDef, ContinuousEffectDef];
  const [a1, a2] = b.answers as [string, string];
  if (e1.affects.ref === 'each' || e1.affects.ref === 'self') return null;
  // land types: "<object> becomes a Plains or an Island <duration>"
  if (setsLandType(e1, a1) && setsLandType(e2, a2)) {
    const subj = K.obj(e1.affects as ObjRef, st, 'subject');
    const dur = K.dur(b.duration, st);
    if (subj.plural || !dur) return null;
    return { clauses: [plain(`${subj.text} becomes ${article(a1)} ${a1} or ${article(a2)} ${a2} ${dur}`)], consumed: 3 };
  }
  // base power or base toughness: "<duration>, <object> has base power N or base toughness M"
  const p = base7b(e1, 'power');
  const t = base7b(e2, 'toughness');
  if (p !== null && t !== null && a1 === 'power' && a2 === 'toughness') {
    const dur = K.dur(b.duration, st);
    const subj = K.obj(e1.affects as ObjRef, st, 'subject');
    if (subj.plural || !dur) return null;
    return { clauses: [plain(`${dur}, ${subj.text} has base power ${p['power']} or base toughness ${t['toughness']}`, { standalone: true })], consumed: 3 };
  }
  return null;
}

/** "you may have <object>'s base power and toughness become 4/1 or 1/4 <duration>": your option holding the choice between two base sizes (each answer its size). */
function mayBasePtChoiceOfTwo(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const m = list[i];
  if (m?.op !== 'may' || m.guard !== undefined || m.as !== undefined || m.otherwise !== undefined || !same(m.who, { ref: 'you' }) || m.do.length !== 3) return null;
  if (Object.keys(m).some((k) => !['op', 'who', 'do'].includes(k))) return null;
  const b = branchesAt(m.do, 0);
  if (b === null) return null;
  const sizes = b.effects.map((e) => base7b(e, 'power,toughness'));
  if (sizes.some((s) => s === null)) return null;
  const said = sizes.map((s) => `${s!['power']}/${s!['toughness']}`);
  if (said[0] !== b.answers[0] || said[1] !== b.answers[1]) return null;
  const aff = b.effects[0]!.affects;
  if (aff.ref === 'each') return null;
  const subj = K.obj(aff as ObjRef, st, 'subject');
  const dur = K.dur(b.duration, st);
  if (subj.plural || !dur) return null;
  return { clauses: [plain(`you may have ${subj.text}'s base power and toughness become ${said[0]} or ${said[1]} ${dur}`, { standalone: true })], consumed: 1 };
}

export function foldEdhD105(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return choiceOfTwo(list, i, st) ?? mayBasePtChoiceOfTwo(list, i, st);
}
