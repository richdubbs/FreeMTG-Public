/**
 * Commander coordinator E, round edh-e-11 (group library 3/3): the round's readings played through the engine with synthetic cards (invented names, design 6.10), with negative cases.
 * CR cites are from memory (no rules text in a cloud session): 614.15, 608.2c, 608.2d, 401.4, 701.20a, 121.1, 121.2.
 */
import { describe, expect, it } from 'vitest';
import { compileCard, legalActions, type CardDef, type GameState, type ObjectId, type OracleCard, type PlayerId } from '../../../src/index';
import { getChars } from '../../../src/rules/characteristics';
import { act, answer, find, findAll, legal, pass, pool, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, o: { pt?: [string, string]; cost?: string; colors?: string[] } = {}): CardDef {
  return compileCard({
    name, layout: 'normal', mana_cost: o.cost ?? '{0}', type_line: type, oracle_text: text, colors: o.colors ?? [], keywords: [],
    ...(o.pt ? { power: o.pt[0], toughness: o.pt[1] } : {}),
  } as OracleCard);
}
/** Nothing of the card is left manual. */
const noManual = (d: CardDef): boolean => !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const chars = (s: GameState, id: ObjectId) => getChars(s, id);

/** Answer the decisions that come up until priority (payments automatic; yes/no from `yes` in order, then `yes`; picks: the first allowed, or the named cards). */
function drive(s0: GameState, o: { targets?: ObjectId[]; yes?: boolean[]; pick?: string[]; x?: number; color?: 'R' | 'G' | 'W' | 'U' | 'B'; players?: PlayerId[] } = {}): GameState {
  let s = s0;
  const targets = [...(o.targets ?? [])];
  const yes = [...(o.yes ?? [])];
  const pick = [...(o.pick ?? [])];
  const nameOf = (id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
  for (let guard = 0; guard < 80 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets') {
      const d = p as unknown as { players: PlayerId[]; objects: ObjectId[]; min: number };
      const obs = targets.filter((x) => d.objects.includes(x));
      if (obs.length > 0) { for (const ob of obs) targets.splice(targets.indexOf(ob), 1); s = answer(s, { kind: 'chooseTargets', targets: obs.map((id) => ({ kind: 'object' as const, id })) }); }
      else if ((o.players ?? []).some((x) => d.players.includes(x))) s = answer(s, { kind: 'chooseTargets', targets: [{ kind: 'player', id: (o.players ?? []).find((x) => d.players.includes(x))! }] });
      else s = answer(s, { kind: 'chooseTargets', targets: d.min === 0 ? [] : d.players.length > 0 ? [{ kind: 'player', id: d.players[0]! }] : [{ kind: 'object', id: d.objects[0]! }] });
    }
    else if (p.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: p.options.slice(0, p.min).map((x) => x.id) });
    else if (p.kind === 'chooseObjects') {
      // (one object per named card, in the order of the names; the first allowed ones when no name is given)
      const named = pick.map((n) => p.options.find((id) => nameOf(id) === n)).filter((x): x is ObjectId => x !== undefined);
      const want = pick.length > 0 && named.length > 0 ? named.slice(0, p.max) : p.options.slice(0, p.max);
      s = answer(s, { kind: 'chooseObjects', ids: want });
    }
    else if (p.kind === 'chooseColor') s = answer(s, { kind: 'chooseColor', color: o.color ?? p.options[0]! });
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: o.x ?? p.min });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: yes.length > 0 ? yes.shift()! : true });
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((x) => x.id) });
    else throw new Error(`unexpected decision ${p.kind}`);
  }
  return s;
}
function resolveAll(s0: GameState, o: Parameters<typeof drive>[1] = {}): GameState {
  let s = drive(s0, o);
  for (let i = 0; i < 24 && s.zones.stack.length > 0; i++) s = drive(pass(s), o);
  return s;
}
const hand = (s: GameState, p: PlayerId): string[] => s.zones.hand[p]!.map((id) => chars(s, id).name).sort();
const bf = (s: GameState, p?: PlayerId): string[] => s.zones.battlefield.filter((id) => p === undefined || s.objects[id]!.controller === p).map((id) => chars(s, id).name).sort();
const gy = (s: GameState, p: PlayerId): string[] => s.zones.graveyard[p]!.map((id) => chars(s, id).name).sort();
const lib = (s: GameState, p: PlayerId): number => s.zones.library[p]!.length;
const castC = (s: GameState, name: string, p: PlayerId = 'p1'): GameState => act(s, { type: 'cast', player: p, card: find(s, name, 'hand', p) });
const activate = (s: GameState, name: string, p: PlayerId = 'p1'): GameState => {
  const a = legal(s, p, 'activate').find((x) => x.label.startsWith(`${name}:`));
  if (!a) throw new Error(`no activation of ${name}`);
  return act(s, a.action);
};
const canActivate = (s: GameState, name: string, p: PlayerId = 'p1'): boolean => legal(s, p, 'activate').some((x) => x.label.startsWith(`${name}:`));

