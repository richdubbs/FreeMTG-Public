/**
 * Commander coordinator E, round edh-e-64 (group graveyard 1/1): the round's readings played through the engine with synthetic cards compiled by the game's default compiler
 * (invented names and wordings, design 6.10), each with its negative case. CR cites from memory, unverified (rules/cr/ is not in the cloud checkout).
 *
 *   CR 115.1, 601.2c, 404.1  "Put any number of target artifact cards from target player's graveyard on top of their library in any order." (the player is a target of its own, announced first)
 *   CR 107.3, 119.3          "Exile X target cards from target player's graveyard. For each card exiled this way, that player loses 1 life and you gain 1 life."
 *   CR 701.23a, 701.23b      "Choose a nonland card name. Search target player's graveyard, hand, and library for all cards with that name and exile them."
 *   CR 701.5a, 701.23a, 201.2 "Counter target sorcery spell. If there are four or more card types among cards in your graveyard, search the graveyard, hand, and library of that spell's controller ..."
 *   CR 701.20a, 701.23b, 201.2 "Then that player reveals their hand and exiles all cards with that name from their hand and graveyard."
 *   CR 701.24a, 400.3, 115.1 "Shuffle ~ and up to three target cards from a single graveyard into their owners' libraries."
 *   CR 105.1, 115.1, 601.2c  "For each color, return up to one target card of that color from your graveyard to your hand."
 *   CR 701.20a, 701.20e, 404.1 "You choose a nonland card from it or a card from their graveyard."
 *   CR 701.23a, 303.4f, 110.2 "... search your graveyard, hand, and/or library for an Aura card and put it onto the battlefield attached to ~."
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type CardDef, type GameState, type ObjectId, type OracleCard, type PlayerId } from '../../../src/index';
import { act, answer, find, findAll, pass, put, scenario } from '../../m3/scenario';

function card(name: string, type: string, text: string, opts: { pt?: [string, string]; cost?: string; colors?: string[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: opts.colors ?? [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as OracleCard);
}
const noManual = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const nameOf = (s: GameState, id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
const names = (s: GameState, zone: 'hand' | 'graveyard' | 'library', p: PlayerId): string[] => (s.zones[zone][p] ?? []).map((id) => nameOf(s, id));
const exiled = (s: GameState): string[] => s.zones.exile.map((id) => nameOf(s, id));
const life = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;

interface Script { targets?: string[][]; pick?: (s: GameState, options: ObjectId[], max: number) => ObjectId[]; x?: number; yes?: boolean; name?: string; asked?: string[]; whose?: PlayerId }
/** Answer every decision: targets in order (player ids allowed), objects by `pick`, mana automatically. */
function drive(s0: GameState, o: Script = {}): GameState {
  let s = s0;
  const tq = o.targets ?? [];
  for (let guard = 0; guard < 80 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    o.asked?.push(p.kind);
    if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: o.pick ? o.pick(s, p.options, p.max) : p.options.slice(0, p.max) });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: (tq.shift() ?? []).map((id) => (/^p\d+$/.test(id) ? { kind: 'player' as const, id } : { kind: 'object' as const, id })) });
    else if (p.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: o.x ?? p.min });
    else if (p.kind === 'chooseName') s = answer(s, { kind: 'chooseName', name: o.name ?? 'Plains' });
    else if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: o.yes ?? true });
    else if (p.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: /whose cards/.test(p.prompt) ? [o.whose ?? 'p2'] : p.options.map((x) => x.id) } as never); // "from a single graveyard": whose; a search of several zones: all of them
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((x) => x.id) });
    else throw new Error(`unexpected decision ${p.kind}: ${JSON.stringify(p).slice(0, 500)}`);
  }
  return s;
}
function resolveAll(s0: GameState, o: Script = {}): GameState {
  let s = drive(s0, o);
  for (let guard = 0; guard < 60 && (s.zones.stack.length > 0 || (s.pending && s.pending.kind !== 'priority')); guard++) s = s.pending?.kind === 'priority' ? pass(s) : drive(s, o);
  return s;
}
const cast = (s: GameState, name: string, o: Script = {}, who: PlayerId = 'p1'): GameState =>
  resolveAll(act(s, { type: 'cast', player: who, card: find(s, name, 'hand', who), ...(o.x !== undefined ? { x: o.x } : {}) } as never), o);
