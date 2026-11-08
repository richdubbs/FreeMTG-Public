/**
 * Round edh-e-51 (Commander coordinator E, group mana, second batch): the behaviour it added, played through the engine with synthetic cards (invented names, design 6.10),
 * compiled by the game's default compiler.
 *
 *   CR 601.2h, 106.6, 609.4  "Spend only mana produced by creatures to cast this spell." (Myr Superion; "basic lands", Imperiosaur): the mana that pays for the spell must be made by a
 *                            source the rule describes (mana from other sources, floating or from a mana ability, is not spent on it); other costs of the spell are not limited
 */
import { describe, expect, it } from 'vitest';
import type { GameState, ObjectId } from '../../../src/index';
import { act, answer, find, legal, scenario } from '../../m3/scenario';
import { card, full, resolveAll } from '../cmd3/helpers';

const nameOf = (s: GameState, id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
const castable = (s: GameState, name: string): boolean => legal(s, 'p1', 'cast').some((a) => a.object !== undefined && nameOf(s, a.object) === name);

// ---- Spend only mana produced by creatures / basic lands --------------------------------------------------------------------------------------------------------
const CREATURE_ONLY = card('Test Creature Only', 'Artifact Creature — Golem', 'Spend only mana produced by creatures to cast this spell.\nWhen this creature enters, you gain 3 life.', ['2', '2'], '{2}');
const BASIC_ONLY = card('Test Basic Only', 'Creature — Beast', 'Spend only mana produced by basic lands to cast this spell.\nWhen this creature enters, you gain 3 life.', ['2', '2'], '{1}{G}');
const DORK = card('Test Dork', 'Creature — Elf', '{T}: Add {G}.', ['1', '1']);
const ROCK = card('Test Rock', 'Artifact', '{T}: Add {G}.');
const WILD = card('Test Wild Land', 'Land', '{T}: Add {G}.');
const PLAIN = card('Test Plain', 'Creature — Beast', 'When this creature enters, you gain 1 life.', ['1', '1'], '{2}');
const SPAWN = card('Test Spawn', 'Creature — Eldrazi Spawn', 'Sacrifice this creature: Add {B}.', ['0', '1']);
const DEFS = [CREATURE_ONLY, BASIC_ONLY, DORK, ROCK, WILD, SPAWN];

describe('CR 601.2h, 106.6: "Spend only mana produced by <sources> to cast this spell." (Myr Superion, Imperiosaur)', () => {
  it('the cards are fully automated', () => {
    for (const d of [CREATURE_ONLY, BASIC_ONLY]) expect(full(d), `${d.name} ${JSON.stringify(d.automation)}`).toBe(true);
  });
  const board = (hand: string[], battlefield: string[], extra: string[] = []): GameState => scenario(['Forest', ...extra], { defs: DEFS, p1: { hand, battlefield } });

  it('two creatures that tap for mana pay {2}', () => {
    const s = board(['Test Creature Only'], ['Test Dork', 'Test Dork']);
    expect(castable(s, 'Test Creature Only')).toBe(true);
  });
  it('negative: one creature and one artifact make two mana, but only the creature\'s may be spent: not castable', () => {
    const s = board(['Test Creature Only'], ['Test Dork', 'Test Rock']);
    expect(castable(s, 'Test Creature Only')).toBe(false);
  });
  it('negative: lands alone never pay for it', () => {
    const s = board(['Test Creature Only'], ['Forest', 'Forest']);
    expect(castable(s, 'Test Creature Only')).toBe(false);
  });
  it('negative: mana floating in the pool from a land is not spent on it either, but mana a creature made is', () => {
    const s0 = board(['Test Creature Only'], ['Test Dork', 'Test Dork', 'Forest']);
    const s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Creature Only', 'hand') });
    const t = resolveAll(s);
    // the Forest was not tapped to pay: the two creatures were
    const forest = t.zones.battlefield.map((id) => t.objects[id]!).find((o) => t.defs[o.defId]!.name === 'Forest')!;
    expect(forest.tapped).toBe(false);
    expect(t.zones.battlefield.map((id) => t.objects[id]!).filter((o) => t.defs[o.defId]!.name === 'Test Dork').every((o) => o.tapped)).toBe(true);
    expect(t.zones.battlefield.some((id) => nameOf(t, id) === 'Test Creature Only')).toBe(true);
  });
  it('mana of a creature sacrificed to make it still counts as produced by a creature (last known information): a Spawn and a Dork pay {2}', () => {
    const s0 = board(['Test Creature Only'], ['Test Spawn', 'Test Dork']);
    expect(castable(s0, 'Test Creature Only')).toBe(true);
    const t = resolveAll(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Creature Only', 'hand') }));
    expect(t.zones.battlefield.some((id) => nameOf(t, id) === 'Test Creature Only')).toBe(true);
  });
  it('two basic lands pay for the basic-only spell; one basic land and a nonbasic land do not (only the basic land\'s mana counts), nor do two nonbasic lands', () => {
    expect(castable(scenario(['Forest'], { defs: DEFS, p1: { hand: ['Test Basic Only'], battlefield: ['Forest', 'Forest'] } }), 'Test Basic Only')).toBe(true);
    expect(castable(scenario(['Forest'], { defs: DEFS, p1: { hand: ['Test Basic Only'], battlefield: ['Forest', 'Test Wild Land'] } }), 'Test Basic Only')).toBe(false);
    expect(castable(scenario(['Forest'], { defs: DEFS, p1: { hand: ['Test Basic Only'], battlefield: ['Test Wild Land', 'Test Wild Land'] } }), 'Test Basic Only')).toBe(false);
  });
  it('another spell is not limited: with the same creatures and artifact a plain spell of the same cost is castable', () => {
    expect(castable(scenario([], { defs: [...DEFS, PLAIN], p1: { hand: ['Test Plain'], battlefield: ['Test Dork', 'Test Rock'] } }), 'Test Plain')).toBe(true);
  });
});

// ---- Sunglasses of Urza ---------------------------------------------------------------------------------------------------------------------------------------
const SPECS = card('Test Specs', 'Artifact', 'You may spend white mana as though it were red mana.');
const RED_SPELL = card('Test Red Spell', 'Sorcery', 'You gain 2 life.', undefined, '{R}');
const BLUE_SPELL = card('Test Blue Spell', 'Sorcery', 'You gain 2 life.', undefined, '{U}');
const HYBRID_SPELL = card('Test Hybrid Spell', 'Sorcery', 'You gain 2 life.', undefined, '{R/G}');
const COLORLESS_SPELL = card('Test Colorless Spell', 'Sorcery', 'You gain 2 life.', undefined, '{C}');
const RED_WELL = card('Test Red Well', 'Artifact', '{R}, {T}: You gain 1 life.');
const GRABBER = card('Test Grabber', 'Artifact', 'You may spend red mana as though it were green mana.');
const SPECS_DEFS = [SPECS, RED_SPELL, BLUE_SPELL, HYBRID_SPELL, COLORLESS_SPELL, RED_WELL, GRABBER];

describe('CR 609.4b: "You may spend white mana as though it were red mana." (Sunglasses of Urza)', () => {
  it('the cards are fully automated', () => {
    for (const d of [SPECS, GRABBER]) expect(full(d), `${d.name} ${JSON.stringify(d.automation)}`).toBe(true);
  });
  const withPlains = (hand: string[], battlefield: string[]): GameState => scenario(['Plains', 'Island', 'Mountain'], { defs: SPECS_DEFS, p1: { hand, battlefield } });
  it('with the Sunglasses a Plains pays for a red spell, and for a hybrid red symbol', () => {
    const s = withPlains(['Test Red Spell', 'Test Hybrid Spell'], ['Test Specs', 'Plains']);
    expect(castable(s, 'Test Red Spell')).toBe(true);
    expect(castable(s, 'Test Hybrid Spell')).toBe(true);
  });
  it('negative: without them a Plains does not pay {R}', () => {
    const s = withPlains(['Test Red Spell'], ['Plains']);
    expect(castable(s, 'Test Red Spell')).toBe(false);
  });
  it('negative: white mana still does not pay for blue or colorless costs', () => {
    const s = withPlains(['Test Blue Spell', 'Test Colorless Spell'], ['Test Specs', 'Plains']);
    expect(castable(s, 'Test Blue Spell')).toBe(false);
    expect(castable(s, 'Test Colorless Spell')).toBe(false);
  });
  it('negative: it is one way only: red mana does not pay for a white cost (nothing to cast) and an opponent\'s Sunglasses do not help the player', () => {
    const s = scenario(['Plains'], { defs: SPECS_DEFS, p1: { hand: ['Test Red Spell'], battlefield: ['Plains'] }, p2: { battlefield: ['Test Specs'] } });
    expect(castable(s, 'Test Red Spell')).toBe(false);
  });
  it('it pays an activation cost too: the well\'s {R} is paid with a Plains', () => {
    const s = withPlains([], ['Test Specs', 'Plains', 'Test Red Well']);
    expect(legal(s, 'p1', 'activate').some((a) => a.object !== undefined && nameOf(s, a.object) === 'Test Red Well' && a.isMana !== true)).toBe(true);
    const without = withPlains([], ['Plains', 'Test Red Well']);
    expect(legal(without, 'p1', 'activate').some((a) => a.object !== undefined && nameOf(without, a.object) === 'Test Red Well' && a.isMana !== true)).toBe(false);
  });
  it('the cast really spends the Plains: the spell resolves and the Plains is tapped', () => {
    const s0 = withPlains(['Test Red Spell'], ['Test Specs', 'Plains']);
    const t = resolveAll(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Red Spell', 'hand') }));
    expect(t.players.find((p) => p.id === 'p1')!.life).toBe(22);
    expect(t.zones.battlefield.map((id) => t.objects[id]!).find((o) => nameOf(t, o.id) === 'Plains')!.tapped).toBe(true);
  });
  it('two such rules chain only one step: with white-as-red and red-as-green a Plains does not pay {G}', () => {
    const s = scenario(['Plains'], { defs: [...SPECS_DEFS, card('Test Green Spell', 'Sorcery', 'You gain 2 life.', undefined, '{G}')], p1: { hand: ['Test Green Spell'], battlefield: ['Test Specs', 'Test Grabber', 'Plains'] } });
    expect(castable(s, 'Test Green Spell')).toBe(false);
  });
});

// ---- Add {B}{B} or {G}{G} (Cadaverous Bloom) ---------------------------------------------------------------------------------------------------------------------
const BLOOM = card('Test Bloom', 'Enchantment', 'Exile a card from your hand: Add {B}{B} or {G}{G}.');
const FODDER = card('Test Fodder', 'Sorcery', 'You gain 1 life.');
const BB_SPELL = card('Test Bb Spell', 'Sorcery', 'You gain 2 life.', undefined, '{B}{B}');
const BG_SPELL = card('Test Bg Spell', 'Sorcery', 'You gain 2 life.', undefined, '{B}{G}');
const GG_SPELL = card('Test Gg Spell', 'Sorcery', 'You gain 2 life.', undefined, '{G}{G}');
const BLOOM_DEFS = [BLOOM, FODDER, BB_SPELL, BG_SPELL, GG_SPELL];

describe('CR 106.1b, 106.4, 605.1a: "Exile a card from your hand: Add {B}{B} or {G}{G}." (Cadaverous Bloom)', () => {
  it('the card is fully automated', () => {
    expect(full(BLOOM), JSON.stringify(BLOOM.automation)).toBe(true);
  });
  const manaOf = (s: GameState): string => (s.players.find((p) => p.id === 'p1')!.manaPool as { type: string }[]).map((m) => m.type).sort().join('');
  const activateBloom = (hand: string[], choose: 'B' | 'G'): GameState => {
    const s0 = scenario([], { defs: BLOOM_DEFS, p1: { hand, battlefield: ['Test Bloom'] } });
    const a = legal(s0, 'p1', 'activate').find((x) => x.object !== undefined && nameOf(s0, x.object) === 'Test Bloom');
    expect(a).toBeDefined();
    let s = act(s0, a!.action);
    for (let g = 0; g < 6 && s.pending && s.pending.kind !== 'priority'; g++) {
      const d = s.pending as { kind: string; options?: { id: string }[] };
      if (d.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: [find(s, 'Test Fodder', 'hand')] });
      else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
      else if (d.kind === 'chooseColor') s = answer(s, { kind: 'chooseColor', color: choose as never });
      else break;
    }
    return s;
  };
  it('exiling a card adds two black mana, or two green mana, never one of each', () => {
    const b = activateBloom(['Test Fodder'], 'B');
    expect(manaOf(b)).toBe('BB');
    expect(b.zones.hand.p1?.length ?? 0).toBe(0);
    expect(activateBloom(['Test Fodder'], 'G').pending?.kind).not.toBe('chooseColor');
    expect(manaOf(activateBloom(['Test Fodder'], 'G'))).toBe('GG');
  });
  it('negative: with no card in hand to exile it can\'t be activated', () => {
    const s = scenario([], { defs: BLOOM_DEFS, p1: { battlefield: ['Test Bloom'] } });
    expect(legal(s, 'p1', 'activate').some((x) => x.object !== undefined && nameOf(s, x.object) === 'Test Bloom')).toBe(false);
  });
});

// ---- for each mana from a Treasure that was spent to cast this spell (Spoils of the Hunt) ---------------------------------------------------------------------------
const SPOILS = card('Test Spoils', 'Instant', 'Target creature you control gets +1/+0 until end of turn for each mana from a Treasure that was spent to cast this spell. Then that creature deals damage equal to its power to target creature an opponent controls.', undefined, '{1}{R}');
const TREASURE = card('Test Treasure', 'Artifact — Treasure', '{T}, Sacrifice this artifact: Add one mana of any color.');
const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
const OGRE = card('Test Ogre', 'Creature — Ogre', '', ['3', '3']);
const SPOILS_DEFS = [SPOILS, TREASURE, BEAR, OGRE];

describe('CR 106.3, 601.2h: "+1/+0 for each mana from a Treasure that was spent to cast this spell" (Spoils of the Hunt)', () => {
  it('the card is fully automated', () => {
    expect(full(SPOILS), JSON.stringify(SPOILS.automation)).toBe(true);
  });
  const play = (battlefield: string[]): GameState => {
    const s0 = scenario(['Mountain'], { defs: SPOILS_DEFS, p1: { hand: ['Test Spoils'], battlefield: ['Test Bear', ...battlefield] }, p2: { battlefield: ['Test Ogre'] } });
    const mine = find(s0, 'Test Bear', 'battlefield');
    const theirs = find(s0, 'Test Ogre', 'battlefield', 'p2');
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Spoils', 'hand') });
    const picks = [mine, theirs];
    for (let g = 0; g < 4 && s.pending?.kind === 'chooseTargets'; g++) s = answer(s, { kind: 'chooseTargets', targets: [{ kind: 'object', id: picks.shift()! }] });
    return resolveAll(s);
  };
  const alive = (s: GameState, name: string): boolean => s.zones.battlefield.some((id) => nameOf(s, id) === name);
  it('one Treasure and one Mountain pay: the creature gets +1/+0 (3 power) and its 3 damage destroys the 3/3', () => {
    const t = play(['Test Treasure', 'Mountain']);
    expect(alive(t, 'Test Ogre')).toBe(false);
    expect(alive(t, 'Test Treasure')).toBe(false); // sacrificed to pay
  });
  it('negative: two Mountains pay (no Treasure mana): no bonus, the 2 damage leaves the 3/3 alive', () => {
    const t = play(['Mountain', 'Mountain']);
    expect(alive(t, 'Test Ogre')).toBe(true);
  });
});