const FOREST = card('Test Forest', 'Basic Land — Forest', '{T}: Add {G}.');
const ISLAND = card('Test Island', 'Basic Land — Island', '{T}: Add {U}.');
const SWAMP = card('Test Swamp', 'Basic Land — Swamp', '{T}: Add {B}.');
const MOUNTAIN = card('Test Mountain', 'Basic Land — Mountain', '{T}: Add {R}.');
const ELF = card('Test Elf', 'Creature — Elf', '', { pt: ['1', '1'], colors: ['G'] });
const BEAR = card('Test Plain Bear', 'Creature — Bear', '', { pt: ['2', '2'], colors: ['W'] });

// ---- Magus of the Order -----------------------------------------------------------------------------------------------------------------------------------------------
const MAGUS = card('Test Magus', 'Creature — Human Wizard', '{G}, {T}, Sacrifice this creature and another green creature: Search your library for a green creature card, put it onto the battlefield, then shuffle.', { pt: ['2', '2'], cost: '{2}{G}{G}', colors: ['G'] });
// ---- Expel from Orazca / Sweep Away / Ether Well ----------------------------------------------------------------------------------------------------------------------
const EXPEL = card('Test Expel', 'Instant', 'Return target creature to its owner\'s hand. If you control a Wizard, you may put that creature on top of its owner\'s library instead.', { cost: '{0}', colors: ['U'] });
const SWEEP = card('Test Sweep', 'Instant', 'Return target creature to its owner\'s hand. If that creature is attacking, you may put it on top of its owner\'s library instead.', { colors: ['U'] });
const WELL = card('Test Well', 'Instant', 'Put target creature on top of its owner\'s library. If that creature is red, you may put it on the bottom of its owner\'s library instead.', { colors: ['U'] });
const WIZ = card('Test Wizard', 'Creature — Wizard', '', { pt: ['1', '1'], colors: ['U'] });
const REDBEAR = card('Test Red Bear', 'Creature — Bear', '', { pt: ['2', '2'], colors: ['R'] });
const GREENELF = card('Test Green Elf', 'Creature — Elf', '', { pt: ['1', '1'], colors: ['G'] });
const top = (s: GameState, p: PlayerId): string | undefined => { const id = s.zones.library[p]![0]; return id === undefined ? undefined : chars(s, id).name; };
const bottom = (s: GameState, p: PlayerId): string | undefined => { const l = s.zones.library[p]!; const id = l[l.length - 1]; return id === undefined ? undefined : chars(s, id).name; };

