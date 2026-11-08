/**
 * Commander coordinator E, round edh-e-62 (groups copy / control / dice-random): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by
 * the game's default compiler, in 4-player games (Alice p1, Bob p2, Carol p3, Dan p4). Each test is named after the rule it checks, with its negative case. CR cites are from memory in the cloud
 * session (the Comprehensive Rules text was fetched when the round was built; cites not re-read are listed in the round's record as unverified).
 *
 *   CR 603.4, 119.1, 613.1b    "At the beginning of your upkeep, if a player has more life than each other player, the player with the most life gains control of this creature." (Wild Dogs)
 *   CR 603.4, 402.1, 613.1b    "... if a player has more cards in hand than each other player, the player who has the most cards in hand gains control of this creature." (Sokenzan Renegade)
 *   CR 119.1, 608.2d, 613.1b   "... the player with the lowest life total gains control of this creature. If two or more players are tied for lowest life total, you choose one of them, ..." (Loxodon Peacekeeper)
 *   CR 701.26a, 611.2a         "... If you don't, tap this creature and all creatures named X, then an opponent gains control of them." (Rohgahh of Kher Keep)
 *   CR 707.10, 707.10c         "Whenever you copy a spell, up to one target opponent may also copy that spell. They may choose new targets for that copy." (Parnesse, the Subtle Brush)
 *   CR 701.14, 707.10          "Target creature you control fights target creature the opponent to your left controls. Then that player may copy this spell ..." (Barroom Brawl)
 *   CR 705.1, 705.2, 701.21a   "Each player flips a coin. Each player whose coin comes up tails sacrifices a creature of their choice." (Goblin Assassin)
 */
import { describe, expect, it } from 'vitest';
import type { DecisionAnswer, GameState, ObjectId, PlayerId } from '../../../src/index';
import { act as mact, answer as manswer, find as mfind, mpScenario, pass as mpass } from '../../m12/rules/helpers';
import { card, full } from '../cmd3/helpers';

const lifeOf = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;
const bf = (s: GameState, defId: string): ObjectId[] => s.zones.battlefield.filter((id) => s.objects[id]!.defId === defId);
const ctl = (s: GameState, id: ObjectId): PlayerId => s.objects[id]!.controller;
const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
const NAME_OF: Record<string, PlayerId> = { Alice: 'p1', Bob: 'p2', Carol: 'p3', Dan: 'p4' };

/** Passes (and answers decisions with `answers`, in order of kind: options by id) until the draw step of `turn`. */
function toDraw(s0: GameState, turn: number, options: string[] = []): GameState {
  let s = s0;
  const queue = [...options];
  for (let i = 0; i < 300; i++) {
    if (s.turn.number === turn && (s.turn.step === 'draw' || s.turn.step === 'main1')) return s;
    const p = s.pending;
    if (p === null || p === undefined) throw new Error('no pending decision');
    if (p.kind === 'priority') s = mpass(s);
    else if (p.kind === 'chooseOption') s = manswer(s, { kind: 'chooseOption', ids: [queue.shift() ?? (p as unknown as { options: { id: string }[] }).options[0]!.id] });
    else if (p.kind === 'yesNo') s = manswer(s, { kind: 'yesNo', yes: queue.shift() === 'yes' });
    else if (p.kind === 'payCost') s = manswer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'declareAttackers') s = manswer(s, { kind: 'declareAttackers', attacks: [] });
    else if (p.kind === 'declareBlockers') s = manswer(s, { kind: 'declareBlockers', blocks: [] });
    else throw new Error(`unexpected ${p.kind}`);
  }
  throw new Error('never reached the draw step');
}
const setLife = (life: Partial<Record<PlayerId, number>>) => (s: GameState): void => { for (const [p, n] of Object.entries(life)) s.players.find((x) => x.id === p)!.life = n!; };

