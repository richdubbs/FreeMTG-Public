/**
 * edh-e-30: the folds of its readings, called from render/fold.ts#foldAt.
 *
 * `chooseThenSticker` (CR 123.3, 123.3b, 608.2d; Ticketomaton): "put a sticker on a nonland permanent you own": the controller chooses one permanent of the description they own as the
 * instruction resolves (no target), then puts a sticker on it. Only that choice by "you" of exactly one object, then exactly the `putSticker` of the same player on what was chosen.
 */
import type { EffectStep, ObjRef } from '../types/ability';
import type { Folded } from './fold';
import { plain } from './clause';
import { K } from './kernel';
import type { RenderState } from './state';
import { bind } from './steps-util';
import { dur } from './dur';
import { COLOR_WORD, pluralize } from './text';

const isBound = (r: ObjRef, as: string | undefined): boolean => as !== undefined && (r as { ref?: string; name?: string }).ref === 'bound' && (r as { name?: string }).name === as;

function chooseThenSticker(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const a = list[i];
  const b = list[i + 1];
  if (a?.op !== 'chooseObjects' || b?.op !== 'putSticker' || a.random === true || a.guard !== undefined || b.guard !== undefined || b.as !== undefined || a.groupLimit !== undefined) return null;
  if (a.who.ref !== 'you' || b.who.ref !== 'you' || a.min !== 1 || a.max !== 1 || a.perPlayer !== undefined || !isBound(b.on, a.as)) return null;
  const fromFilter = a.from.ref === 'each' && 'filter' in a.from ? a.from.filter : null;
  if (fromFilter === null || (fromFilter.zone !== undefined && fromFilter.zone !== 'battlefield')) return null;
  const text = `put a${b.sticker === 'name' ? ' name' : ''} sticker on ${K.np(fromFilter, st, { det: 'a' })}`;
  bind(st, a.as, { nouns: K.nounsOf(fromFilter), plural: false });
  return { clauses: [plain(text)], consumed: 2 };
}

/**
 * `allCreaturesColorAllLandsSubtype` (CR 105.3, 305.7, 613.1d-e, 611.2a; Nightcreep): "Until end of turn, all creatures become black and all lands become Swamps.": one `effect` step of exactly two
 * continuous effects over the same duration, the colour of every creature set, then the land types of every land set (template eff.edhe30.allCreaturesColorAllLandsSubtype).
 */
function allCreaturesColorAllLandsSubtype(list: EffectStep[], i: number, st: RenderState): Folded | null {
  const a = list[i];
  if (a?.op !== 'effect' || a.guard !== undefined || a.effects.length !== 2 || a.duration.d === 'permanent') return null;
  const [c, l] = a.effects as unknown as { s: string; affects: { ref?: string; filter?: Record<string, unknown> }; mods: { layer: number; colors?: { set?: string[] }; subtypes?: { set?: string[] } }[] }[];
  const only = (e: typeof c, t: string): boolean => e?.s === 'continuous' && e.affects.ref === 'each' && JSON.stringify(e.affects.filter) === JSON.stringify({ types: [t] }) && e.mods.length === 1;
  if (!only(c!, 'Creature') || !only(l!, 'Land')) return null;
  const color = c!.mods[0]!.colors?.set;
  const subs = l!.mods[0]!.subtypes?.set;
  if (c!.mods[0]!.layer !== 5 || l!.mods[0]!.layer !== 4 || color?.length !== 1 || subs?.length !== 1 || COLOR_WORD[color[0]!] === undefined) return null;
  if (!['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(subs[0]!)) return null; // a basic land type only (CR 305.6, 305.7): the review's "all lands become Zombies" is not read
  return { clauses: [plain(`${dur(a.duration, st)}, all creatures become ${COLOR_WORD[color[0]!]} and all lands become ${pluralize(subs[0]!).toLowerCase()}`)], consumed: 1 };
}

export function foldEdhE30(list: EffectStep[], i: number, st: RenderState): Folded | null {
  return chooseThenSticker(list, i, st) ?? allCreaturesColorAllLandsSubtype(list, i, st);
}