const ids = (s: GameState, zone: 'hand' | 'graveyard' | 'library', p: PlayerId, ...wanted: string[]): string[] => wanted.map((w) => (s.zones[zone][p] ?? []).find((id) => nameOf(s, id) === w)!);
const byName = (...wanted: string[]) => (s: GameState, options: ObjectId[]): ObjectId[] => wanted.map((w) => options.find((id) => nameOf(s, id) === w)!).filter((x) => x !== undefined);

const ROCK = card('Test Rock', 'Artifact', '');
const GEM = card('Test Gem', 'Artifact', '');
const BEAR = card('Test Bear', 'Creature — Bear', '', { pt: ['2', '2'], colors: ['G'] });
const ELF = card('Test Elf', 'Creature — Elf', '', { pt: ['1', '1'], colors: ['G'] });
const SWAMP = card('Test Swamp', 'Basic Land — Swamp', '{T}: Add {B}.');

describe('CR 115.1, 601.2c, 404.1: "Put any number of target artifact cards from target player\'s graveyard on top of their library in any order." (Drafna\'s Restoration)', () => {
  const RESTORE = card('Test Restoration', 'Sorcery', "Put any number of target artifact cards from target player's graveyard on top of their library in any order.");
  const start = (): GameState => scenario([], { defs: [RESTORE, ROCK, GEM, BEAR, ELF], p1: { hand: ['Test Restoration'], graveyard: ['Test Gem'] }, p2: { graveyard: ['Test Rock', 'Test Gem', 'Test Bear'], library: ['Test Elf'] } });
  it('is understood', () => expect(noManual(RESTORE)).toBe(true));
  it('announces the player first, then the artifact cards in THAT player\'s graveyard; the cards go on top of that player\'s library', () => {
    const s0 = start();
    const rock = ids(s0, 'graveyard', 'p2', 'Test Rock')[0]!;
    const gem = ids(s0, 'graveyard', 'p2', 'Test Gem')[0]!;
    const s = cast(s0, 'Test Restoration', { targets: [['p2'], [rock, gem]] });
    expect(names(s, 'library', 'p2').slice(0, 2).sort()).toEqual(['Test Gem', 'Test Rock']);
    expect(names(s, 'graveyard', 'p2')).toEqual(['Test Bear']);
    expect(names(s, 'graveyard', 'p1')).toContain('Test Gem'); // the caster's own artifact card was not touched
  });
  it('negative: only the artifact cards of the chosen player\'s graveyard are offered (not the creature card, not the caster\'s own artifact)', () => {
    const s0 = start();
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Restoration', 'hand', 'p1') });
    expect(s.pending).toMatchObject({ kind: 'chooseTargets', targetText: 'target player' });
    s = answer(s, { kind: 'chooseTargets', targets: [{ kind: 'player', id: 'p2' }] });
    const offered = (s.pending as unknown as { objects: ObjectId[] }).objects.map((id) => `${nameOf(s, id)}:${s.objects[id]!.owner}`).sort();
    expect(offered).toEqual(['Test Gem:p2', 'Test Rock:p2']);
  });
  it('negative: choosing the caster\'s own graveyard offers the caster\'s artifact cards instead; a card of the other graveyard is refused', () => {
    const s0 = start();
    const rock = ids(s0, 'graveyard', 'p2', 'Test Rock')[0]!;
    expect(() => cast(s0, 'Test Restoration', { targets: [['p1'], [rock]] })).toThrow();
    const s = cast(start(), 'Test Restoration', { targets: [['p1'], [ids(s0, 'graveyard', 'p1', 'Test Gem')[0]!]] });
    expect(names(s, 'library', 'p1')[0]).toBe('Test Gem');
  });
});