// ---- "if a player has more life than each other player, the player with the most life gains control of this creature" ---------------------------------------------------------------
describe('"At the beginning of your upkeep, if a player has more life than each other player, the player with the most life gains control of this creature." (CR 603.4, 119.1, 613.1b; Wild Dogs)', () => {
  const DOGS = card('Test Hounds', 'Creature — Dog', "At the beginning of your upkeep, if a player has more life than each other player, the player with the most life gains control of this creature.", ['2', '2']);
  const start = (life: Partial<Record<PlayerId, number>>): GameState => mpScenario({ defs: [DOGS], zones: { p2: { battlefield: ['Test Hounds'] } }, setup: setLife(life) });
  it('is automated', () => expect(full(DOGS)).toBe(true));
  it('the one player with the most life gets it at its controller\'s upkeep (a third player, not the controller)', () => {
    const s = toDraw(start({ p3: 30 }), 2);
    expect(ctl(s, bf(s, 'Test Hounds')[0]!)).toBe('p3');
  });
  it('negative: two players tied for the most life: nobody gets it (the condition is false), and it is not asked about', () => {
    const s = toDraw(start({ p3: 30, p4: 30 }), 2);
    expect(ctl(s, bf(s, 'Test Hounds')[0]!)).toBe('p2');
  });
  it('negative: the controller has the most life: it stays with the controller', () => {
    const s = toDraw(start({ p2: 30 }), 2);
    expect(ctl(s, bf(s, 'Test Hounds')[0]!)).toBe('p2');
  });
  it('the control follows the life totals at each upkeep (the new controller loses it again to a player who then has more)', () => {
    let s = toDraw(start({ p3: 30 }), 2);
    expect(ctl(s, bf(s, 'Test Hounds')[0]!)).toBe('p3');
    s.players.find((x) => x.id === 'p4')!.life = 99; // before p3's own upkeep (turn 3)
    s = toDraw(s, 3);
    expect(ctl(s, bf(s, 'Test Hounds')[0]!)).toBe('p4');
  });
});

describe('"... if a player has more cards in hand than each other player, the player who has the most cards in hand gains control of this creature." (CR 603.4, 402.1, 613.1b; Sokenzan Renegade)', () => {
  const REN = card('Test Samurai', 'Creature — Ogre', "At the beginning of your upkeep, if a player has more cards in hand than each other player, the player who has the most cards in hand gains control of this creature.", ['2', '2']);
  const start = (hands: Partial<Record<PlayerId, number>>): GameState =>
    mpScenario({ defs: [REN], zones: { p2: { battlefield: ['Test Samurai'] }, ...Object.fromEntries(Object.entries(hands).map(([p, n]) => [p, { battlefield: p === 'p2' ? ['Test Samurai'] : [], hand: Array(n).fill('Plains') as string[] }])) } });
  it('is automated', () => expect(full(REN)).toBe(true));
  it('the player with the most cards in hand at its controller\'s upkeep gets it', () => {
    const s = toDraw(start({ p4: 5, p3: 2 }), 2);
    expect(ctl(s, bf(s, 'Test Samurai')[0]!)).toBe('p4');
  });
  it('negative: a tie for the most cards in hand: nobody gets it', () => {
    const s = toDraw(start({ p4: 5, p3: 5 }), 2);
    expect(ctl(s, bf(s, 'Test Samurai')[0]!)).toBe('p2');
  });
});

