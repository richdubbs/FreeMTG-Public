/**
 * edh-e-21 (Commander coordinator E, group mana): the round's readings played through the engine with synthetic cards compiled by the game's default compiler (invented names and
 * wordings, design 6.10). Each test is named after the rule it checks, with its negative case. CR cites checked against the Comprehensive Rules of 2026-09-25 unless the record lists
 * them as unverified.
 *
 *   CR 118.12, 202.1, 107.3h, 608.2b   "sacrifice this creature unless you pay its mana cost" (Pendrell Flux, Essence Leak): the mana cost of the creature, not of the Aura; {X} is 0; no mana cost, no payment
 *   CR 701.21a, 202.3                  "Target player sacrifices a creature of their choice with mana value 3 or less." (Exile into Darkness)
 *   CR 613.1d, 613.4b, 611.3a          "As long as enchanted artifact isn't a creature, it's an artifact creature with power and toughness each equal to its mana value." (Animate Artifact)
 *   CR 605.1a, 605.3b, 120.3    "{T}: Add {B}. ~ deals 1 damage to you if you don't control an Ogre." (Tomb of Urami)
 *   CR 106.1, 106.4, 202.1, 107.4      "add mana equal to enchanted permanent's mana cost" (Elemental Resonance)
 *   CR 605.3b, 608.2h, 122.1           "{T}, Sacrifice ~: Add {C} for each charge counter on ~." (Shrine of Boundless Growth)
 *   CR 608.2d, 106.4                   "Choose a player. That player adds two mana of any one color they choose." (Stadium Vendors)
 */
import { describe, expect, it } from 'vitest';
import type { GameState, ObjectId } from '../../../src/index';
import { getChars } from '../../../src/rules/characteristics';
import { act, advanceTo, answer, find, findAll, legal, pass, pool, scenario, put } from '../../m3/scenario';
import { tweak } from '../../m4/helpers';
import { card, full, pt, settle } from '../cmd3/helpers';

const nameOf = (s: GameState, id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
const onField = (s: GameState, name: string, owner = 'p1'): ObjectId[] => findAll(s, name, 'battlefield', owner);
/** Answer what is asked (payments automatically, "yes" to may) until a player has priority with an empty stack, or `max` rounds passed. */
function resolveStack(s0: GameState, yes = true): GameState {
  let s = s0;
  for (let g = 0; g < 30; g++) {
    const d = s.pending;
    if (d === null) break;
    if (d.kind === 'priority') { if (s.zones.stack.length === 0) break; s = pass(s); }
    else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (d.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes });
    else break;
  }
  return s;
}
const attach = (s: GameState, aura: string, to: ObjectId, owner: 'p1' | 'p2' = 'p1'): GameState => tweak(s, (t) => { t.objects[put(t, owner, 'battlefield', aura)]!.attachedTo = to; });
const upkeepOf = (s: GameState, turn = 3): GameState => resolveStack(advanceTo(s, turn, 'upkeep'));

// ---- "sacrifice this creature unless you pay its mana cost" --------------------------------------------------------------------------------------------------------------
const LEAKY = card('Test Leaky Brute', 'Creature — Ogre', 'At the beginning of your upkeep, sacrifice this creature unless you pay its mana cost.', ['3', '3'], '{1}{G}');
const LEAKYX = card('Test Leaky Hydra', 'Creature — Hydra', 'At the beginning of your upkeep, sacrifice this creature unless you pay its mana cost.', ['1', '1'], '{X}{G}');
const FREE = card('Test Leaky Wisp', 'Creature — Spirit', 'At the beginning of your upkeep, sacrifice this creature unless you pay its mana cost.', ['1', '1'], '');
const CURSE = card('Test Rust Curse', 'Enchantment — Aura', 'Enchant creature\nEnchanted creature has "At the beginning of your upkeep, sacrifice this creature unless you pay its mana cost."', undefined, '{W}');
const BEARS = card('Test Costly Bears', 'Creature — Bear', '', ['2', '2'], '{2}{G}');
const BLUEBEAR = card('Test Blue Bear', 'Creature — Bear', '', ['2', '2'], '{1}{U}');
const LEAK = card('Test Essence Drain', 'Enchantment — Aura', 'Enchant permanent\nAs long as enchanted permanent is red or green, it has "At the beginning of your upkeep, sacrifice this permanent unless you pay its mana cost."', undefined, '{U}');
const colored = (c: ReturnType<typeof card>, colors: ('W' | 'U' | 'B' | 'R' | 'G')[]) => { for (const f of c.faces) f.colors = colors; return c; }; // eslint-disable-line