describe('CR 107.3, 119.3, 608.2h: "Exile X target cards from target player\'s graveyard. For each card exiled this way, that player loses 1 life and you gain 1 life." (Suffer the Past)', () => {
  const DRAIN = card('Test Draught', 'Instant', "Exile X target cards from target player's graveyard. For each card exiled this way, that player loses 1 life and you gain 1 life.", { cost: '{X}{B}', colors: ['B'] });
  const start = (): GameState => scenario([], { defs: [DRAIN, ROCK, GEM, BEAR, SWAMP], p1: { hand: ['Test Draught'], battlefield: ['Test Swamp', 'Test Swamp', 'Test Swamp'] }, p2: { graveyard: ['Test Rock', 'Test Gem', 'Test Bear'] } });
  it('is understood', () => expect(noManual(DRAIN)).toBe(true));
  it('X = 2: two chosen cards are exiled, that player loses 2 and the caster gains 2 (one life-gain event of 2)', () => {
    const s0 = start();
    const s = cast(s0, 'Test Draught', { x: 2, targets: [['p2'], ids(s0, 'graveyard', 'p2', 'Test Rock', 'Test Bear')] });
    expect(exiled(s).sort()).toEqual(['Test Bear', 'Test Rock']);
    expect(names(s, 'graveyard', 'p2')).toEqual(['Test Gem']);
    expect(life(s, 'p2')).toBe(18);
    expect(life(s, 'p1')).toBe(22);
  });
  it('negative: X = 0 exiles nothing and changes no life total', () => {
    const s = cast(start(), 'Test Draught', { x: 0, targets: [['p2'], []] });
    expect(exiled(s)).toEqual([]);
    expect(life(s, 'p2')).toBe(20);
    expect(life(s, 'p1')).toBe(20);
  });
  it('negative: X = 1 with one chosen card is 1 life each (the amount follows the cards exiled, not a fixed number)', () => {
    const s0 = start();
    const s = cast(s0, 'Test Draught', { x: 1, targets: [['p2'], ids(s0, 'graveyard', 'p2', 'Test Gem')] });
    expect(life(s, 'p2')).toBe(19);
    expect(life(s, 'p1')).toBe(21);
  });
});

describe('CR 701.23a, 701.23b, 201.4: "Choose a nonland card name. Search target player\'s graveyard, hand, and library for all cards with that name and exile them. Then that player shuffles." (Cranial Extraction)', () => {
  const EXTRACT = card('Test Extraction', 'Sorcery', "Choose a nonland card name. Search target player's graveyard, hand, and library for all cards with that name and exile them. Then that player shuffles. Draw a card.");
  const start = (): GameState => scenario([], { defs: [EXTRACT, BEAR, ELF], p1: { hand: ['Test Extraction', 'Test Bear'], library: ['Test Elf'] }, p2: { hand: ['Test Bear', 'Test Elf'], graveyard: ['Test Bear'], library: ['Test Bear', 'Test Elf', 'Test Bear'] } });
  it('is understood', () => expect(noManual(EXTRACT)).toBe(true));
  it('exiles every card with the name from the target player\'s graveyard (found, not a choice) and the ones of the hand and library the searcher takes (any number more), and none of the caster\'s', () => {
    const decisions: { min: number; options: number }[] = [];
    const s = cast(start(), 'Test Extraction', { targets: [['p2']], name: 'Test Bear', pick: (st, options) => { decisions.push({ min: (st.pending as unknown as { min: number }).min, options: options.length }); return options; } });
    expect(decisions).toEqual([{ min: 0, options: 3 }]); // the graveyard card is found without a choice; the hand card and the two library cards are the searcher's to take (CR 701.23b)
    expect(exiled(s)).toEqual(['Test Bear', 'Test Bear', 'Test Bear', 'Test Bear']);
    expect(names(s, 'hand', 'p2')).toEqual(['Test Elf']);
    expect(names(s, 'graveyard', 'p2')).toEqual([]);
    expect(names(s, 'library', 'p2').filter((n) => n === 'Test Elf').length).toBe(1);
    expect(names(s, 'library', 'p2')).not.toContain('Test Bear');
    expect(names(s, 'hand', 'p1')).toContain('Test Bear');
  });
  it('"all cards": the graveyard cards are exiled even when the searcher takes none of the hidden ones (CR 701.23b)', () => {
    const s = cast(start(), 'Test Extraction', { targets: [['p2']], name: 'Test Bear', pick: () => [] });
    expect(exiled(s)).toEqual(['Test Bear']);
    expect(names(s, 'graveyard', 'p2')).toEqual([]);
    expect(names(s, 'hand', 'p2')).toContain('Test Bear');
  });
  it('negative: a card with another name stays where it is', () => {
    const s = cast(start(), 'Test Extraction', { targets: [['p2']], name: 'Test Elf' });
    expect(exiled(s)).toEqual(['Test Elf', 'Test Elf']);
    expect(names(s, 'hand', 'p2')).toEqual(['Test Bear']);
    expect(names(s, 'graveyard', 'p2')).toEqual(['Test Bear']);
  });
});

