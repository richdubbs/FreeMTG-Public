/**
 * edh-e-43 (Commander coordinator E, EDHREC top 30,000, group tokens): the round's readings played through the engine with synthetic cards compiled by the game's default
 * compiler (invented names; the wordings are the real cards', because the readings read exactly them). Scryfall rulings were fetched in the cloud session; CR cites checked
 * against the 2026-09-25 Comprehensive Rules text unless the record lists them as unverified.
 *
 *   CR 700.4, 603.10a, 400.7, 111.1    "When this creature dies, for each nontoken creature you controlled that died this turn, create a 2/2 black Zombie creature token." (Tobias, Doomed Conqueror)
 *   CR 508.1b, 508.4, 119.1, 702.105a   "Whenever equipped creature attacks the player with the most life or tied for most life, create a 4/4 white Angel creature token with flying
 *                                      that's tapped and attacking that player." (Seraphic Greatsword)
 *   CR 702.107a, 602.2, 603.2          "Whenever you activate this creature's outlast ability, create a 1/1 white Warrior creature token." (Herald of Anafenza)
 *   CR 111.4, 208.3, 608.2h, 508.4      "create a colorless Construct artifact creature token named Twin that's attacking. Its power is equal to this creature's power and its toughness is
 *                                      equal to this creature's toughness. Sacrifice the token at end of combat." (Gemini Engine)
 *   CR 607.2a, 406.2, 603.6c           "When this enchantment leaves the battlefield, exile all tokens created with this enchantment." (Dual Nature)
 *   CR 701.27e, 603.2, 700.4           "When this creature transforms into [its back face] or dies, create a 1/1 green Phyrexian Saproling creature token." (Blightreaper Thallid)
 */
import { describe, expect, it } from 'vitest';
import { legalActions, type GameState, type ObjectId, type TargetChoice } from '../../../src/index';
import { act, find, findAll, scenario } from '../../m3/scenario';
import { getChars } from '../../../src/rules/characteristics';
import { declareAttackers, passUntil, toDeclareAttackers } from '../../m4/helpers';
import { card, cast, full, pt, resolveAll, tokens } from '../cmd3/helpers';

const obj = (id: ObjectId): TargetChoice => ({ kind: 'object', id });
/** Activate the ability of `source` whose label matches `like` and resolve everything. */
function activate(s: GameState, source: ObjectId, like: RegExp, p: Parameters<typeof resolveAll>[1] = {}): GameState {
  const a = legalActions(s, 'p1').find((x) => x.kind === 'activate' && x.object === source && like.test(x.label));
  if (!a) throw new Error(`no ability like ${like} on ${source}: ${JSON.stringify(legalActions(s, 'p1').map((x) => x.label))}`);
  return resolveAll(act(s, a.action), p);
}

// ---- Tobias, Doomed Conqueror -----------------------------------------------------------------------------------------------------------------------------------------
const CONQUEROR = card('Test Conqueror', 'Legendary Creature — Human Soldier', 'When this creature dies, for each nontoken creature you controlled that died this turn, create a 2/2 black Zombie creature token.', ['2', '2']);
const GRUNT = card('Test Grunt', 'Creature — Ogre', '', ['2', '2']);
const SWEEP = card('Test Sweep', 'Sorcery', 'Destroy all creatures.');
const SLAY = card('Test Slay', 'Instant', 'Destroy target creature.');
const MUSTER = card('Test Muster', 'Sorcery', 'Create a 1/1 white Soldier creature token.');