describe('CR 118.12, 202.1: "sacrifice this creature unless you pay its mana cost" (Pendrell Flux, Essence Leak)', () => {
  const defs = [LEAKY, LEAKYX, FREE, CURSE, BEARS, LEAK, BLUEBEAR];
  const lands = (n: number, name = 'Forest'): string[] => Array.from({ length: n }, () => name);
  it('the cards are fully automated', () => { for (const d of [LEAKY, LEAKYX, FREE, CURSE, LEAK]) expect(full(d), d.name).toBe(true); });
  it('a creature whose own trigger asks for its mana cost {1}{G}: with two lands the cost is paid (both tapped) and it stays', () => {
    const s = upkeepOf(scenario(['Forest'], { defs, p1: { battlefield: ['Test Leaky Brute', ...lands(2)] } }));
    expect(onField(s, 'Test Leaky Brute').length).toBe(1);
    expect(onField(s, 'Forest').every((id) => s.objects[id]!.tapped)).toBe(true);
  });
  it('negative: with one land it cannot be paid and the creature is sacrificed; with none the same', () => {
    expect(onField(upkeepOf(scenario(['Forest'], { defs, p1: { battlefield: ['Test Leaky Brute', ...lands(1)] } })), 'Test Leaky Brute').length).toBe(0);
    expect(onField(upkeepOf(scenario(['Forest'], { defs, p1: { battlefield: ['Test Leaky Brute'] } })), 'Test Leaky Brute').length).toBe(0);
  });
  it('the player may decline to pay and the creature is sacrificed anyway (CR 118.12)', () => {
    const s = resolveStack(advanceTo(scenario(['Forest'], { defs, p1: { battlefield: ['Test Leaky Brute', ...lands(2)] } }), 3, 'upkeep'), false);
    expect(onField(s, 'Test Leaky Brute').length).toBe(0);
    expect(onField(s, 'Forest').some((id) => s.objects[id]!.tapped)).toBe(false);
  });
  it('an {X} in the mana cost is 0 (CR 107.3h): {X}{G} costs {G}', () => {
    const s = upkeepOf(scenario(['Forest'], { defs, p1: { battlefield: ['Test Leaky Hydra', ...lands(1)] } }));
    expect(onField(s, 'Test Leaky Hydra').length).toBe(1);
    expect(onField(s, 'Forest')[0] && s.objects[onField(s, 'Forest')[0]!]!.tapped).toBe(true);
  });
  it('negative: a creature with no mana cost has nothing to pay (CR 202.1b): it is sacrificed even with lands', () => {
    const s = upkeepOf(scenario(['Forest'], { defs, p1: { battlefield: ['Test Leaky Wisp', ...lands(3)] } }));
    expect(onField(s, 'Test Leaky Wisp').length).toBe(0);
    expect(onField(s, 'Forest').some((id) => s.objects[id]!.tapped)).toBe(false);
  });
  it('Pendrell Flux: the granted trigger asks for the mana cost of the ENCHANTED CREATURE ({2}{G}), not the Aura\'s ({W})', () => {
    const s0 = scenario(['Forest'], { defs, p1: { battlefield: ['Test Costly Bears', ...lands(3)] } });
    const withAura = (n: number): GameState => upkeepOf(attach(scenario(['Forest'], { defs, p1: { battlefield: ['Test Costly Bears', ...lands(n)] } }), 'Test Rust Curse', find(s0, 'Test Costly Bears', 'battlefield')));
    const paid = withAura(3);
    expect(onField(paid, 'Test Costly Bears').length).toBe(1);
    expect(onField(paid, 'Forest').every((id) => paid.objects[id]!.tapped)).toBe(true);
    const short = withAura(2); // {2}{G} needs three mana
    expect(onField(short, 'Test Costly Bears').length).toBe(0);
  });
  it('Essence Leak: only while the enchanted permanent is red or green; a blue permanent is not sacrificed and nothing is asked', () => {
    const green = colored(card('Test Green Bear', 'Creature — Bear', '', ['2', '2'], '{1}{G}'), ['G']);
    const blue = colored(card('Test Blue Bear', 'Creature — Bear', '', ['2', '2'], '{1}{U}'), ['U']);
    const d2 = [LEAK, green, blue];
    const go = (name: string): GameState => {
      const s0 = scenario(['Forest'], { defs: d2, p1: { battlefield: [name] } });
      return upkeepOf(attach(s0, 'Test Essence Drain', find(s0, name, 'battlefield')));
    };
    expect(onField(go('Test Green Bear'), 'Test Green Bear').length).toBe(0); // no mana to pay {1}{G}
    expect(onField(go('Test Blue Bear'), 'Test Blue Bear').length).toBe(1);
  });
});