describe('CR 701.5a, 701.23a, 701.24a, 201.2: "Counter target sorcery spell. If there are four or more card types among cards in your graveyard, search the graveyard, hand, and library of that spell\'s controller for any number of cards with the same name as that spell, exile those cards, then that player shuffles." (Invasive Surgery)', () => {
  const PLAGUE = card('Test Plague', 'Sorcery', 'Target player loses 1 life.');
  const SURGERY = card('Test Surgery', 'Instant', "Counter target sorcery spell. If there are four or more card types among cards in your graveyard, search the graveyard, hand, and library of that spell's controller for any number of cards with the same name as that spell, exile those cards, then that player shuffles.");
  const SPELL = card('Test Charm', 'Instant', '');
  const YARD4 = ['Test Rock', 'Test Bear', 'Test Charm', 'Test Plague'];
  const start = (yard: string[]): GameState => scenario([], { defs: [PLAGUE, SURGERY, SPELL, ROCK, BEAR], p1: { hand: ['Test Plague', 'Test Plague'], library: ['Test Plague', 'Test Bear'], graveyard: ['Test Plague'] }, p2: { hand: ['Test Surgery'], graveyard: yard } });
  const counterIt = (yard: string[]): GameState => {
    let s = drive(act(start(yard), { type: 'cast', player: 'p1', card: find(start(yard), 'Test Plague', 'hand', 'p1') }), { targets: [['p2']] });
    s = pass(s); // p1 passes priority with the sorcery on the stack
    expect(s.pending).toMatchObject({ kind: 'priority', player: 'p2' });
    const spell = s.zones.stack[s.zones.stack.length - 1]!;
    s = drive(act(s, { type: 'cast', player: 'p2', card: find(s, 'Test Surgery', 'hand', 'p2') }), { targets: [[spell]] });
    return resolveAll(s);
  };
  it('is understood', () => expect(noManual(SURGERY)).toBe(true));
  it('delirium (four card types in the caster\'s graveyard): the spell is countered and the controller\'s other copies in hand, library and graveyard are exiled; their other cards stay', () => {
    const s = counterIt(YARD4);
    expect(exiled(s).filter((n) => n === 'Test Plague').length).toBe(4); // one in hand, one in library, one in graveyard, and the countered spell itself
    expect(names(s, 'hand', 'p1')).toEqual([]);
    expect(names(s, 'library', 'p1')).not.toContain('Test Plague');
    expect(names(s, 'library', 'p1')).toContain('Test Bear');
    expect(names(s, 'graveyard', 'p1')).toEqual([]);
    expect(life(s, 'p2')).toBe(20); // the sorcery was countered
  });
  it('negative: without four card types the spell is countered and nothing is searched', () => {
    const s = counterIt(['Test Rock', 'Test Bear', 'Test Charm']);
    expect(exiled(s)).toEqual([]);
    expect(names(s, 'hand', 'p1')).toEqual(['Test Plague']);
    expect(names(s, 'graveyard', 'p1').sort()).toEqual(['Test Plague', 'Test Plague']);
  });
});