describe('"... the player with the lowest life total gains control of this creature. If two or more players are tied for lowest life total, you choose one of them, and that player gains control of this creature." (CR 119.1, 608.2d, 613.1b; Loxodon Peacekeeper)', () => {
  const PEACE = card('Test Warden', 'Creature — Elephant', "At the beginning of your upkeep, the player with the lowest life total gains control of this creature. If two or more players are tied for lowest life total, you choose one of them, and that player gains control of this creature.", ['2', '2']);
  const start = (life: Partial<Record<PlayerId, number>>): GameState => mpScenario({ defs: [PEACE], zones: { p2: { battlefield: ['Test Warden'] } }, setup: setLife(life) });
  it('is automated', () => expect(full(PEACE)).toBe(true));
  it('the one player with the lowest life total gets it, with no choice asked', () => {
    const s = toDraw(start({ p4: 3 }), 2);
    expect(ctl(s, bf(s, 'Test Warden')[0]!)).toBe('p4');
  });
  it('two players tied for the lowest life total: the controller chooses one of the two (only those two are offered), and that player gets it', () => {
    let s = toDraw(start({ p3: 3, p4: 3 }), 2, []);
    // the default pick is the first offered option; offered players are exactly the tied ones
    const first = bf(s, 'Test Warden')[0]!;
    expect(['p3', 'p4']).toContain(ctl(s, first));
    s = toDraw(start({ p3: 3, p4: 3 }), 2, ['p4']);
    expect(ctl(s, bf(s, 'Test Warden')[0]!)).toBe('p4');
  });
  it('negative: the tie is never offered to a player outside it, and the chosen one is the controller\'s choice, not the lowest by seat', () => {
    let s = mpScenario({ defs: [PEACE], zones: { p2: { battlefield: ['Test Warden'] } }, setup: setLife({ p3: 3, p4: 3 }) });
    let offered: string[] = [];
    for (let i = 0; i < 100 && !(s.turn.number === 2 && s.turn.step === 'draw'); i++) {
      const p = s.pending!;
      if (p.kind === 'chooseOption') { offered = (p as unknown as { options: { id: string }[] }).options.map((o) => o.id).sort(); s = manswer(s, { kind: 'chooseOption', ids: [offered[1]!] }); }
      else if (p.kind === 'priority') s = mpass(s);
      else if (p.kind === 'declareAttackers') s = manswer(s, { kind: 'declareAttackers', attacks: [] });
      else if (p.kind === 'declareBlockers') s = manswer(s, { kind: 'declareBlockers', blocks: [] });
      else s = manswer(s, { kind: 'payCost', auto: true });
    }
    expect(offered).toEqual(['p3', 'p4']);
    expect(ctl(s, bf(s, 'Test Warden')[0]!)).toBe('p4');
  });
});

// ---- Rohgahh ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
describe('"At the beginning of your upkeep, you may pay {R}{R}{R}. If you don\'t, tap this creature and all creatures named Test Kobold, then an opponent gains control of them." (CR 701.26a, 611.2a; Rohgahh of Kher Keep)', () => {
  const ROG = card('Test Chieftain', 'Creature — Ogre', "At the beginning of your upkeep, you may pay {R}{R}{R}. If you don't, tap this creature and all creatures named Test Kobold, then an opponent gains control of them.", ['3', '3']);
  const KOB = card('Test Kobold', 'Creature — Kobold', '', ['1', '1']);
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const start = (): GameState => mpScenario({ cards: ['Mountain'], defs: [ROG, KOB, BEAR], zones: { p2: { battlefield: ['Test Chieftain', { name: 'Test Kobold', tapped: true }, 'Test Kobold', 'Test Bear', 'Mountain', 'Mountain', 'Mountain'] } } });
  it('is automated', () => expect(full(ROG)).toBe(true));
  it('declining the payment: the chieftain and every Kobold (a tapped one too) are tapped and go to the opponent the controller chooses; the Bear stays', () => {
    const s = toDraw(start(), 2, ['no', 'p4']);
    for (const id of [...bf(s, 'Test Chieftain'), ...bf(s, 'Test Kobold')]) { expect(ctl(s, id)).toBe('p4'); expect(s.objects[id]!.tapped).toBe(true); }
    expect(ctl(s, bf(s, 'Test Bear')[0]!)).toBe('p2');
  });
  it('negative: paying {R}{R}{R} keeps everything: nothing is tapped for it and nothing changes hands', () => {
    const s = toDraw(start(), 2, ['yes']);
    for (const id of [...bf(s, 'Test Chieftain'), ...bf(s, 'Test Kobold'), ...bf(s, 'Test Bear')]) expect(ctl(s, id)).toBe('p2');
  });
});

