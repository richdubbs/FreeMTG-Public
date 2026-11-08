/**
 * Commander coordinator E, round edh-e-9 (group library 1/3): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the
 * game's default compiler. Alice (p1) is the active player of turn 1. Each test is named after the rule it checks, with its negative case. CR cites from the Comprehensive Rules
 * of 2026-09-25 (the files were fetched from media.wizards.com when the round was built; cites not re-read are listed in the round's record).
 *
 *   CR 701.20a, 701.20e, 401.4   "You may reveal a creature or land card from among them and put it on top of your library. Put the rest on the bottom ..."
 *   CR 701.20a, 712.1            "You may reveal a land or double-faced card from among them and put that card into your hand."
 *   CR 701.9a, 105.2, 400.1      "Target opponent reveals their hand and discards all colorless nonland cards." / "... all multicolored cards."
 *   CR 701.20a, 402.3, 107.3     "Target player reveals X cards from their hand and you choose one of them. That player discards that card."
 *   CR 701.20a, 701.24a, 110.2a  "That player reveals cards from the top of their library until a creature card is revealed. The player puts that card onto the battlefield, then shuffles the rest ..."
 *   CR 701.23a, 701.23b, 401.4   "Search your library for X cards, then shuffle and put those cards on top in any order."
 *   CR 201.2, 701.20e            "You may put one of those cards onto the battlefield if it has the same name as a permanent."
 *   CR 201.2, 701.20a            "Reveal a card in your hand, then put that card onto the battlefield if it has the same name as a permanent."
 */
import { describe, expect, it } from 'vitest';
import { compileCard, getChars, type CardDef, type GameState, type ObjectId, type PlayerId } from '../../../src/index';
import { answer, card, cast, drive, full, passBoth, resolveAll, scenario } from '../r3-cost/support';

const nameOf = (s: GameState, id: string): string => getChars(s, id).name;
const names = (s: GameState, zone: 'hand' | 'graveyard' | 'library', p: PlayerId): string[] => s.zones[zone][p]!.map((id) => nameOf(s, id));
/** The library's own test cards in order (the scenario fills the rest of each library with basic lands). */
const lib = (s: GameState, p: PlayerId): string[] => names(s, 'library', p).filter((n) => n.startsWith('Test '));
const bf = (s: GameState, p: PlayerId): string[] => s.zones.battlefield.filter((id) => s.objects[id]!.controller === p).map((id) => nameOf(s, id));
const idIn = (s: GameState, zone: 'hand' | 'graveyard' | 'library', p: PlayerId, name: string): ObjectId => s.zones[zone][p]!.find((id) => nameOf(s, id) === name)!;
/** The options of the pending choice of objects, by name. */
const offered = (s: GameState): string[] => {
  const p = s.pending as unknown as { kind: string; options: ObjectId[] };
  expect(p.kind).toBe('chooseObjects');
  return p.options.map((id) => nameOf(s, id)).sort();
};
/** The pending choice of objects is answered with these cards of p1's library. */
const pick = (s: GameState, ...cards: string[]): GameState => answer(s, { kind: 'chooseObjects', ids: cards.map((n) => idIn(s, 'library', 'p1', n)) });

const FOREST = card('Test Forest', 'Land', '');
const BEAR = card('Test Bear', 'Creature — Bear', '', '{0}', ['2', '2']);
const OGRE = card('Test Ogre', 'Creature — Ogre', '', '{0}', ['3', '3']);
const RELIC = card('Test Relic', 'Artifact', '');
const BOLT = card('Test Bolt', 'Instant', '', '{1}');
const DFC: CardDef = compileCard({
  name: 'Test Wolf // Test Moon', layout: 'transform', type_line: 'Creature — Human // Creature — Werewolf', colors: [],
  card_faces: [
    { name: 'Test Wolf', mana_cost: '{1}', type_line: 'Creature — Human', oracle_text: '', power: '1', toughness: '1', colors: [] },
    { name: 'Test Moon', mana_cost: '', type_line: 'Creature — Werewolf', oracle_text: '', power: '2', toughness: '2', colors: [] },
  ],
} as never);