// ---- Exile into Darkness -------------------------------------------------------------------------------------------------------------------------------------------
const DARKNESS = card('Test Dark Edict', 'Sorcery', 'Target player sacrifices a creature of their choice with mana value 3 or less.', undefined, '{0}');
const SMALL = card('Test Small Imp', 'Creature — Imp', '', ['1', '1'], '{1}');
const BIG = card('Test Big Wurm', 'Creature — Wurm', '', ['6', '6'], '{4}{G}');
const MID = card('Test Mid Cat', 'Creature — Cat', '', ['2', '2'], '{2}{G}');
describe('CR 701.21a, 202.3: "Target player sacrifices a creature of their choice with mana value 3 or less."', () => {
  const defs = [DARKNESS, SMALL, BIG, MID];
  const cast = (p2: string[]): GameState => {
    const s0 = scenario([], { defs, p1: { hand: ['Test Dark Edict'] }, p2: { battlefield: p2 } });
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Dark Edict', 'hand', 'p1') } as never);
    for (let g = 0; g < 10 && s.pending && s.pending.kind !== 'priority'; g++) {
      const d = s.pending;
      if (d.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: [{ kind: 'player', id: 'p2' }] });
      else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
      else break;
    }
    for (let g = 0; g < 10 && (s.zones.stack.length > 0 || (s.pending && s.pending.kind !== 'priority')); g++) {
      if (s.pending?.kind === 'priority') s = pass(s);
      else if (s.pending?.kind === 'chooseObjects') s = answer(s, { kind: 'chooseObjects', ids: [(s.pending as { options: string[] }).options[0]!] });
      else break;
    }
    return s;
  };
  it('is fully automated', () => expect(full(DARKNESS)).toBe(true));
  it('the targeted player sacrifices one of their creatures with mana value 3 or less (the large one is never a choice)', () => {
    const s = cast(['Test Small Imp', 'Test Big Wurm']);
    expect(onField(s, 'Test Small Imp', 'p2').length).toBe(0);
    expect(onField(s, 'Test Big Wurm', 'p2').length).toBe(1);
  });
  it('negative: with only creatures of mana value 5 nothing is sacrificed; mana value exactly 3 is eligible', () => {
    expect(onField(cast(['Test Big Wurm']), 'Test Big Wurm', 'p2').length).toBe(1);
    expect(onField(cast(['Test Mid Cat']), 'Test Mid Cat', 'p2').length).toBe(0);
  });
});