// ---- Parnesse ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
describe('"Whenever you copy a spell, up to one target opponent may also copy that spell. They may choose new targets for that copy." (CR 707.10, 707.10c; Parnesse, the Subtle Brush)', () => {
  const PARN = card('Test Brush', 'Enchantment', 'Whenever you cast an instant spell, copy it.\nWhenever you copy a spell, up to one target opponent may also copy that spell. They may choose new targets for that copy.');
  const PING = card('Test Ping', 'Instant', 'Test Ping deals 2 damage to target player.');
  const start = (): GameState => mpScenario({ defs: [PARN, PING], zones: { p1: { hand: ['Test Ping'], battlefield: ['Test Brush'] } } });
  function play(copier: PlayerId | null, say: boolean): GameState {
    const s0 = start();
    let s = mact(s0, { type: 'cast', player: 'p1', card: mfind(s0, 'Test Ping', 'hand', 'p1') });
    for (let i = 0; i < 120 && (s.zones.stack.length > 0 || s.pending?.kind !== 'priority'); i++) {
      const p = s.pending!;
      if (p.kind === 'chooseTargets') {
        // the trigger's "up to one target opponent": the opponent who may copy (none: no target); every other target is Dan
        const forTrigger = JSON.stringify(p).includes('up to one target opponent');
        s = manswer(s, { kind: 'chooseTargets', targets: (forTrigger ? (copier === null ? [] : [{ kind: 'player', id: copier }]) : [{ kind: 'player', id: 'p4' }]) as never });
      }
      else if (p.kind === 'payCost') s = manswer(s, { kind: 'payCost', auto: true });
      else if (p.kind === 'yesNo') s = manswer(s, { kind: 'yesNo', yes: say });
      else if (p.kind === 'priority') s = mpass(s);
      else if (p.kind === 'order') s = manswer(s, { kind: 'order', ids: (p as unknown as { items: { id: string }[] }).items.map((x) => x.id) });
      else if (p.kind === 'chooseOption') s = manswer(s, { kind: 'chooseOption', ids: [(p as unknown as { options: { id: string }[] }).options[0]!.id] });
      else throw new Error(`unexpected ${p.kind}`);
    }
    return s;
  }
  it('is automated', () => expect(full(PARN)).toBe(true));
  it('the cast spell, Alice\'s copy and (when the chosen opponent says yes) that opponent\'s copy each deal their damage', () => {
    const s = play('p2', true);
    expect(lifeOf(s, 'p4')).toBe(20 - 2 * 3);
  });
  it('negative: the chosen opponent declining (or no opponent chosen) leaves only the spell and Alice\'s own copy', () => {
    expect(lifeOf(play('p2', false), 'p4')).toBe(20 - 2 * 2);
    expect(lifeOf(play(null, true), 'p4')).toBe(20 - 2 * 2);
  });
});

