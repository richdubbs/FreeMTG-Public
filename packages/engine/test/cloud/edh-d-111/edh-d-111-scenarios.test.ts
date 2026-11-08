/**
 * Round edh-d-111 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups library 3/3 and counters 3/3): the new readings played through the engine with synthetic cards
 * (invented names, design 6.10), each test named after the rule it checks, with its negative case.
 */
import { describe, expect, it } from 'vitest';
import { compileCard, legalActions, type Action, type CardDef, type DecisionAnswer, type GameState, type ObjectId, type OracleCard } from '../../../src/index';
import { act, answer, find, scenario } from '../../m3/scenario';
import { counters, full } from '../cmd3/helpers';

/** A synthetic card compiled by the default compiler, its colors those of its mana cost (CR 105.2). */
function card(name: string, type: string, text: string, pt?: [string, string], cost = '{0}'): CardDef {
  const colors = ['W', 'U', 'B', 'R', 'G'].filter((c) => cost.includes(`{${c}}`));
  return compileCard({ name, layout: 'normal', mana_cost: cost, type_line: type, oracle_text: text, colors, ...(pt ? { power: pt[0], toughness: pt[1] } : {}) } as OracleCard);
}

const nameOf = (s: GameState, id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
const namesIn = (s: GameState, zone: 'hand' | 'graveyard' | 'library', p = 'p1'): string[] => (s.zones[zone][p] ?? []).map((id) => nameOf(s, id));
const life = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
const onField = (s: GameState, name: string): ObjectId => s.zones.battlefield.find((id) => nameOf(s, id) === name)!;

interface Script { objects?: ((s: GameState, options: ObjectId[]) => ObjectId[])[]; numbers?: number[]; yes?: boolean[]; targets?: DecisionAnswer[] }
/** Answer every decision in front of us by the script (first unscripted: the least choice), until a player has priority. */
function settle(s0: GameState, sc: Script = {}): GameState {
  let s = s0;
  for (let guard = 0; s.pending && s.pending.kind !== 'priority' && guard < 40; guard++) {
    const d = s.pending as { kind: string; options?: ObjectId[]; min?: number; items?: { id: string }[]; recipients?: unknown };
    if (d.kind === 'chooseObjects') {
      const f = sc.objects?.shift();
      s = answer(s, { kind: 'chooseObjects', ids: f ? f(s, d.options!) : d.options!.slice(0, d.min ?? 0) });
    } else if (d.kind === 'chooseNumber') s = answer(s, { kind: 'chooseNumber', n: sc.numbers?.shift() ?? d.min ?? 0 });
    else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (d.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: sc.yes?.shift() ?? true });
    else if (d.kind === 'chooseTargets') s = answer(s, sc.targets?.shift() ?? { kind: 'chooseTargets', targets: [] });
    else if (d.kind === 'order') s = answer(s, { kind: 'order', ids: d.items!.map((x) => x.id) });
    else if (d.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: [(s.pending as unknown as { options: { id: string }[] }).options[0]!.id] });
    else break;
  }
  return s;
}
const passPriority = (s: GameState): GameState => act(s, { type: 'pass', player: (s.pending as { player: string }).player });
function resolveAll(s0: GameState, sc: Script = {}): GameState {
  let s = settle(s0, sc);
  for (let guard = 0; s.zones.stack.length > 0 && guard < 40; guard++) s = settle(passPriority(s), sc);
  return s;
}
const byName = (names: string[]) => (s: GameState, options: ObjectId[]): ObjectId[] => options.filter((id) => names.includes(nameOf(s, id)));
const castSpell = (s: GameState, name: string, sc: Script = {}): GameState => settle(act(s, { type: 'cast', player: 'p1', card: find(s, name, 'hand', 'p1') }), sc);
const activations = (s: GameState, name: string): Action[] =>
  legalActions(s, 'p1').filter((a) => a.kind === 'activate' && a.object !== undefined && nameOf(s, a.object) === name).map((a) => a.action);