describe('CR 701.20a, 201.2, 402.3: "Exile target creature an opponent controls with mana value 3 or less and all other creatures that player controls with the same name as that creature. Then that player reveals their hand and exiles all cards with that name from their hand and graveyard." (Legion\'s End)', () => {
  const END = card('Test Legion End', 'Sorcery', 'Exile target creature an opponent controls with mana value 3 or less and all other creatures that player controls with the same name as that creature. Then that player reveals their hand and exiles all cards with that name from their hand and graveyard.');
  const GOBLIN = card('Test Goblin', 'Creature — Goblin', '', { pt: ['1', '1'], colors: ['R'] });
  const start = (): GameState => scenario([], { defs: [END, GOBLIN, BEAR], p1: { hand: ['Test Legion End', 'Test Goblin'], graveyard: ['Test Goblin'] }, p2: { battlefield: ['Test Goblin', 'Test Goblin', 'Test Bear'], hand: ['Test Goblin', 'Test Bear'], graveyard: ['Test Goblin', 'Test Bear'], library: ['Test Goblin'] } });
  it('is understood', () => expect(noManual(END)).toBe(true));
  it('exiles the creature and its namesakes on the battlefield, then every card with that name in the controller\'s hand and graveyard (no choice for them); other names, the library and the caster\'s own cards stay', () => {
    const s0 = start();
    const target = s0.zones.battlefield.find((id) => nameOf(s0, id) === 'Test Goblin')!;
    const asked: string[] = [];
    const s = cast(s0, 'Test Legion End', { targets: [[target]], asked });
    expect(asked).not.toContain('chooseObjects');
    expect(s.zones.battlefield.map((id) => nameOf(s, id))).toEqual(['Test Bear']);
    expect(exiled(s).filter((n) => n === 'Test Goblin').length).toBe(2 + 1 + 1);
    expect(names(s, 'hand', 'p2')).toEqual(['Test Bear']);
    expect(names(s, 'graveyard', 'p2')).toEqual(['Test Bear']);
    expect(names(s, 'library', 'p2')).toContain('Test Goblin'); // only the hand and the graveyard
    expect(names(s, 'hand', 'p1')).toEqual(['Test Goblin']);
    expect(names(s, 'graveyard', 'p1')).toContain('Test Goblin');
  });
  it('negative: a creature with mana value 4 or more is not a legal target', () => {
    const BIG = card('Test Giant', 'Creature — Giant', '', { pt: ['4', '4'], cost: '{4}' });
    const s0 = scenario([], { defs: [END, BIG], p1: { hand: ['Test Legion End'] }, p2: { battlefield: ['Test Giant'] } });
    const big = s0.zones.battlefield.find((id) => nameOf(s0, id) === 'Test Giant')!;
    expect(() => cast(s0, 'Test Legion End', { targets: [[big]] })).toThrow();
  });
});

describe('CR 701.24a, 400.3, 115.1, 608.2b: "Shuffle ~ and up to three target cards from a single graveyard into their owners\' libraries." (Serene Remembrance)', () => {
  const SERENE = card('Test Remembrance', 'Sorcery', "Shuffle ~ and up to three target cards from a single graveyard into their owners' libraries.");
  const start = (): GameState => scenario([], { defs: [SERENE, ROCK, GEM, BEAR, ELF], p1: { hand: ['Test Remembrance'], graveyard: ['Test Gem'] }, p2: { graveyard: ['Test Rock', 'Test Bear', 'Test Elf'], library: ['Test Gem'] } });
  it('is understood', () => expect(noManual(SERENE)).toBe(true));
  it('the spell and the chosen cards of one graveyard go into their owners\' libraries (the spell into the caster\'s); the spell does not go to the graveyard', () => {
    const s0 = start();
    const s = cast(s0, 'Test Remembrance', { targets: [ids(s0, 'graveyard', 'p2', 'Test Rock', 'Test Bear')] });
    expect(names(s, 'library', 'p1')).toContain('Test Remembrance');
    expect(names(s, 'graveyard', 'p1')).toEqual(['Test Gem']);
    expect(names(s, 'library', 'p2')).toEqual(expect.arrayContaining(['Test Rock', 'Test Bear']));
    expect(names(s, 'graveyard', 'p2')).toEqual(['Test Elf']);
  });
  it('zero targets: only the spell is shuffled into its owner\'s library (ruling 2013-01-24)', () => {
    const s = cast(start(), 'Test Remembrance', { targets: [[]] });
    expect(names(s, 'library', 'p1')).toContain('Test Remembrance');
    expect(names(s, 'graveyard', 'p2').length).toBe(3);
  });
  it('negative: more than three cards, or cards of two graveyards, are refused', () => {
    const s0 = start();
    expect(() => cast(s0, 'Test Remembrance', { targets: [[...ids(s0, 'graveyard', 'p2', 'Test Rock', 'Test Bear', 'Test Elf'), ...ids(s0, 'graveyard', 'p1', 'Test Gem')]] })).toThrow();
    expect(() => cast(s0, 'Test Remembrance', { targets: [[ids(s0, 'graveyard', 'p2', 'Test Rock')[0]!, ids(s0, 'graveyard', 'p1', 'Test Gem')[0]!]] })).toThrow();
  });
});