describe('CR 614.15, 608.2d, 401.4: "Return target creature to its owner\'s hand. If C, you may put that creature on top of its owner\'s library instead."', () => {
  const defs = [EXPEL, WIZ, BEAR, FOREST];
  it('is fully automated', () => { expect(noManual(EXPEL) && EXPEL.automation.level === 'full').toBe(true); });
  const board = (wizard: boolean): GameState => scenario([], { defs, p1: { hand: ['Test Expel'], battlefield: wizard ? ['Test Wizard'] : [], library: ['Test Forest'] }, p2: { battlefield: ['Test Plain Bear'] } });
  const bear = (): ObjectId => find(board(true), 'Test Plain Bear', 'battlefield', 'p2');
  it('the condition holds and you accept: the creature goes on top of its owner\'s library, not to the hand', () => {
    const s = resolveAll(castC(board(true), 'Test Expel'), { targets: [bear()], yes: [true] });
    expect(top(s, 'p2')).toBe('Test Plain Bear');
    expect(hand(s, 'p2')).toEqual([]);
    expect(bf(s, 'p2')).toEqual([]);
  });
  it('the condition holds and you decline: the creature is returned to its owner\'s hand as the first sentence says', () => {
    const s = resolveAll(castC(board(true), 'Test Expel'), { targets: [bear()], yes: [false] });
    expect(hand(s, 'p2')).toEqual(['Test Plain Bear']);
    expect(lib(s, 'p2')).toBe(lib(board(true), 'p2'));
  });
  it('the negative case: the condition does not hold (no Wizard), the creature is returned to the hand and nothing is asked', () => {
    const s = resolveAll(castC(board(false), 'Test Expel'), { targets: [bear()], yes: [true] });
    expect(hand(s, 'p2')).toEqual(['Test Plain Bear']);
    expect(lib(s, 'p2')).toBe(lib(board(true), 'p2'));
  });
});

describe('CR 614.15, 401.4: "Put target creature on top of its owner\'s library. If that creature is red, you may put it on the bottom of its owner\'s library instead."', () => {
  const defs = [WELL, REDBEAR, GREENELF, FOREST];
  it('is fully automated', () => { expect(noManual(WELL) && WELL.automation.level === 'full').toBe(true); });
  const board = (target: string): GameState => scenario([], { defs, p1: { hand: ['Test Well'] }, p2: { battlefield: [target], library: ['Test Forest'] } });
  it('a red creature and you accept: it goes to the bottom; declined: it stays on top', () => {
    const b = board('Test Red Bear');
    const t = find(b, 'Test Red Bear', 'battlefield', 'p2');
    const yes = resolveAll(castC(b, 'Test Well'), { targets: [t], yes: [true] });
    expect(bottom(yes, 'p2')).toBe('Test Red Bear');
    expect(top(yes, 'p2')).toBe('Test Forest');
    const no = resolveAll(castC(b, 'Test Well'), { targets: [t], yes: [false] });
    expect(top(no, 'p2')).toBe('Test Red Bear');
  });
  it('the negative case: a green creature always goes on top', () => {
    const b = board('Test Green Elf');
    const s = resolveAll(castC(b, 'Test Well'), { targets: [find(b, 'Test Green Elf', 'battlefield', 'p2')], yes: [true] });
    expect(top(s, 'p2')).toBe('Test Green Elf');
  });
});

describe('CR 608.2c, 506.4: "If that creature is attacking, you may put it on top of its owner\'s library instead"', () => {
  it('is fully automated', () => { expect(noManual(SWEEP) && SWEEP.automation.level === 'full').toBe(true); });
  const defs = [SWEEP, BEAR, FOREST];
  const board = (): GameState => scenario([], { defs, p1: { hand: ['Test Sweep'] }, p2: { battlefield: ['Test Plain Bear'], library: ['Test Forest'] } });
  it('a creature that is not attacking is returned to the hand and nothing is asked (the negative case)', () => {
    const b = board();
    const s = resolveAll(castC(b, 'Test Sweep'), { targets: [find(b, 'Test Plain Bear', 'battlefield', 'p2')], yes: [true] });
    expect(hand(s, 'p2')).toEqual(['Test Plain Bear']);
  });
});