// ---- "You may reveal ... from among them and put it on top of your library" ------------------------------------------------------------------------------------
describe('"You may reveal a creature or land card from among them and put it on top of your library. Put the rest on the bottom of your library in a random order." (CR 701.20a, 701.20e, 401.4)', () => {
  const SPELL = card('Test Peeking', 'Sorcery', 'Look at the top four cards of your library. You may reveal a creature or land card from among them and put it on top of your library. Put the rest on the bottom of your library in a random order.', '{0}');
  const defs = [SPELL, FOREST, BEAR, RELIC, BOLT];
  const start = () => scenario([], { p1: { hand: ['Test Peeking'], library: ['Test Relic', 'Test Bolt', 'Test Bear', 'Test Forest', 'Test Relic'] }, p2: {}, defs });
  it('has no manual part', () => expect(full(SPELL)).toBe(true));
  it('only creature and land cards are offered; the chosen one goes on top, the other cards looked at go to the bottom, the fifth card follows the chosen one', () => {
    let s = passBoth(cast(start(), 'Test Peeking'));
    expect(offered(s)).toEqual(['Test Bear', 'Test Forest']);
    s = drive(pick(s, 'Test Forest'));
    const l = lib(s, 'p1');
    expect(l.slice(0, 2)).toEqual(['Test Forest', 'Test Relic']);
    expect(l.slice(2).sort()).toEqual(['Test Bear', 'Test Bolt', 'Test Relic']);
  });
  it('the negative case: choosing no card puts every card looked at on the bottom', () => {
    let s = passBoth(cast(start(), 'Test Peeking'));
    s = drive(pick(s));
    const l = lib(s, 'p1');
    expect(l[0]).toBe('Test Relic'); // the fifth card
    expect(l.slice(1).sort()).toEqual(['Test Bear', 'Test Bolt', 'Test Forest', 'Test Relic']);
  });
});

// ---- "a land or double-faced card" ------------------------------------------------------------------------------------------------------------------------------
describe('"You may reveal a land or double-faced card from among them and put that card into your hand." (CR 701.20a, 712.1)', () => {
  const SPELL = card('Test Sifting', 'Sorcery', 'Look at the top four cards of your library. You may reveal a land or double-faced card from among them and put that card into your hand. Put the rest on the bottom of your library in a random order.', '{0}');
  const defs = [SPELL, FOREST, BEAR, RELIC, DFC];
  const start = () => scenario([], { p1: { hand: ['Test Sifting'], library: ['Test Bear', 'Test Forest', 'Test Wolf // Test Moon', 'Test Relic', 'Test Relic'] }, p2: {}, defs });
  it('has no manual part', () => expect(full(SPELL)).toBe(true));
  it('a land and a double-faced card are offered, an ordinary creature and an artifact are not; the chosen card goes to the hand', () => {
    let s = passBoth(cast(start(), 'Test Sifting'));
    expect(offered(s)).toEqual(['Test Forest', 'Test Wolf']);
    s = drive(pick(s, 'Test Wolf'));
    expect(names(s, 'hand', 'p1')).toContain('Test Wolf');
    expect(lib(s, 'p1').sort()).toEqual(['Test Bear', 'Test Forest', 'Test Relic', 'Test Relic']);
  });
  it('the negative case: choosing nothing leaves the hand as it was and puts the four cards on the bottom', () => {
    let s = passBoth(cast(start(), 'Test Sifting'));
    s = drive(pick(s));
    expect(names(s, 'hand', 'p1')).not.toContain('Test Forest');
    expect(lib(s, 'p1')[0]).toBe('Test Relic');
  });
});

// ---- "Target opponent reveals their hand and discards all colorless nonland cards." ------------------------------------------------------------------------------
describe('"Target opponent reveals their hand and discards all colorless nonland cards." / "... all multicolored cards." (CR 701.9a, 105.2, 400.1)', () => {
  const MODAL = card('Test Shattering', 'Sorcery', 'Choose one --\n• Target opponent reveals their hand and discards all colorless nonland cards.\n• Target opponent reveals their hand and discards all multicolored cards.', '{0}');
  const RED = card('Test Red Bolt', 'Instant', '', '{1}{R}', undefined, ['R']);
  const GOLD = card('Test Gold Bolt', 'Instant', '', '{R}{G}', undefined, ['R', 'G']);
  const defs = [MODAL, FOREST, RELIC, RED, GOLD, BEAR];
  const start = (mode: string): GameState => {
    let s = scenario([], { p1: { hand: ['Test Shattering'] }, p2: { hand: ['Test Relic', 'Test Red Bolt', 'Test Gold Bolt', 'Test Forest', 'Test Bear'] }, defs });
    s = cast(s, 'Test Shattering', { options: [[mode]], targets: [[{ kind: 'player', id: 'p2' }]] });
    return resolveAll(s);
  };
  it('has no manual part', () => expect(full(MODAL)).toBe(true));
  it('the first mode discards the colorless nonland cards (artifact, colorless creature) and nothing else', () => {
    const s = start('0');
    expect(names(s, 'hand', 'p2').sort()).toEqual(['Test Forest', 'Test Gold Bolt', 'Test Red Bolt']);
  });
  it('the second mode discards only the multicolored card; a land and a colorless card stay', () => {
    const s = start('1');
    expect(names(s, 'hand', 'p2').sort()).toEqual(['Test Bear', 'Test Forest', 'Test Red Bolt', 'Test Relic']);
  });
});