describe('CR 105.1, 115.1, 601.2c: "For each color, return up to one target card of that color from your graveyard to your hand. Exile ~." (All Suns\' Dawn, Rogues\' Gallery)', () => {
  const DAWN = card('Test Dawn', 'Sorcery', 'For each color, return up to one target card of that color from your graveyard to your hand. Exile ~.');
  const GALLERY = card('Test Gallery', 'Sorcery', 'For each color, return up to one target creature card of that color from your graveyard to your hand.');
  const W = card('Test White Card', 'Instant', '', { colors: ['W'] });
  const UW = card('Test Azorius Card', 'Instant', '', { colors: ['W', 'U'] });
  const R = card('Test Red Card', 'Instant', '', { colors: ['R'] });
  const W2 = card('Test White Card Two', 'Instant', '', { colors: ['W'] });
  const RC = card('Test Red Cub', 'Creature — Bear', '', { colors: ['R'], pt: ['1', '1'] });
  const WC = card('Test White Cub', 'Creature — Bear', '', { colors: ['W'], pt: ['1', '1'] });
  const D = [DAWN, GALLERY, W, UW, R, W2, ROCK, RC, WC];
  const start = (): GameState => scenario([], { defs: D, p1: { hand: ['Test Dawn', 'Test Gallery'], graveyard: ['Test White Card', 'Test Azorius Card', 'Test Red Card', 'Test White Card Two', 'Test Rock', 'Test Red Cub', 'Test White Cub'] }, p2: { graveyard: ['Test Rock'] } });
  it('are understood', () => { expect(noManual(DAWN)).toBe(true); expect(noManual(GALLERY)).toBe(true); });
  it('one card for each color: a multicolored card counts for one of its colors; the three cards come to the hand and the spell is exiled', () => {
    const s0 = start();
    const s = cast(s0, 'Test Dawn', { targets: [ids(s0, 'graveyard', 'p1', 'Test White Card', 'Test Azorius Card', 'Test Red Card')] });
    expect(names(s, 'hand', 'p1')).toEqual(expect.arrayContaining(['Test White Card', 'Test Azorius Card', 'Test Red Card']));
    expect(exiled(s)).toEqual(['Test Dawn']);
    expect(names(s, 'graveyard', 'p1')).toContain('Test White Card Two');
  });
  it('the multicolored card is the blue one when another white card is chosen as well (ruling 2004-12-01)', () => {
    const s0 = start();
    const s = cast(s0, 'Test Dawn', { targets: [ids(s0, 'graveyard', 'p1', 'Test White Card', 'Test Azorius Card')] });
    expect(names(s, 'hand', 'p1')).toEqual(expect.arrayContaining(['Test White Card', 'Test Azorius Card']));
  });
  it('negative: two cards that can only be white are refused (one target for each color)', () => {
    const s0 = start();
    expect(() => cast(s0, 'Test Dawn', { targets: [ids(s0, 'graveyard', 'p1', 'Test White Card', 'Test White Card Two')] })).toThrow(/one of each color/);
  });
  it('negative: a colorless card has no color and is refused; so is a card of the other player\'s graveyard', () => {
    const s0 = start();
    expect(() => cast(s0, 'Test Dawn', { targets: [ids(s0, 'graveyard', 'p1', 'Test Rock')] })).toThrow(/one of each color/);
    expect(() => cast(s0, 'Test Dawn', { targets: [ids(s0, 'graveyard', 'p2', 'Test Rock')] })).toThrow();
  });
  it('zero targets are allowed ("up to one"): the spell still exiles itself', () => {
    const s = cast(start(), 'Test Dawn', { targets: [[]] });
    expect(exiled(s)).toEqual(['Test Dawn']);
  });
  it('the creature version takes creature cards only, one for each color', () => {
    const s0 = start();
    const s = cast(s0, 'Test Gallery', { targets: [ids(s0, 'graveyard', 'p1', 'Test Red Cub', 'Test White Cub')] });
    expect(names(s, 'hand', 'p1')).toEqual(expect.arrayContaining(['Test Red Cub', 'Test White Cub']));
    expect(names(s, 'graveyard', 'p1')).toContain('Test Red Card'); // an instant is not offered, and Gallery went to the graveyard (it is no exile spell)
    expect(() => cast(s0, 'Test Gallery', { targets: [ids(s0, 'graveyard', 'p1', 'Test Red Card')] })).toThrow();
  });
});