// ---- Animate Artifact ----------------------------------------------------------------------------------------------------------------------------------------------
const ANIMATE = card('Test Animate Relic', 'Enchantment — Aura', "Enchant artifact\nAs long as enchanted artifact isn't a creature, it's an artifact creature with power and toughness each equal to its mana value.", undefined, '{3}{U}');
const RELIC = card('Test Brass Relic', 'Artifact', '', undefined, '{3}');
const GOLEM = card('Test Tin Golem', 'Artifact Creature — Golem', '', ['1', '1'], '{2}');
describe("CR 613.1d, 613.4b, 611.3a: \"As long as enchanted artifact isn't a creature, it's an artifact creature with power and toughness each equal to its mana value.\"", () => {
  const defs = [ANIMATE, RELIC, GOLEM];
  const on = (name: string): GameState => { const s0 = scenario([], { defs, p1: { battlefield: [name] } }); return attach(s0, 'Test Animate Relic', find(s0, name, 'battlefield')); };
  it('is fully automated', () => expect(full(ANIMATE)).toBe(true));
  it('a plain artifact of mana value 3 becomes a 3/3 artifact creature', () => {
    const s = on('Test Brass Relic');
    const c = getChars(s, find(s, 'Test Brass Relic', 'battlefield'))!;
    expect(c.types).toContain('Creature');
    expect(pt(s, find(s, 'Test Brass Relic', 'battlefield'))).toBe('3/3');
  });
  it('negative: an artifact that already is a creature keeps its own 1/1 (the Aura does nothing)', () => {
    const s = on('Test Tin Golem');
    expect(pt(s, find(s, 'Test Tin Golem', 'battlefield'))).toBe('1/1');
  });
});

// ---- Tomb of Urami -------------------------------------------------------------------------------------------------------------------------------------------------
const TOMB = card('Test Ember Tomb', 'Land', '{T}: Add {B}. ~ deals 1 damage to you if you don\'t control an Ogre.');
const OGRE = card('Test Ogre', 'Creature — Ogre', '', ['2', '2'], '{2}');
describe("CR 605.3b, 120.3: \"{T}: Add {B}. ~ deals 1 damage to you if you don't control an Ogre.\"", () => {
  const tap = (battlefield: string[]): GameState => {
    const s0 = scenario([], { defs: [TOMB, OGRE], p1: { battlefield } });
    const a = legal(s0, 'p1', 'activate').find((x) => x.isMana && x.object !== undefined && nameOf(s0, x.object) === 'Test Ember Tomb')!;
    return act(s0, a.action);
  };
  it('is fully automated', () => expect(full(TOMB)).toBe(true));
  it('without an Ogre it adds {B} and its controller takes 1 damage', () => {
    const s = tap(['Test Ember Tomb']);
    expect(pool(s, 'p1')).toBe('B');
    expect(s.players.find((p) => p.id === 'p1')!.life).toBe(19);
  });
  it('negative: with an Ogre (any Ogre you control) it adds {B} and deals no damage', () => {
    const s = tap(['Test Ember Tomb', 'Test Ogre']);
    expect(pool(s, 'p1')).toBe('B');
    expect(s.players.find((p) => p.id === 'p1')!.life).toBe(20);
  });
});