// ---- "Target player reveals X cards from their hand and you choose one of them." ----------------------------------------------------------------------------------
describe('"Target player reveals X cards from their hand and you choose one of them. That player discards that card." (CR 701.20a, 402.3, 107.3)', () => {
  const SPELL = card('Test Probing', 'Sorcery', 'Target player reveals X cards from their hand and you choose one of them. That player discards that card.', '{X}');
  const A = card('Test Keep A', 'Sorcery', '', '{9}');
  const B = card('Test Keep B', 'Sorcery', '', '{9}');
  const C = card('Test Keep C', 'Sorcery', '', '{9}');
  const D = card('Test Keep D', 'Sorcery', '', '{9}');
  const LAND = card('Test Forest', 'Land', '{T}: Add {G}.');
  const defs = [SPELL, A, B, C, D, LAND];
  const start = (x: number): GameState => {
    const s = scenario([], { p1: { hand: ['Test Probing'], battlefield: ['Test Forest', 'Test Forest', 'Test Forest'] }, p2: { hand: ['Test Keep A', 'Test Keep B', 'Test Keep C', 'Test Keep D'] }, defs: [...defs] });
    return cast(s, 'Test Probing', { x: [x], targets: [[{ kind: 'player', id: 'p2' }]] });
  };
  it('has no manual part', () => expect(full(SPELL)).toBe(true));
  it('X is two: the target player chooses two cards to reveal, you choose one of those two and only it is discarded', () => {
    let s = passBoth(start(2));
    expect(s.pending?.kind).toBe('chooseObjects');
    expect(s.pending?.player).toBe('p2');
    const ids = (s.zones.hand['p2'] ?? []).slice(0, 2);
    s = answer(s, { kind: 'chooseObjects', ids });
    expect(s.pending?.player).toBe('p1');
    expect((s.pending as { options: ObjectId[] }).options.slice().sort()).toEqual(ids.slice().sort());
    const chosen = nameOf(s, ids[0]!);
    s = drive(answer(s, { kind: 'chooseObjects', ids: [ids[0]!] }));
    expect(names(s, 'hand', 'p2')).toHaveLength(3);
    expect(names(s, 'graveyard', 'p2')).toEqual([chosen]);
  });
  it('the negative case: X is one, a single card is revealed and it is the one discarded; the other three stay', () => {
    let s = passBoth(start(1));
    const ids = (s.zones.hand['p2'] ?? []).slice(0, 1);
    s = drive(answer(s, { kind: 'chooseObjects', ids }));
    expect(names(s, 'hand', 'p2')).toHaveLength(3);
    expect(names(s, 'graveyard', 'p2')).toHaveLength(1);
  });
});

// ---- "reveals cards ... until a creature card is revealed" ------------------------------------------------------------------------------------------------------
describe('"Exile target creature an opponent controls. That player reveals cards from the top of their library until a creature card is revealed. The player puts that card onto the battlefield, then shuffles the rest into their library." (CR 701.20a, 701.24a, 110.2a)', () => {
  const SPELL = card('Test Swapping', 'Sorcery', 'Exile target creature an opponent controls. That player reveals cards from the top of their library until a creature card is revealed. The player puts that card onto the battlefield, then shuffles the rest into their library.', '{0}');
  const defs = [SPELL, BEAR, OGRE, RELIC, BOLT];
  const start = (): GameState => {
    const s = scenario([], { p1: { hand: ['Test Swapping'] }, p2: { battlefield: ['Test Bear'], library: ['Test Relic', 'Test Bolt', 'Test Ogre', 'Test Relic'] }, defs });
    return s;
  };
  it('has no manual part', () => expect(full(SPELL)).toBe(true));
  it('the exiled creature\'s controller gets the first creature card of their library onto the battlefield under their control, the cards before it are shuffled back', () => {
    const s0 = start();
    const bear = s0.zones.battlefield.find((id) => nameOf(s0, id) === 'Test Bear')!;
    let s = resolveAll(cast(s0, 'Test Swapping', { targets: [[{ kind: 'object', id: bear }]] }));
    expect(bf(s, 'p2')).toEqual(['Test Ogre']);
    expect(s.zones.exile.map((id) => nameOf(s, id))).toEqual(['Test Bear']);
    expect(lib(s, 'p2').sort()).toEqual(['Test Bolt', 'Test Relic', 'Test Relic']);
  });
  it('the negative case: the player without a creature card in their library reveals all of it and nothing enters', () => {
    const s0 = scenario([], { p1: { hand: ['Test Swapping'] }, p2: { battlefield: ['Test Bear'], library: ['Test Relic', 'Test Bolt'] }, defs });
    const bear = s0.zones.battlefield.find((id) => nameOf(s0, id) === 'Test Bear')!;
    const s = resolveAll(cast(s0, 'Test Swapping', { targets: [[{ kind: 'object', id: bear }]] }));
    expect(bf(s, 'p2')).toEqual([]);
  });
});