describe('CR 700.4, 603.10a: "for each nontoken creature you controlled that died this turn, create a 2/2 black Zombie creature token"', () => {
  const zombies = (s: GameState): ObjectId[] => tokens(s).filter((id) => getChars(s, id)!.subtypes.includes('Zombie'));
  it('is automated', () => expect(full(CONQUEROR)).toBe(true));
  it('a sweeper kills it with two other nontoken creatures of yours: three Zombies (itself counts); the opponent\'s creature that died too is not counted', () => {
    let s = scenario([], { defs: [CONQUEROR, GRUNT, SWEEP], p1: { hand: ['Test Sweep'], battlefield: ['Test Conqueror', 'Test Grunt', 'Test Grunt'] }, p2: { battlefield: ['Test Grunt'] } });
    s = resolveAll(cast(s, 'Test Sweep'));
    expect(zombies(s)).toHaveLength(3);
    expect(tokens(s, 'p2')).toHaveLength(0);
  });
  it('a creature of yours that died earlier this turn is counted too (the whole turn\'s deaths, not only the ones with it)', () => {
    let s = scenario([], { defs: [CONQUEROR, GRUNT, SLAY], p1: { hand: ['Test Slay', 'Test Slay'], battlefield: ['Test Conqueror', 'Test Grunt'] } });
    s = resolveAll(cast(s, 'Test Slay', { targets: [obj(find(s, 'Test Grunt', 'battlefield'))] }));
    expect(zombies(s)).toHaveLength(0);
    s = resolveAll(cast(s, 'Test Slay', { targets: [obj(find(s, 'Test Conqueror', 'battlefield'))] }));
    expect(zombies(s)).toHaveLength(2);
  });
  it('the negative case: a token of yours that died does not count (only itself: one Zombie)', () => {
    let s = scenario([], { defs: [CONQUEROR, SWEEP, MUSTER], p1: { hand: ['Test Muster', 'Test Sweep'], battlefield: ['Test Conqueror'] } });
    s = resolveAll(cast(s, 'Test Muster'));
    expect(tokens(s)).toHaveLength(1);
    s = resolveAll(cast(s, 'Test Sweep'));
    expect(zombies(s)).toHaveLength(1);
  });
  it('the negative case: a creature of the opponent that died alone is not counted (a Conqueror that dies by itself makes one)', () => {
    let s = scenario([], { defs: [CONQUEROR, GRUNT, SLAY], p1: { hand: ['Test Slay', 'Test Slay'], battlefield: ['Test Conqueror'] }, p2: { battlefield: ['Test Grunt'] } });
    s = resolveAll(cast(s, 'Test Slay', { targets: [obj(find(s, 'Test Grunt', 'battlefield', 'p2'))] }));
    s = resolveAll(cast(s, 'Test Slay', { targets: [obj(find(s, 'Test Conqueror', 'battlefield'))] }));
    expect(zombies(s)).toHaveLength(1);
  });
});

// ---- Seraphic Greatsword -----------------------------------------------------------------------------------------------------------------------------------------------
const SABRE = card('Test Sabre', 'Artifact — Equipment', "Equipped creature gets +2/+2.\nWhenever equipped creature attacks the player with the most life or tied for most life, create a 4/4 white Angel creature token with flying that's tapped and attacking that player.\nEquip {0}");
const KNIGHT = card('Test Knight', 'Creature — Human Knight', '', ['2', '2']);

describe("CR 508.4, 119.1: \"Whenever equipped creature attacks the player with the most life or tied for most life, create a 4/4 white Angel creature token with flying that's tapped and attacking that player.\"", () => {
  const setup = (p2Life: number): { s: GameState; knight: ObjectId } => {
    const s = scenario([], { defs: [SABRE, KNIGHT], p1: { battlefield: ['Test Sabre', 'Test Knight'] } });
    const knight = find(s, 'Test Knight', 'battlefield');
    s.objects[find(s, 'Test Sabre', 'battlefield')]!.attachedTo = knight;
    s.players.find((p) => p.id === 'p2')!.life = p2Life;
    return { s, knight };
  };
  const attack = (s0: GameState, knight: ObjectId): GameState => resolveAll(declareAttackers(toDeclareAttackers(s0), [[knight, 'p2']]));
  it('is automated', () => expect(full(SABRE)).toBe(true));
  it('tied for the most life (20 and 20): an Angel 4/4 with flying enters tapped and attacking the defending player', () => {
    const { s: s0, knight } = setup(20);
    const s = attack(s0, knight);
    const angels = tokens(s).filter((id) => getChars(s, id)!.subtypes.includes('Angel'));
    expect(angels).toHaveLength(1);
    expect(pt(s, angels[0]!)).toBe('4/4');
    expect(s.objects[angels[0]!]!.tapped).toBe(true);
    expect(s.combat?.attackers.find((a) => a.id === angels[0])?.defender).toBe('p2');
  });
  it('the defending player has the most life (25 against 20): an Angel as well', () => {
    const { s: s0, knight } = setup(25);
    expect(tokens(attack(s0, knight))).toHaveLength(1);
  });
  it('the negative case: the defending player has less life than another player (10 against 20): no Angel', () => {
    const { s: s0, knight } = setup(10);
    expect(tokens(attack(s0, knight))).toHaveLength(0);
  });
  it('the negative case: the attacking player has the most life (25 against 20): the defender has less than another player, no Angel', () => {
    const { s: s0, knight } = setup(20);
    s0.players.find((p) => p.id === 'p1')!.life = 25;
    expect(tokens(attack(s0, knight))).toHaveLength(0);
  });
  it('the negative case: an unequipped creature attacking does not make an Angel', () => {
    const { s: s0, knight } = setup(20);
    s0.objects[find(s0, 'Test Sabre', 'battlefield')]!.attachedTo = undefined;
    expect(tokens(attack(s0, knight))).toHaveLength(0);
  });
});