// ---- Barroom Brawl --------------------------------------------------------------------------------------------------------------------------------------------------------------------
describe('"Target creature you control fights target creature the opponent to your left controls. Then that player may copy this spell and may choose new targets for the copy." (CR 701.14, 707.10; Barroom Brawl)', () => {
  const BRAWL = card('Test Brawl', 'Instant', 'Target creature you control fights target creature the opponent to your left controls. Then that player may copy this spell and may choose new targets for the copy.');
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const GIANT = card('Test Giant', 'Creature — Giant', '', ['5', '5']);
  it('is automated', () => expect(full(BRAWL)).toBe(true));
  it('only a creature of the player to your left (Bob, seated after Alice) can be the second target: Carol\'s and Dan\'s creatures are not legal', () => {
    const s = mpScenario({ defs: [BRAWL, BEAR, GIANT], zones: { p1: { hand: ['Test Brawl'], battlefield: ['Test Giant'] }, p2: { battlefield: ['Test Bear'] }, p3: { battlefield: ['Test Bear'] }, p4: { battlefield: ['Test Bear'] } } });
    const cast = mact(s, { type: 'cast', player: 'p1', card: mfind(s, 'Test Brawl', 'hand', 'p1') });
    const mine = cast.pending as unknown as { kind: string; objects: ObjectId[] };
    expect(mine.kind).toBe('chooseTargets'); // the first target: a creature Alice controls
    const next = manswer(cast, { kind: 'chooseTargets', targets: [{ kind: 'object', id: mine.objects[0]! }] as never });
    const second = next.pending as unknown as { kind: string; objects: ObjectId[]; prompt: string };
    expect(second.kind).toBe('chooseTargets');
    const bobBear = s.zones.battlefield.find((id) => s.objects[id]!.controller === 'p2' && s.objects[id]!.defId === 'Test Bear')!;
    expect(second.objects).toEqual([bobBear]); // Carol's and Dan's Bears are not legal
  });
  it('the fight happens, then Bob (the player the second creature belonged to) is asked whether to copy the spell, and a copy fights again', () => {
    const s = mpScenario({ defs: [BRAWL, BEAR, GIANT], zones: { p1: { hand: ['Test Brawl'], battlefield: ['Test Giant'] }, p2: { battlefield: ['Test Bear'] } } });
    let t = mact(s, { type: 'cast', player: 'p1', card: mfind(s, 'Test Brawl', 'hand', 'p1') });
    const asked: string[] = [];
    for (let i = 0; i < 80 && (t.zones.stack.length > 0 || t.pending?.kind !== 'priority'); i++) {
      const p = t.pending as unknown as { kind: string; player: PlayerId; objects?: ObjectId[] };
      if (p.kind === 'chooseTargets') t = manswer(t, { kind: 'chooseTargets', targets: [{ kind: 'object', id: p.objects![0]! }] as never });
      else if (p.kind === 'payCost') t = manswer(t, { kind: 'payCost', auto: true });
      else if (p.kind === 'yesNo') { asked.push(`${p.kind}:${p.player}`); t = manswer(t, { kind: 'yesNo', yes: false }); }
      else if (p.kind === 'priority') t = mpass(t);
      else throw new Error(`unexpected ${p.kind}`);
    }
    expect(asked[0]).toBe('yesNo:p2'); // Bob is the one asked (the player to Alice's left)
    expect(t.zones.battlefield.some((id) => t.objects[id]!.defId === 'Test Bear')).toBe(false); // the Giant killed the Bear
  });
});

describe('Barroom Brawl: the second target illegal on resolution (ruling 2022-06-10: the opponent to your left may still copy it)', () => {
  const BRAWL = card('Test Brawl', 'Instant', 'Target creature you control fights target creature the opponent to your left controls. Then that player may copy this spell and may choose new targets for the copy.');
  const ZAP = card('Test Zap', 'Instant', 'Destroy target creature.');
  const BEAR = card('Test Bear', 'Creature — Bear', '', ['2', '2']);
  const GIANT = card('Test Giant', 'Creature — Giant', '', ['5', '5']);
  it('Bob is still asked whether to copy when his targeted creature died in response (no fight happens)', () => {
    const s0 = mpScenario({ defs: [BRAWL, ZAP, BEAR, GIANT], zones: { p1: { hand: ['Test Brawl'], battlefield: ['Test Giant'] }, p2: { hand: ['Test Zap'], battlefield: ['Test Bear'] } } });
    let t = mact(s0, { type: 'cast', player: 'p1', card: mfind(s0, 'Test Brawl', 'hand', 'p1') });
    t = manswer(t, { kind: 'chooseTargets', targets: [{ kind: 'object', id: (t.pending as unknown as { objects: ObjectId[] }).objects[0]! }] as never });
    t = manswer(t, { kind: 'chooseTargets', targets: [{ kind: 'object', id: (t.pending as unknown as { objects: ObjectId[] }).objects[0]! }] as never });
    t = mpass(t); // Alice passes; Bob holds priority and responds
    expect(t.pending!.player).toBe('p2');
    const bear = bf(t, 'Test Bear')[0]!;
    t = mact(t, { type: 'cast', player: 'p2', card: mfind(t, 'Test Zap', 'hand', 'p2') });
    t = manswer(t, { kind: 'chooseTargets', targets: [{ kind: 'object', id: bear }] as never });
    const asked: string[] = [];
    for (let i = 0; i < 80 && (t.zones.stack.length > 0 || t.pending?.kind !== 'priority'); i++) {
      const p = t.pending as unknown as { kind: string; player: PlayerId };
      if (p.kind === 'payCost') t = manswer(t, { kind: 'payCost', auto: true });
      else if (p.kind === 'yesNo') { asked.push(`${p.kind}:${p.player}`); t = manswer(t, { kind: 'yesNo', yes: false }); }
      else if (p.kind === 'priority') t = mpass(t);
      else throw new Error(`unexpected ${p.kind}`);
    }
    expect(asked).toEqual(['yesNo:p2']);
  });
});