// ---- Baleful Stare / Withering Gaze ------------------------------------------------------------------------------------------------------------------------------------
const STARE = card('Test Stare', 'Sorcery', 'Target opponent reveals their hand. You draw a card for each Mountain and red card in it.', { colors: ['R'] });
const GAZE = card('Test Gaze', 'Sorcery', 'Target opponent reveals their hand. You draw a card for each Forest and green card in it.', { colors: ['G'] });
describe('CR 701.20a, 121.1, 608.2c: "Target opponent reveals their hand. You draw a card for each Mountain and red card in it."', () => {
  const defs = [STARE, GAZE, MOUNTAIN, FOREST, REDBEAR, GREENELF, ISLAND];
  it('is fully automated', () => { expect(noManual(STARE) && STARE.automation.level === 'full' && noManual(GAZE) && GAZE.automation.level === 'full').toBe(true); });
  const board = (): GameState => scenario([], { defs, p1: { hand: ['Test Stare', 'Test Gaze'], library: ['Test Island', 'Test Island', 'Test Island', 'Test Island'] }, p2: { hand: ['Test Mountain', 'Test Red Bear', 'Test Green Elf', 'Test Forest', 'Test Island'] } });
  it('draws one card for each card of the hand that is a Mountain or red (a Mountain and a red creature: two; green and Island cards are not counted)', () => {
    const s = resolveAll(castC(board(), 'Test Stare'), { players: ['p2'] });
    expect(hand(s, 'p1').filter((n) => n === 'Test Island').length).toBe(2);
  });
  it('the Forest/green card pair draws for the Forest and the green creature only', () => {
    const s = resolveAll(castC(board(), 'Test Gaze'), { players: ['p2'] });
    expect(hand(s, 'p1').filter((n) => n === 'Test Island').length).toBe(2);
  });
  it('the negative case: an opponent hand without any such card draws nothing', () => {
    const b = scenario([], { defs, p1: { hand: ['Test Stare'], library: ['Test Island', 'Test Island'] }, p2: { hand: ['Test Island', 'Test Forest'] } });
    const s = resolveAll(castC(b, 'Test Stare'), { players: ['p2'] });
    expect(hand(s, 'p1').filter((n) => n === 'Test Island').length).toBe(0);
  });
});

// ---- Rowen / Primitive Etchings -----------------------------------------------------------------------------------------------------------------------------------------
const ROWEN = card('Test Rowen', 'Legendary Enchantment', 'Reveal the first card you draw each turn. Whenever you reveal a basic land card this way, draw a card.', { cost: '{2}{G}', colors: ['G'] });
describe('CR 701.20a, 121.2: "Reveal the first card you draw each turn. Whenever you reveal a basic land card this way, draw a card."', () => {
  const CANTRIP = card('Test Cantrip', 'Instant', 'Draw a card.');
  const defs = [ROWEN, CANTRIP, FOREST, ISLAND, ELF];
  it('is fully automated', () => { expect(noManual(ROWEN) && ROWEN.automation.level === 'full').toBe(true); });
  it('the first card drawn each turn is revealed, a basic land drawn that way draws another card; a nonland card does not', () => {
    const land = scenario([], { defs, p1: { hand: ['Test Cantrip'], battlefield: ['Test Rowen'], library: ['Test Forest', 'Test Island', 'Test Island'] } });
    const sl = resolveAll(castC(land, 'Test Cantrip'), {});
    expect(hand(sl, 'p1')).toEqual(['Test Forest', 'Test Island']);
    const nl = scenario([], { defs, p1: { hand: ['Test Cantrip'], battlefield: ['Test Rowen'], library: ['Test Elf', 'Test Island', 'Test Island'] } });
    const sn = resolveAll(castC(nl, 'Test Cantrip'), {});
    expect(hand(sn, 'p1')).toEqual(['Test Elf']);
  });
});