// ---- "Search your library for X cards, then shuffle and put those cards on top in any order." ---------------------------------------------------------------------------
describe('"Search your library for two cards, then shuffle and put those cards on top in any order." (CR 701.23a, 701.23b, 401.4)', () => {
  const SPELL = card('Test Stacking', 'Sorcery', 'Search your library for two cards, then shuffle and put those cards on top in any order.', '{0}');
  const defs = [SPELL, BEAR, OGRE, RELIC, BOLT];
  const start = () => scenario([], { p1: { hand: ['Test Stacking'], library: ['Test Relic', 'Test Bolt', 'Test Bear', 'Test Ogre'] }, p2: {}, defs });
  it('has no manual part', () => expect(full(SPELL)).toBe(true));
  it('exactly two cards chosen from the library end up on top of it (the rest were shuffled)', () => {
    let s = passBoth(cast(start(), 'Test Stacking'));
    expect(s.pending?.kind).toBe('chooseObjects');
    s = drive(pick(s, 'Test Ogre', 'Test Bolt'));
    expect(lib(s, 'p1').slice(0, 2).sort()).toEqual(['Test Bolt', 'Test Ogre']);
    expect(names(s, 'library', 'p1').slice(0, 2).sort()).toEqual(['Test Bolt', 'Test Ogre']);
  });
  it('the negative case: a card not chosen is not on top', () => {
    let s = passBoth(cast(start(), 'Test Stacking'));
    s = drive(pick(s, 'Test Ogre', 'Test Bolt'));
    expect(names(s, 'library', 'p1').slice(0, 2)).not.toContain('Test Bear');
  });
});

// ---- the same name as a permanent --------------------------------------------------------------------------------------------------------------------------------
describe('"You may put one of those cards onto the battlefield if it has the same name as a permanent." (CR 201.2, 701.20e)', () => {
  const SPELL = card('Test Mirroring', 'Sorcery', 'Look at the top four cards of your library. You may put one of those cards onto the battlefield if it has the same name as a permanent. Put the rest on the bottom of your library in any order.', '{0}');
  const defs = [SPELL, BEAR, OGRE, RELIC];
  const start = () => scenario([], { p1: { hand: ['Test Mirroring'], battlefield: ['Test Bear'], library: ['Test Ogre', 'Test Bear', 'Test Relic', 'Test Ogre'] }, p2: { battlefield: ['Test Relic'] }, defs });
  it('has no manual part', () => expect(full(SPELL)).toBe(true));
  it('only cards sharing a name with a permanent (of any player) are offered: the Bear and the Relic, not the two Ogres (their namesake is in the library, not a permanent)', () => {
    let s = passBoth(cast(start(), 'Test Mirroring'));
    expect(offered(s)).toEqual(['Test Bear', 'Test Relic']); // (two Ogres in the library share a name only with each other: that is not a permanent)
    s = drive(pick(s, 'Test Relic'));
    expect(bf(s, 'p1')).toContain('Test Relic');
  });
  it('the negative case: choosing nothing puts every card looked at on the bottom, none enters', () => {
    let s = passBoth(cast(start(), 'Test Mirroring'));
    s = drive(pick(s));
    expect(bf(s, 'p1')).toEqual(['Test Bear']);
  });
});

describe('"Reveal a card in your hand, then put that card onto the battlefield if it has the same name as a permanent." (CR 201.2, 701.20a)', () => {
  const SPELL = card('Test Echoing', 'Sorcery', 'Reveal a card in your hand, then put that card onto the battlefield if it has the same name as a permanent. Draw a card.', '{0}');
  const defs = [SPELL, BEAR, OGRE];
  const start = (hand: string[]): GameState => scenario([], { p1: { hand: ['Test Echoing', ...hand], battlefield: ['Test Bear'], library: ['Test Relic', 'Test Relic'] }, p2: {}, defs: [...defs, RELIC] });
  it('has no manual part', () => expect(full(SPELL)).toBe(true));
  it('the revealed card enters when a permanent has its name', () => {
    let s = passBoth(cast(start(['Test Bear']), 'Test Echoing'));
    s = drive(s, { objects: [[idIn(s, 'hand' as never, 'p1', 'Test Bear')]] });
    expect(bf(s, 'p1').filter((n) => n === 'Test Bear')).toHaveLength(2);
  });
  it('the negative case: a card with no namesake stays in the hand', () => {
    let s = passBoth(cast(start(['Test Ogre']), 'Test Echoing'));
    s = drive(s, { objects: [[idIn(s, 'hand' as never, 'p1', 'Test Ogre')]] });
    expect(bf(s, 'p1')).toEqual(['Test Bear']);
    expect(names(s, 'hand', 'p1')).toContain('Test Ogre');
  });
});