// --- Explosive Revelation: "Choose any target. Reveal cards from the top of your library until you reveal a nonland card. ~ deals damage equal to that card's mana value to that
// permanent or player. Put the nonland card into your hand and the rest on the bottom of your library in any order." ---
describe('Explosive Revelation: "the nonland card" is the card the reveal until stopped at; the rest go to the bottom in an order you choose (CR 701.20a, 608.2c, 401.4)', () => {
  const OMEN = card('Test Burst Omen', 'Sorcery', "Choose any target. Reveal cards from the top of your library until you reveal a nonland card. Test Burst Omen deals damage equal to that card's mana value to that permanent or player. Put the nonland card into your hand and the rest on the bottom of your library in any order.", undefined, '{0}');
  const OX = card('Test Grey Ox', 'Creature — Ox', '', ['2', '2'], '{2}{G}');
  const D = [OMEN, OX];
  const target = (p: string): DecisionAnswer => ({ kind: 'chooseTargets', targets: [{ kind: 'player', id: p }] } as unknown as DecisionAnswer);
  it('the synthetic card is automated', () => expect(full(OMEN)).toBe(true));
  it('CR 701.20a, 608.2c: two lands, then a mana value 3 card: 3 damage to the target player, the card into your hand, the two lands on the bottom', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Burst Omen'], library: ['Forest', 'Forest', 'Test Grey Ox', 'Island', 'Island'] } });
    s = resolveAll(castSpell(s, 'Test Burst Omen', { targets: [target('p2')] }), { targets: [target('p2')] });
    expect(life(s, 'p2')).toBe(17);
    expect(namesIn(s, 'hand')).toEqual(['Test Grey Ox']);
    const l = namesIn(s, 'library');
    expect(l.slice(0, 2)).toEqual(['Island', 'Island']); // (the scenario's own deck of Plains follows)
    expect(l.slice(-2)).toEqual(['Forest', 'Forest']);
  });
  it('negative (ruling 2010-06-15): a library of lands only: every card is revealed, none dealt damage, all go back to the bottom', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Burst Omen'], library: ['Forest', 'Island', 'Forest'] } });
    s = resolveAll(castSpell(s, 'Test Burst Omen', { targets: [target('p2')] }), { targets: [target('p2')] });
    expect(life(s, 'p2')).toBe(20);
    expect(namesIn(s, 'hand')).toEqual([]);
    expect(namesIn(s, 'library').filter((n) => n !== 'Plains').sort()).toEqual(['Forest', 'Forest', 'Island']);
  });
});

// --- Tezzeret's Gatebreaker: "look at the top five cards of your library. You may reveal a blue or artifact card from among them and put it into your hand. Put the rest on the
// bottom of your library in a random order." ---
describe('Tezzeret\'s Gatebreaker: "a blue or artifact card" is a card of that color or of that card type (CR 105.2, 205.2a, 701.20e)', () => {
  const GATE = card('Test Gate Prober', 'Artifact', 'When Test Gate Prober enters, look at the top five cards of your library. You may reveal a blue or artifact card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.', undefined, '{0}');
  const BLUE = card('Test Blue Wisp', 'Creature — Spirit', '', ['1', '1'], '{U}');
  const ROCK = card('Test Grey Rock', 'Artifact', '', undefined, '{1}');
  const GREEN = card('Test Green Ox', 'Creature — Ox', '', ['2', '2'], '{G}');
  const D = [GATE, BLUE, ROCK, GREEN];
  const lib = ['Test Green Ox', 'Test Blue Wisp', 'Test Grey Rock', 'Forest', 'Test Green Ox', 'Island'];
  it('the synthetic card is automated', () => expect(full(GATE)).toBe(true));
  it('CR 105.2: a blue creature card may be taken; the other four go to the bottom, under the card that was sixth', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Gate Prober'], library: lib } });
    s = resolveAll(castSpell(s, 'Test Gate Prober'), { objects: [byName(['Test Blue Wisp'])] });
    expect(namesIn(s, 'hand')).toEqual(['Test Blue Wisp']);
    const l = namesIn(s, 'library');
    expect(l[0]).toBe('Island');
    expect(l.slice(-4).sort()).toEqual(['Forest', 'Test Green Ox', 'Test Green Ox', 'Test Grey Rock']);
  });
  it('CR 205.2a: so may a colorless artifact card; negative: a green creature card or a land is never offered', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Gate Prober'], library: lib } });
    let offered: string[] = [];
    s = resolveAll(castSpell(s, 'Test Gate Prober'), { objects: [(t, options) => { offered = options.map((id) => nameOf(t, id)).sort(); return options.filter((id) => nameOf(t, id) === 'Test Grey Rock'); }] });
    expect(offered).toEqual(['Test Blue Wisp', 'Test Grey Rock']);
    expect(namesIn(s, 'hand')).toEqual(['Test Grey Rock']);
  });
});