describe('CR 701.20a, 701.20e, 608.2d, 404.1: "Target opponent reveals their hand. You choose a nonland card from it or a card from their graveyard. Exile that card. You lose 1 life." (Agonizing Remorse)', () => {
  const REMORSE = card('Test Remorse', 'Sorcery', 'Target opponent reveals their hand. You choose a nonland card from it or a card from their graveyard. Exile that card. You lose 1 life.');
  const PLAINS = card('Test Meadow', 'Basic Land — Plains', '{T}: Add {W}.');
  const start = (hand: string[], yard: string[]): GameState => scenario([], { defs: [REMORSE, ROCK, BEAR, PLAINS], p1: { hand: ['Test Remorse'] }, p2: { hand, graveyard: yard } });
  it('is understood', () => expect(noManual(REMORSE)).toBe(true));
  it('one choice among the nonland cards of the revealed hand and every card of the graveyard (a land card too); the card chosen is exiled and the caster loses 1 life', () => {
    let offered: string[] = [];
    const s = cast(start(['Test Rock', 'Test Meadow'], ['Test Bear', 'Test Meadow']), 'Test Remorse', { targets: [['p2']], pick: (st, options) => { offered = options.map((id) => `${nameOf(st, id)}:${st.objects[id]!.zone ?? ''}`).sort(); return byName('Test Meadow')(st, options.filter((id) => st.zones.graveyard.p2!.includes(id))); } });
    expect(offered.map((x) => x.split(':')[0])).toEqual(['Test Bear', 'Test Meadow', 'Test Rock']); // the land card of the hand is not offered
    expect(exiled(s)).toEqual(['Test Meadow']);
    expect(names(s, 'hand', 'p2')).toEqual(['Test Rock', 'Test Meadow']);
    expect(life(s, 'p1')).toBe(19);
  });
  it('a nonland card of the hand can be the one exiled', () => {
    const s = cast(start(['Test Rock', 'Test Meadow'], ['Test Bear']), 'Test Remorse', { targets: [['p2']], pick: byName('Test Rock') });
    expect(exiled(s)).toEqual(['Test Rock']);
    expect(names(s, 'graveyard', 'p2')).toEqual(['Test Bear']);
  });
  it('negative: with only lands in the hand and nothing in the graveyard nothing is exiled and the caster still loses 1 life', () => {
    const s = cast(start(['Test Meadow'], []), 'Test Remorse', { targets: [['p2']] });
    expect(exiled(s)).toEqual([]);
    expect(life(s, 'p1')).toBe(19);
  });
  it('negative: with no nonland card in the hand, the card must come from the graveyard (ruling 2020-01-24)', () => {
    const s = cast(start(['Test Meadow'], ['Test Bear']), 'Test Remorse', { targets: [['p2']] });
    expect(exiled(s)).toEqual(['Test Bear']);
  });
});