// ---- Herald of Anafenza ------------------------------------------------------------------------------------------------------------------------------------------------
const HERALD = card('Test Herald', 'Creature — Human Soldier', "Outlast {0}\nWhenever you activate this creature's outlast ability, create a 1/1 white Warrior creature token.", ['1', '1']);
const OTHER_OUTLAST = card('Test Veteran', 'Creature — Human Soldier', 'Outlast {0}', ['1', '1']);

describe("CR 702.107a, 602.2: \"Whenever you activate this creature's outlast ability, create a 1/1 white Warrior creature token.\"", () => {
  it('is automated', () => expect(full(HERALD)).toBe(true));
  it('activating its own outlast ability makes a Warrior (the +1/+1 counter and the token both arrive)', () => {
    let s = scenario([], { defs: [HERALD], p1: { battlefield: ['Test Herald'] } });
    const herald = find(s, 'Test Herald', 'battlefield');
    s = activate(s, herald, /\+1\/\+1 counter/i);
    expect(s.objects[herald]!.counters['+1/+1']).toBe(1);
    expect(tokens(s)).toHaveLength(1);
    expect(getChars(s, tokens(s)[0]!)!.subtypes).toContain('Warrior');
  });
  it('the negative case: another creature\'s outlast ability does not trigger it', () => {
    let s = scenario([], { defs: [HERALD, OTHER_OUTLAST], p1: { battlefield: ['Test Herald', 'Test Veteran'] } });
    s = activate(s, find(s, 'Test Veteran', 'battlefield'), /\+1\/\+1 counter/i);
    expect(tokens(s)).toHaveLength(0);
  });
});

// ---- Gemini Engine -----------------------------------------------------------------------------------------------------------------------------------------------------
const ENGINE = card('Test Twin Engine', 'Artifact Creature — Construct', "Whenever this creature attacks, create a colorless Construct artifact creature token named Twin that's attacking. Its power is equal to this creature's power and its toughness is equal to this creature's toughness. Sacrifice the token at end of combat.", ['3', '4']);
const PUMP = card('Test Pump', 'Instant', 'Target creature gets +2/+2 until end of turn.');

describe("CR 111.4, 208.3, 608.2h: \"create a ... token named Twin that's attacking. Its power is equal to this creature's power and its toughness is equal to this creature's toughness. Sacrifice the token at end of combat.\"", () => {
  it('is automated', () => expect(full(ENGINE)).toBe(true));
  it('the Twin copies the engine\'s current power and toughness (3/4), attacks, deals combat damage, and is sacrificed at end of combat', () => {
    let s = scenario([], { defs: [ENGINE], p1: { battlefield: ['Test Twin Engine'] } });
    const engine = find(s, 'Test Twin Engine', 'battlefield');
    s = resolveAll(declareAttackers(toDeclareAttackers(s), [[engine, 'p2']]));
    const twins = tokens(s);
    expect(twins).toHaveLength(1);
    expect(pt(s, twins[0]!)).toBe('3/4');
    expect(s.combat?.attackers.find((a) => a.id === twins[0])).toBeDefined();
    s = passUntil(s, (x) => x.turn.step === 'main2', 'the second main phase');
    expect(tokens(s)).toHaveLength(0);
    expect(s.players.find((p) => p.id === 'p2')!.life).toBe(20 - 6);
  });
  it('the Twin has the engine\'s power as it is when the token is created: a pumped engine (+2/+2) makes a 5/6', () => {
    let s = scenario([], { defs: [ENGINE, PUMP], p1: { hand: ['Test Pump'], battlefield: ['Test Twin Engine'] } });
    const engine = find(s, 'Test Twin Engine', 'battlefield');
    s = resolveAll(cast(s, 'Test Pump', { targets: [obj(engine)] }));
    s = resolveAll(declareAttackers(toDeclareAttackers(s), [[engine, 'p2']]));
    expect(pt(s, tokens(s)[0]!)).toBe('5/6');
  });
  it('CR 111.4, 208.3 (ruling 2004-12-01): once created, the Twin\'s size does not follow the engine: a pump afterwards changes the engine only', () => {
    let s = scenario([], { defs: [ENGINE, PUMP], p1: { hand: ['Test Pump'], battlefield: ['Test Twin Engine'] } });
    const engine = find(s, 'Test Twin Engine', 'battlefield');
    s = resolveAll(declareAttackers(toDeclareAttackers(s), [[engine, 'p2']]));
    expect(pt(s, tokens(s)[0]!)).toBe('3/4');
    s = resolveAll(cast(s, 'Test Pump', { targets: [obj(engine)] }));
    expect(pt(s, engine)).toBe('5/6');
    expect(pt(s, tokens(s)[0]!)).toBe('3/4');
  });
});