// --- Voda Sea Scavenger: "look at the top X cards ... You may put one of those cards on top of your library. Put the rest on the bottom of your library in a random order." ---
describe('Voda Sea Scavenger: "you may put one of those cards on top of your library", the rest on the bottom (CR 701.20e, 401.4, 608.2d)', () => {
  const SCOUT = card('Test Tide Picker', 'Creature — Merfolk', 'When Test Tide Picker enters, look at the top three cards of your library. You may put one of those cards on top of your library. Put the rest on the bottom of your library in a random order.', ['1', '1'], '{0}');
  const A = card('Test Card A', 'Sorcery', 'You gain 1 life.', undefined, '{1}');
  const B = card('Test Card B', 'Sorcery', 'You gain 2 life.', undefined, '{1}');
  const C = card('Test Card C', 'Sorcery', 'You gain 3 life.', undefined, '{1}');
  const D = [SCOUT, A, B, C];
  const lib = ['Test Card A', 'Test Card B', 'Test Card C', 'Island'];
  it('the synthetic card is automated', () => expect(full(SCOUT)).toBe(true));
  it('CR 401.4: the chosen card (the third) stays on top; the other two go under the card that was fourth', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Tide Picker'], library: lib } });
    s = resolveAll(castSpell(s, 'Test Tide Picker'), { objects: [byName(['Test Card C'])] });
    const l = namesIn(s, 'library');
    expect(l[0]).toBe('Test Card C');
    expect(l[1]).toBe('Island');
    expect(l.slice(-2).sort()).toEqual(['Test Card A', 'Test Card B']);
  });
  it('negative (CR 608.2d): choosing none puts all three on the bottom', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Tide Picker'], library: lib } });
    s = resolveAll(castSpell(s, 'Test Tide Picker'), { objects: [() => []] });
    const l = namesIn(s, 'library');
    expect(l[0]).toBe('Island');
    expect(l.slice(-3).sort()).toEqual(['Test Card A', 'Test Card B', 'Test Card C']);
  });
});

// --- Urge to Feed: "You may tap any number of untapped Vampire creatures you control. If you do, put a +1/+1 counter on each of those Vampires." ---
describe('Urge to Feed: "each of those Vampires" is the Vampires tapped this way (CR 701.26a, 608.2c)', () => {
  const FEED = card('Test Hunger Rite', 'Instant', 'Target creature gets -3/-3 until end of turn. You may tap any number of untapped Vampire creatures you control. If you do, put a +1/+1 counter on each of those Vampires.', undefined, '{0}');
  const VAMP = card('Test Night Vampire', 'Creature — Vampire', '', ['2', '2'], '{1}{B}');
  const VAMP2 = card('Test Dusk Vampire', 'Creature — Vampire', '', ['2', '2'], '{1}{B}');
  const OX = card('Test Grey Ox', 'Creature — Ox', '', ['5', '5'], '{3}');
  const D = [FEED, VAMP, VAMP2, OX];
  const board = (): GameState => scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Hunger Rite'], battlefield: ['Test Night Vampire', 'Test Dusk Vampire', 'Test Grey Ox'] }, p2: { battlefield: ['Test Grey Ox'] } });
  const targetOx = (s: GameState): DecisionAnswer => ({ kind: 'chooseTargets', targets: [{ kind: 'object', id: s.zones.battlefield.find((id) => nameOf(s, id) === 'Test Grey Ox' && s.objects[id]!.controller === 'p2')! }] } as unknown as DecisionAnswer);
  it('the synthetic card is automated', () => expect(full(FEED)).toBe(true));
  it('CR 701.26a, 608.2c: the one Vampire tapped gets the counter; the untapped one and the Ox do not', () => {
    let s = board();
    const t = targetOx(s);
    s = resolveAll(castSpell(s, 'Test Hunger Rite', { targets: [t] }), { targets: [t], yes: [true], objects: [byName(['Test Night Vampire'])] });
    const night = onField(s, 'Test Night Vampire'); const dusk = onField(s, 'Test Dusk Vampire');
    expect(s.objects[night]!.tapped).toBe(true);
    expect(counters(s, night, '+1/+1')).toBe(1);
    expect(s.objects[dusk]!.tapped).toBe(false);
    expect(counters(s, dusk, '+1/+1')).toBe(0);
    expect(s.zones.battlefield.filter((id) => counters(s, id, '+1/+1') > 0)).toHaveLength(1);
  });
  it('negative (CR 608.2d): declining taps nothing and puts no counter', () => {
    let s = board();
    const t = targetOx(s);
    s = resolveAll(castSpell(s, 'Test Hunger Rite', { targets: [t] }), { targets: [t], yes: [false] });
    expect(s.zones.battlefield.some((id) => counters(s, id, '+1/+1') > 0 || (s.objects[id]!.controller === 'p1' && s.objects[id]!.tapped))).toBe(false);
  });
});