describe('CR 701.23a, 701.23d, 303.4f, 110.2: "When ~ enters, you may search your graveyard, hand, and/or library for an Aura card and put it onto the battlefield attached to ~. If you search your library this way, shuffle." (Boonweaver Giant, Runed Crown)', () => {
  const GIANT = card('Test Boonweaver', 'Creature — Giant', 'When ~ enters, you may search your graveyard, hand, and/or library for an Aura card and put it onto the battlefield attached to ~. If you search your library this way, shuffle.', { pt: ['4', '4'], cost: '{0}' });
  const CROWN = card('Test Runed Band', 'Artifact — Equipment', 'When ~ enters, you may search your library, hand, and/or graveyard for a Rune card and put it onto the battlefield attached to ~. If you search your library this way, shuffle.');
  const BOON = card('Test Aura', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature gets +1/+1.');
  const LANDAURA = card('Test Land Aura', 'Enchantment — Aura', 'Enchant land\nEnchanted land has "{T}: Add {G}."');
  const RUNE = card('Test Rune', 'Enchantment — Aura Rune', 'Enchant artifact\nEnchanted artifact gets +1/+1.');
  const D = [GIANT, CROWN, BOON, LANDAURA, RUNE, BEAR, SWAMP];
  const attached = (s: GameState, name: string): ObjectId | undefined => s.zones.battlefield.find((id) => nameOf(s, id) === name && s.objects[id]!.attachedTo !== undefined);
  it('are understood', () => { expect(noManual(GIANT)).toBe(true); expect(noManual(CROWN)).toBe(true); });
  it('an Aura from the graveyard, the hand or the library comes onto the battlefield attached to the Giant', () => {
    for (const zone of ['graveyard', 'hand', 'library'] as const) {
      const s0 = scenario([], { defs: D, p1: zone === 'hand' ? { hand: ['Test Boonweaver', 'Test Aura'] } : { hand: ['Test Boonweaver'], [zone]: ['Test Aura'] } });
      const s = cast(s0, 'Test Boonweaver', { pick: byName('Test Aura') });
      const aura = attached(s, 'Test Aura');
      expect(aura, zone).toBeDefined();
      expect(s.objects[aura!]!.attachedTo).toBe(s.zones.battlefield.find((id) => nameOf(s, id) === 'Test Boonweaver'));
    }
  });
  it('the Rune card is found with the zones listed library first', () => {
    const s0 = scenario([], { defs: D, p1: { hand: ['Test Runed Band'], library: ['Test Rune'] } });
    const s = cast(s0, 'Test Runed Band', { pick: byName('Test Rune') });
    expect(attached(s, 'Test Rune')).toBeDefined();
  });
  it('negative: "may": declining searches nothing', () => {
    const s0 = scenario([], { defs: D, p1: { hand: ['Test Boonweaver'], library: ['Test Aura'] } });
    const s = cast(s0, 'Test Boonweaver', { yes: false });
    expect(attached(s, 'Test Aura')).toBeUndefined();
    expect(names(s, 'library', 'p1')).toContain('Test Aura');
  });
  it('negative: an Aura that can not enchant the Giant (enchant land) stays where it was (ruling 2014-07-18)', () => {
    const s0 = scenario([], { defs: D, p1: { hand: ['Test Boonweaver'], library: ['Test Land Aura'] } });
    const s = cast(s0, 'Test Boonweaver', { pick: byName('Test Land Aura') });
    expect(s.zones.battlefield.map((id) => nameOf(s, id))).toEqual(['Test Boonweaver']);
    expect(names(s, 'library', 'p1')).toContain('Test Land Aura');
  });
  it('negative: a card that is not an Aura is not offered', () => {
    const s0 = scenario([], { defs: D, p1: { hand: ['Test Boonweaver', 'Test Bear'], library: ['Test Swamp'] } });
    let offered = 0;
    cast(s0, 'Test Boonweaver', { pick: (_st, options) => { offered = options.length; return []; } });
    expect(offered).toBe(0);
  });
});