// ---- Elemental Resonance -------------------------------------------------------------------------------------------------------------------------------------------
const RESONANCE = card('Test Echo Aura', 'Enchantment — Aura', 'Enchant permanent\nAt the beginning of your first main phase, add mana equal to enchanted permanent\'s mana cost.', undefined, '{G}');
const RARE = card('Test Prism Relic', 'Artifact', '', undefined, '{2}{G}{R}');
const MIXED = card('Test Hybrid Relic', 'Artifact', '', undefined, '{W/U}{X}{C}');
describe('CR 106.1, 202.1, 107.4: "At the beginning of your first main phase, add mana equal to enchanted permanent\'s mana cost."', () => {
  const defs = [RESONANCE, RARE, MIXED];
  const at = (name: string, answers: ((s: GameState) => GameState)[] = [], settleAll = true): GameState => {
    const s0 = scenario([], { defs, p1: { battlefield: [name] } });
    let s = settleAll ? resolveStack(advanceTo(attach(s0, 'Test Echo Aura', find(s0, name, 'battlefield')), 3, 'main1')) : (() => { let t = advanceTo(attach(s0, 'Test Echo Aura', find(s0, name, 'battlefield')), 3, 'main1'); for (let g = 0; g < 5 && t.pending?.kind === 'priority' && t.zones.stack.length > 0; g++) t = pass(t); return t; })();
    for (const f of answers) s = f(s);
    return s;
  };
  it('is fully automated', () => expect(full(RESONANCE)).toBe(true));
  it('{2}{G}{R} adds two colorless, {G} and {R}', () => {
    expect(pool(at('Test Prism Relic'), 'p1')).toBe('CCGR');
  });
  it('a hybrid symbol adds one of its colors as the player chooses; {X} adds nothing (X is 0) and {C} adds {C}', () => {
    const s0 = at('Test Hybrid Relic', [], false);
    expect(s0.pending).toMatchObject({ kind: 'chooseColor', options: ['W', 'U'] });
    const s = resolveStack(answer(s0, { kind: 'chooseColor', color: 'U' }));
    expect(pool(s, 'p1')).toBe('CU');
  });
  it('negative: a permanent with no mana cost (a land) gives no mana', () => {
    const land = card('Test Quiet Land', 'Land', '');
    const s0 = scenario([], { defs: [RESONANCE, land], p1: { battlefield: ['Test Quiet Land'] } });
    const s = resolveStack(advanceTo(attach(s0, 'Test Echo Aura', find(s0, 'Test Quiet Land', 'battlefield')), 3, 'main1'));
    expect(pool(s, 'p1')).toBe('');
  });
});

// ---- Shrine of Boundless Growth ------------------------------------------------------------------------------------------------------------------------------------
const SHRINE = card('Test Growth Shrine', 'Artifact', '{T}, Sacrifice ~: Add {C} for each charge counter on ~.');
describe('CR 605.3b, 608.2h, 122.1: "{T}, Sacrifice ~: Add {C} for each charge counter on ~."', () => {
  const sac = (counters: number): GameState => {
    const s0 = scenario([], { defs: [SHRINE], p1: { battlefield: [{ name: 'Test Growth Shrine', counters: { charge: counters } } as never] } });
    const a = legal(s0, 'p1', 'activate').find((x) => x.isMana && x.object !== undefined && nameOf(s0, x.object) === 'Test Growth Shrine')!;
    return act(s0, a.action);
  };
  it('is fully automated', () => expect(full(SHRINE)).toBe(true));
  it('three charge counters: three colorless mana, from the counters the sacrificed Shrine last had; the Shrine is gone', () => {
    const s = sac(3);
    expect(pool(s, 'p1')).toBe('CCC');
    expect(onField(s, 'Test Growth Shrine').length).toBe(0);
  });
  it('negative: no counters: no mana (the sacrifice is still a cost)', () => {
    const s = sac(0);
    expect(pool(s, 'p1')).toBe('');
    expect(onField(s, 'Test Growth Shrine').length).toBe(0);
  });
});