// --- Assembly Hall: "{4}, {T}: Reveal a creature card in your hand. Search your library for a card with the same name as that card, reveal it, put it into your hand, then shuffle." ---
describe('Assembly Hall: the search finds a card with the same name as the revealed card (CR 701.20a, 701.23a, 201.2)', () => {
  const HALL = card('Test Muster Hall', 'Artifact', '{0}, {T}: Reveal a creature card in your hand. Search your library for a card with the same name as that card, reveal it, put it into your hand, then shuffle.', undefined, '{0}');
  const OX = card('Test Grey Ox', 'Creature — Ox', '', ['2', '2'], '{2}');
  const ELK = card('Test Red Elk', 'Creature — Elk', '', ['2', '2'], '{2}');
  const D = [HALL, OX, ELK];
  it('the synthetic card is automated', () => expect(full(HALL)).toBe(true));
  it('CR 201.2: only a card named as the revealed one is offered; it goes to your hand', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Grey Ox', 'Test Red Elk'], battlefield: ['Test Muster Hall'], library: ['Test Red Elk', 'Test Grey Ox', 'Island'] } });
    let offered: string[] = [];
    s = act(s, activations(s, 'Test Muster Hall')[0]!);
    s = resolveAll(s, { objects: [(t, o) => o.filter((id) => nameOf(t, id) === 'Test Grey Ox'), (t, o) => { offered = o.map((id) => nameOf(t, id)); return o.slice(0, 1); }] });
    expect(offered).toEqual(['Test Grey Ox']);
    expect(namesIn(s, 'hand').sort()).toEqual(['Test Grey Ox', 'Test Grey Ox', 'Test Red Elk']);
    expect(namesIn(s, 'library').filter((n) => n !== 'Plains').sort()).toEqual(['Island', 'Test Red Elk']);
  });
  it('negative (ruling 2004-10-04: you do not have to find a card): with no card of that name the search finds nothing; the hand keeps only the revealed card', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Grey Ox'], battlefield: ['Test Muster Hall'], library: ['Test Red Elk', 'Island'] } });
    s = act(s, activations(s, 'Test Muster Hall')[0]!);
    s = resolveAll(s, { objects: [(t, o) => o.filter((id) => nameOf(t, id) === 'Test Grey Ox'), () => []] });
    expect(namesIn(s, 'hand')).toEqual(['Test Grey Ox']);
    expect(namesIn(s, 'library').filter((n) => n !== 'Plains')).toHaveLength(2);
  });
});

// --- Phylactery Lich: "As this creature enters, put a phylactery counter on an artifact you control." ---
describe('Phylactery Lich: as it enters, a counter goes on an artifact you control, chosen then (CR 614.1c, 614.12, 122.1)', () => {
  const LICH = card('Test Bone Lich', 'Creature — Zombie', 'Indestructible\nAs Test Bone Lich enters, put a soul counter on an artifact you control.\nWhen you control no permanents with soul counters on them, sacrifice Test Bone Lich.', ['5', '5'], '{0}');
  const ROCK = card('Test Grey Rock', 'Artifact', '', undefined, '{1}');
  const D = [LICH, ROCK];
  it('the synthetic card is automated', () => expect(full(LICH)).toBe(true));
  it('CR 614.1c: the chosen artifact you control gets the counter as the Lich enters; the Lich stays', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Bone Lich'], battlefield: ['Test Grey Rock'] }, p2: { battlefield: ['Test Grey Rock'] } });
    s = resolveAll(castSpell(s, 'Test Bone Lich'));
    const rock = s.zones.battlefield.find((id) => nameOf(s, id) === 'Test Grey Rock' && s.objects[id]!.controller === 'p1')!;
    const theirs = s.zones.battlefield.find((id) => nameOf(s, id) === 'Test Grey Rock' && s.objects[id]!.controller === 'p2')!;
    expect(counters(s, rock, 'soul')).toBe(1);
    expect(counters(s, theirs, 'soul')).toBe(0);
    expect(onField(s, 'Test Bone Lich')).toBeDefined();
  });
  it('negative (ruling 2018-07-13): with no artifact you control nothing gets a counter, and the state trigger makes you sacrifice the Lich', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { hand: ['Test Bone Lich'] }, p2: { battlefield: ['Test Grey Rock'] } });
    s = resolveAll(castSpell(s, 'Test Bone Lich'));
    expect(s.zones.battlefield.some((id) => counters(s, id, 'soul') > 0)).toBe(false);
    expect(namesIn(s, 'graveyard')).toEqual(['Test Bone Lich']);
  });
});