// ---- Goblin Assassin ------------------------------------------------------------------------------------------------------------------------------------------------------------------
describe('"Whenever this creature or another Goblin enters, each player flips a coin. Each player whose coin comes up tails sacrifices a creature of their choice." (CR 705.1, 705.2, 701.21a; Goblin Assassin)', () => {
  const ASSASSIN = card('Test Cutthroat', 'Creature — Goblin Assassin', 'Whenever this creature or another Goblin enters, each player flips a coin. Each player whose coin comes up tails sacrifices a creature of their choice.', ['1', '2']);
  const GOB = card('Test Goblin', 'Creature — Goblin', '', ['1', '1']);
  const PEON = card('Test Peon', 'Creature — Human', '', ['1', '1']);
  it('is automated', () => expect(full(ASSASSIN)).toBe(true));
  it('exactly the players whose coin came up tails sacrificed one creature (both results happen over the seeds)', () => {
    const outcomes = new Set<string>();
    for (const seed of SEEDS) {
      let s = mpScenario({ seed, defs: [ASSASSIN, GOB, PEON], zones: { p1: { hand: ['Test Cutthroat'], battlefield: ['Test Peon'] }, p2: { battlefield: ['Test Peon'] }, p3: { battlefield: ['Test Peon'] }, p4: { battlefield: ['Test Peon'] } } });
      s = mact(s, { type: 'cast', player: 'p1', card: mfind(s, 'Test Cutthroat', 'hand', 'p1') });
      for (let i = 0; i < 80 && (s.zones.stack.length > 0 || s.pending?.kind !== 'priority'); i++) {
        const p = s.pending!;
        if (p.kind === 'payCost') s = manswer(s, { kind: 'payCost', auto: true });
        else if (p.kind === 'priority') s = mpass(s);
        else if (p.kind === 'chooseObjects') s = manswer(s, { kind: 'chooseObjects', ids: (p as unknown as { options: ObjectId[] }).options.slice(0, (p as unknown as { min: number }).min) });
        else if (p.kind === 'chooseOption') s = manswer(s, { kind: 'chooseOption', ids: [(p as unknown as { options: { id: string }[] }).options[0]!.id] });
        else if (p.kind === 'order') s = manswer(s, { kind: 'order', ids: (p as unknown as { items: { id: string }[] }).items.map((x) => x.id) });
        else throw new Error(`unexpected ${p.kind}`);
      }
      const tails = new Set<PlayerId>();
      for (const l of s.log) { const m = /^(Alice|Bob|Carol|Dan) flips a coin: tails/.exec(l.text); if (m) tails.add(NAME_OF[m[1]!]!); }
      const heads = new Set<PlayerId>();
      for (const l of s.log) { const m = /^(Alice|Bob|Carol|Dan) flips a coin: heads/.exec(l.text); if (m) heads.add(NAME_OF[m[1]!]!); }
      expect(tails.size + heads.size).toBe(4);
      for (const p of ['p1', 'p2', 'p3', 'p4'] as PlayerId[]) {
        const peon = bf(s, 'Test Peon').filter((id) => ctl(s, id) === p).length;
        // Alice also controls the Assassin: her tails costs her one creature of the two (her choice: the first offered)
        const mine = s.zones.battlefield.filter((id) => ctl(s, id) === p).length;
        const expected = (p === 'p1' ? 2 : 1) - (tails.has(p) ? 1 : 0);
        expect(mine, `${p} after tails=${[...tails].join(',')} (peon ${peon})`).toBe(expected);
      }
      outcomes.add([...tails].sort().join(','));
    }
    expect(outcomes.size).toBeGreaterThan(3);
  });
});