// ---- Dual Nature -------------------------------------------------------------------------------------------------------------------------------------------------------
const NATURE = card('Test Mirror Nature', 'Enchantment', 'Whenever a nontoken creature enters, its controller creates a token that\'s a copy of that creature.\nWhen this enchantment leaves the battlefield, exile all tokens created with this enchantment.');
const DESTROY_ENCH = card('Test Disenchant', 'Instant', 'Destroy target enchantment.');
const HAND_GRUNT = card('Test Hand Grunt', 'Creature — Ogre', '', ['2', '2']);
const HAND_PET = card('Test Hand Pet', 'Creature — Cat', '', ['1', '1']);

describe('CR 607.2a, 406.2: "When this enchantment leaves the battlefield, exile all tokens created with this enchantment."', () => {
  it('is automated', () => expect(full(NATURE)).toBe(true));
  it('the copies it made are exiled when it leaves; a token made by something else stays (the negative case)', () => {
    let s = scenario([], { defs: [NATURE, DESTROY_ENCH, HAND_GRUNT, MUSTER], p1: { hand: ['Test Muster', 'Test Hand Grunt', 'Test Disenchant'], battlefield: ['Test Mirror Nature'] } });
    s = resolveAll(cast(s, 'Test Muster'));
    const other = tokens(s)[0]!;
    s = resolveAll(cast(s, 'Test Hand Grunt'));
    expect(tokens(s)).toHaveLength(2); // the Soldier and the copy of the Grunt
    s = resolveAll(cast(s, 'Test Disenchant', { targets: [obj(find(s, 'Test Mirror Nature', 'battlefield'))] }));
    expect(tokens(s)).toEqual([other]);
  });
  it('two of them: each exiles only its own copies when it leaves', () => {
    let s = scenario([], { defs: [NATURE, DESTROY_ENCH, HAND_PET], p1: { hand: ['Test Hand Pet', 'Test Disenchant'], battlefield: ['Test Mirror Nature', 'Test Mirror Nature'] } });
    s = resolveAll(cast(s, 'Test Hand Pet'));
    expect(tokens(s)).toHaveLength(2);
    s = resolveAll(cast(s, 'Test Disenchant', { targets: [obj(findAll(s, 'Test Mirror Nature', 'battlefield')[0]!)] }));
    expect(tokens(s)).toHaveLength(1);
  });
  it('the negative case: while it stays, nothing is exiled', () => {
    let s = scenario([], { defs: [NATURE, HAND_PET], p1: { hand: ['Test Hand Pet'], battlefield: ['Test Mirror Nature'] } });
    s = resolveAll(cast(s, 'Test Hand Pet'));
    expect(tokens(s)).toHaveLength(1);
    expect(findAll(s, 'Test Hand Pet', 'battlefield')).toHaveLength(2); // the card and its token copy
  });
});

// ---- Blightreaper Thallid // Blightsower Thallid (the real double-faced card, from the fixtures) -------------------------------------------------------------------
const FLIP = card('Test Flip', 'Sorcery', 'Transform target creature.');
describe('CR 701.27e, 603.2: "When this creature transforms into Blightsower Thallid or dies, create a 1/1 green Phyrexian Saproling creature token."', () => {
  const saprolings = (s: GameState): ObjectId[] => tokens(s).filter((id) => getChars(s, id)!.subtypes.includes('Saproling'));
  const setup = (): GameState => scenario(['Wastes', 'Blightreaper Thallid // Blightsower Thallid'], { defs: [FLIP, SLAY], p1: { hand: ['Test Flip', 'Test Slay'], battlefield: ['Blightreaper Thallid // Blightsower Thallid', 'Wastes', 'Wastes', 'Wastes', 'Wastes'] } });
  it('transforming it to the back face makes a Saproling; transforming it back to the front makes none (the ability is on the back face only)', () => {
    let s = setup();
    const t = find(s, 'Blightreaper Thallid // Blightsower Thallid', 'battlefield');
    s = activate(s, t, /transform/i);
    expect(saprolings(s)).toHaveLength(1);
    s = resolveAll(cast(s, 'Test Flip', { targets: [obj(t)] }));
    expect(saprolings(s)).toHaveLength(1);
  });
  it('dying as the back face makes a Saproling; the front face dying makes none (the negative case)', () => {
    let s = setup();
    const t = find(s, 'Blightreaper Thallid // Blightsower Thallid', 'battlefield');
    s = resolveAll(cast(s, 'Test Slay', { targets: [obj(t)] }));
    expect(saprolings(s)).toHaveLength(0);
    s = setup();
    s = activate(s, find(s, 'Blightreaper Thallid // Blightsower Thallid', 'battlefield'), /transform/i);
    s = resolveAll(cast(s, 'Test Slay', { targets: [obj(find(s, 'Blightreaper Thallid // Blightsower Thallid', 'battlefield'))] }));
    expect(saprolings(s)).toHaveLength(2);
  });
});