// --- Rasputin, the Oneiromancer: "{T}, Remove one or more dream counters from Rasputin: Add that much {C}." ---
describe('Rasputin, the Oneiromancer: a mana ability whose cost removes one or more counters, X of them, adds X (CR 107.1c, 107.3a, 605.3b)', () => {
  const SEER = card('Test Dream Seer', 'Creature — Human Wizard', '{T}, Remove one or more dream counters from Test Dream Seer: Add that much {C}.', ['1', '1'], '{0}');
  const D = [SEER];
  const tapForMana = (s: GameState, n: number): GameState => {
    const a = legalActions(s, 'p1').find((x) => x.kind === 'activate' && x.isMana === true);
    if (!a) throw new Error('no mana ability offered');
    return settle(act(s, a.action), { numbers: [n] });
  };
  const pool = (s: GameState): string => s.players.find((p) => p.id === 'p1')!.manaPool.map((u) => u.type).join('');
  it('the synthetic card is automated', () => expect(full(SEER)).toBe(true));
  it('CR 107.1c, 605.3b: with three dream counters, removing two adds {C}{C} and leaves one', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { battlefield: [{ name: 'Test Dream Seer', counters: { dream: 3 } }] } });
    s = tapForMana(s, 2);
    expect(pool(s)).toBe('CC');
    expect(counters(s, onField(s, 'Test Dream Seer'), 'dream')).toBe(1);
  });
  it('negative (CR 107.3a, 602.2b): "one or more": with no dream counter the ability adds nothing and can\'t be activated', () => {
    const s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { battlefield: ['Test Dream Seer'] } });
    expect(legalActions(s, 'p1').filter((x) => x.kind === 'activate' && x.isMana === true)).toEqual([]); // (review fix: not offered, as the non-mana form)
    const one = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { battlefield: [{ name: 'Test Dream Seer', counters: { dream: 1 } }] } });
    expect(pool(tapForMana(one, 1))).toBe('C'); // one counter: X is 1
  });
});

// --- Arcee, Sharpshooter: "{1}, Remove one or more +1/+1 counters from Arcee: It deals that much damage to target creature." (a non-mana ability) ---
describe('"Remove one or more +1/+1 counters from ~" of a non-mana ability: X announced at least 1 (CR 107.1c, 107.3a, 602.2b)', () => {
  const GUN = card('Test Bolt Robot', 'Artifact Creature — Robot', '{0}, Remove one or more +1/+1 counters from Test Bolt Robot: It deals that much damage to target creature.', ['1', '1'], '{0}');
  const OX = card('Test Grey Ox', 'Creature — Ox', '', ['5', '5'], '{3}');
  const D = [GUN, OX];
  it('the synthetic card is automated', () => expect(full(GUN)).toBe(true));
  it('CR 107.1c: X = 2 removes two counters and deals 2 damage', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { battlefield: [{ name: 'Test Bolt Robot', counters: { '+1/+1': 3 } }] }, p2: { battlefield: ['Test Grey Ox'] } });
    const ox = onField(s, 'Test Grey Ox');
    s = act(s, activations(s, 'Test Bolt Robot')[0]!);
    s = resolveAll(s, { numbers: [2], targets: [{ kind: 'chooseTargets', targets: [{ kind: 'object', id: ox }] } as unknown as DecisionAnswer] });
    expect(counters(s, onField(s, 'Test Bolt Robot'), '+1/+1')).toBe(1);
    expect(s.objects[ox]!.damage).toBe(2);
  });
  it('negative (CR 107.3a): with no counter on it the ability is not offered (X can\'t be 0)', () => {
    const s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { battlefield: ['Test Bolt Robot'] }, p2: { battlefield: ['Test Grey Ox'] } });
    expect(activations(s, 'Test Bolt Robot')).toEqual([]);
  });
});