// ---- Stadium Vendors -----------------------------------------------------------------------------------------------------------------------------------------------
const VENDOR = card('Test Gift Vendor', 'Creature — Goblin', 'When this creature enters, choose a player. That player adds two mana of any one color they choose.', ['1', '1']);
const FOUNTAIN = card('Test Gift Fountain', 'Creature — Goblin', 'When this creature enters, choose a player. That player gains 2 life.', ['1', '1']);
describe('CR 608.2d, 106.4: "When this creature enters, choose a player. That player adds two mana of any one color they choose."', () => {
  let chooser = '';
  const run = (name: string): GameState => {
    const s0 = scenario([], { defs: [VENDOR, FOUNTAIN], p1: { hand: [name] } });
    let s = act(s0, { type: 'cast', player: 'p1', card: find(s0, name, 'hand', 'p1') } as never);
    for (let g = 0; g < 30 && (s.zones.stack.length > 0 || (s.pending && s.pending.kind !== 'priority')); g++) {
      const d = s.pending!;
      if (d.kind === 'priority') s = pass(s);
      else if (d.kind === 'chooseOption') {
        const opts = (d as { options: { id: string; label: string }[] }).options;
        s = answer(s, { kind: 'chooseOption', ids: [(opts.find((o) => o.id === 'p2') ?? opts.find((o) => o.id === 'R') ?? opts[0]!).id] });
      } else if (d.kind === 'chooseColor') { chooser = d.player; s = answer(s, { kind: 'chooseColor', color: 'R' }); }
      else if (d.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
      else throw new Error(`unexpected decision ${d.kind}`);
    }
    return s;
  };
  it('are fully automated', () => { expect(full(VENDOR)).toBe(true); expect(full(FOUNTAIN)).toBe(true); });
  it('the chosen player gains the life (the promoted "choose a player"); the other players do not', () => {
    const s = run('Test Gift Fountain');
    const life = (id: string): number => s.players.find((p) => p.id === id)!.life;
    expect([life('p1'), life('p2')].sort()).toEqual([20, 22]);
  });
  it('the chosen player adds two mana of ONE color they choose', () => {
    const s = run('Test Gift Vendor');
    const got = [pool(s, 'p1'), pool(s, 'p2')].filter((x) => x !== '');
    expect(got.length).toBe(1);
    expect(got[0]!.length).toBe(2);
    expect(got[0]![0]).toBe(got[0]![1]);
    expect(chooser).toBe(pool(s, 'p2') === '' ? 'p1' : 'p2'); // the player who adds the mana chooses the color ("they choose")
  });
});

// ---- Lithoform Blight ----------------------------------------------------------------------------------------------------------------------------------------------
const BLIGHT = card('Test Barren Aura', 'Enchantment — Aura', 'Enchant land\nEnchanted land loses all land types and abilities and has "{T}: Add {C}" and "{T}, Pay 1 life: Add one mana of any color."', undefined, '{1}{B}');
describe('CR 205.3i, 305.7, 613.1d, 613.1f: "Enchanted land loses all land types and abilities and has \\"{T}: Add {C}\\" and \\"{T}, Pay 1 life: Add one mana of any color.\\""', () => {
  const board = (): GameState => { const s0 = scenario(['Forest', 'Forest'], { defs: [BLIGHT], p1: { battlefield: ['Forest', 'Forest'] } }); return attach(s0, 'Test Barren Aura', find(s0, 'Forest', 'battlefield')); };
  it('is fully automated', () => expect(full(BLIGHT)).toBe(true));
  it('the enchanted Forest is no Forest any more (no land type) and taps for {C} (or any color for 1 life), never {G}; the other Forest still taps for {G}', () => {
    const s = board();
    const enchanted = find(s, 'Forest', 'battlefield');
    const c = getChars(s, enchanted)!;
    expect(c.subtypes).not.toContain('Forest');
    const acts = legal(s, 'p1', 'activate').filter((a) => a.isMana && a.object === enchanted);
    expect(acts.length).toBe(2); // {T}: Add {C}, and {T}, Pay 1 life: Add one mana of any color
    const free = acts.find((a) => !/life/i.test(a.label))!;
    const t = act(s, free.action);
    expect(pool(t, 'p1')).toBe('C');
  });
  it('negative: the other Forest (not enchanted) keeps its land type and its {G} ability', () => {
    const s = board();
    const other = s.zones.battlefield.filter((id) => nameOf(s, id) === 'Forest')[1]!;
    expect(getChars(s, other)!.subtypes).toContain('Forest');
    const a = legal(s, 'p1', 'activate').find((x) => x.isMana && x.object === other)!;
    expect(pool(act(s, a.action), 'p1')).toBe('G');
  });
});