// --- Voodoo Doll: "{X}{X}, {T}: This artifact deals damage equal to the number of pin counters on it to any target. X is the number of pin counters on this artifact." ---
describe('Voodoo Doll: the X of the cost is the number of pin counters on the source (CR 107.3c, 122.1, 602.2b)', () => {
  const DOLL = card('Test Pin Doll', 'Artifact', '{X}{X}, {T}: Test Pin Doll deals damage equal to the number of pin counters on it to any target. X is the number of pin counters on Test Pin Doll.', undefined, '{0}');
  const D = [DOLL];
  const toP2: DecisionAnswer = { kind: 'chooseTargets', targets: [{ kind: 'player', id: 'p2' }] } as unknown as DecisionAnswer;
  it('the synthetic card is automated', () => expect(full(DOLL)).toBe(true));
  it('CR 107.3c: with two pin counters the cost is {2}{2}: four lands tap and 2 damage is dealt', () => {
    let s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { battlefield: [{ name: 'Test Pin Doll', counters: { pin: 2 } }, 'Swamp', 'Swamp', 'Swamp', 'Swamp', 'Swamp'] } });
    s = act(s, activations(s, 'Test Pin Doll')[0]!);
    s = resolveAll(s, { targets: [toP2] });
    expect(life(s, 'p2')).toBe(18);
    expect(s.zones.battlefield.filter((id) => nameOf(s, id) === 'Swamp' && s.objects[id]!.tapped)).toHaveLength(4);
  });
  it('negative (CR 107.3c, 601.2f): with three pin counters and only five lands the {3}{3} cost can\'t be paid: the ability is not offered', () => {
    const s = scenario(['Forest', 'Island', 'Swamp'], { defs: D, p1: { battlefield: [{ name: 'Test Pin Doll', counters: { pin: 3 } }, 'Swamp', 'Swamp', 'Swamp', 'Swamp', 'Swamp'] } });
    expect(activations(s, 'Test Pin Doll')).toEqual([]);
  });
});

// --- Codespell Cleric: "When this creature enters, if it was the second spell you cast this turn, put a +1/+1 counter on target creature." ---
describe('Codespell Cleric: "if it was the second spell you cast this turn" reads the cast record of the creature that entered (CR 601.2i, 603.4)', () => {
  const CLERIC = card('Test Code Acolyte', 'Creature — Human Cleric', 'Vigilance\nWhen Test Code Acolyte enters, if it was the second spell you cast this turn, put a +1/+1 counter on target creature.', ['1', '1'], '{0}');
  const SIP = card('Test Quick Sip', 'Instant', 'You gain 1 life.', undefined, '{0}');
  const OX = card('Test Grey Ox', 'Creature — Ox', '', ['2', '2'], '{3}');
  const D = [CLERIC, SIP, OX];
  const board = (): GameState => scenario(['Forest'], { defs: D, p1: { hand: ['Test Code Acolyte', 'Test Quick Sip', 'Test Quick Sip'], battlefield: ['Test Grey Ox'] } });
  const toOx = (s: GameState): DecisionAnswer => ({ kind: 'chooseTargets', targets: [{ kind: 'object', id: onField(s, 'Test Grey Ox') }] } as unknown as DecisionAnswer);
  it('the synthetic card is automated', () => expect(full(CLERIC)).toBe(true));
  it('CR 601.2i, 603.4: cast second (after one instant), it puts the counter on the target', () => {
    let s = board();
    s = resolveAll(castSpell(s, 'Test Quick Sip'));
    s = resolveAll(castSpell(s, 'Test Code Acolyte'), { targets: [toOx(s)] });
    expect(counters(s, onField(s, 'Test Grey Ox'), '+1/+1')).toBe(1);
  });
  it('negative (CR 603.4): cast first, or third, it does not trigger', () => {
    let s = resolveAll(castSpell(board(), 'Test Code Acolyte'), { targets: [toOx(board())] });
    expect(counters(s, onField(s, 'Test Grey Ox'), '+1/+1')).toBe(0);
    s = board();
    s = resolveAll(castSpell(s, 'Test Quick Sip'));
    s = resolveAll(castSpell(s, 'Test Quick Sip'));
    s = resolveAll(castSpell(s, 'Test Code Acolyte'), { targets: [toOx(s)] });
    expect(counters(s, onField(s, 'Test Grey Ox'), '+1/+1')).toBe(0);
  });
});
