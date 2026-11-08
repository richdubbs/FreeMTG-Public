/**
 * Round edh-d-110 (Commander coordinator D, groups library 1/3 and 2/3): the new readings played through the engine. The opening-hand reveals use the real fixture cards (Chancellor
 * of the Dross, Providence: their Oracle wordings are the evidence, as edh-d-32's tests do); everything else uses synthetic cards with invented names (design 6.10), compiled by the
 * default compiler. Each test is named after the rule it checks and has its negative case. CR cites checked against MagicCompRules 20260925 (fetched in the cloud session).
 */
import { describe, expect, it } from 'vitest';
import { createGame, type GameConfig, type GameState, type ObjectId } from '../../../src/index';
import { compiledDefs } from '../../fixtures';
import { act, answer, find, pass, scenario } from '../../m3/scenario';
import { attackWith, card, full, pt, resolveAll, settle } from '../cmd3/helpers';

const nameOf = (s: GameState, id: ObjectId): string => s.defs[s.objects[id]!.defId]!.name;
const life = (s: GameState, p: string): number => s.players.find((x) => x.id === p)!.life;
const namesIn = (s: GameState, zone: 'hand' | 'graveyard' | 'library', p = 'p1'): string[] => s.zones[zone][p]!.map((id) => nameOf(s, id));
const lands = (name: string, n: number): string[] => Array(n).fill(name) as string[];

// ---- opening-hand reveals (CR 103.6, 103.6b, 603.7a) -------------------------------------------------------------------------------------------------
function opening(a: string, b = 'Plains'): GameState {
  const config: GameConfig = {
    seed: 'edhd110-reveal',
    players: [
      { name: 'Alice', deck: Array(40).fill(a) as string[], stops: { fullControl: true } },
      { name: 'Bob', deck: Array(40).fill(b) as string[], stops: { fullControl: true } },
    ],
    defs: compiledDefs([a, b, 'Plains']),
    options: { startingPlayer: 'p1', skipMulligans: true },
  };
  return createGame(config);
}
function playUntil(s0: GameState, stop: (s: GameState) => boolean): GameState {
  let s = s0;
  for (let guard = 0; !stop(s) && guard < 80; guard++) s = s.pending?.kind === 'priority' ? pass(s) : settle(s);
  return s;
}
const firstMain = (x: GameState): boolean => x.turn.number === 1 && x.turn.step === 'main1';

describe('Chancellor of the Dross: "each opponent loses 3 life, then you gain life equal to the life lost this way" in the first-upkeep trigger (CR 103.6b, 603.7a, 119.3)', () => {
  it('the cards are fully automated', () => {
    for (const d of compiledDefs(['Chancellor of the Dross', 'Providence'])) expect(full(d), d.name).toBe(true);
  });
  it('CR 119.3, 608.2c: revealed, Bob loses 3 and Alice gains the 3 life Bob lost, once', () => {
    let s = opening('Chancellor of the Dross');
    s = answer(s, { kind: 'chooseObjects', ids: [s.zones.hand.p1![0]!] });
    const [a, b] = [life(s, 'p1'), life(s, 'p2')];
    s = playUntil(s, firstMain);
    expect(life(s, 'p2')).toBe(b - 3);
    expect(life(s, 'p1')).toBe(a + 3);
    s = playUntil(s, (x) => x.turn.number === 3 && x.turn.step === 'main1');
    expect(life(s, 'p2')).toBe(b - 3); // the delayed trigger happens once (CR 603.7b)
  });
  it('two revealed Chancellors: two triggers, each gains what its own loss took (6 and 6)', () => {
    let s = opening('Chancellor of the Dross');
    const [x, y] = s.zones.hand.p1!;
    s = answer(s, { kind: 'chooseObjects', ids: [x!, y!] });
    const [a, b] = [life(s, 'p1'), life(s, 'p2')];
    s = playUntil(s, firstMain);
    expect(life(s, 'p2')).toBe(b - 6);
    expect(life(s, 'p1')).toBe(a + 6);
  });
  it('negative: not revealed, nobody loses or gains life', () => {
    let s = opening('Chancellor of the Dross');
    s = answer(s, { kind: 'chooseObjects', ids: [] });
    const [a, b] = [life(s, 'p1'), life(s, 'p2')];
    s = playUntil(s, firstMain);
    expect([life(s, 'p1'), life(s, 'p2')]).toEqual([a, b]);
  });
});

describe('Providence: the pregame reveal of a sorcery (CR 103.6, 113.6b, 119.5)', () => {
  it('CR 103.6b: the sorcery in the opening hand may be revealed; at the first upkeep the revealer\'s life total becomes 26', () => {
    let s = opening('Providence');
    expect(s.pending).toMatchObject({ kind: 'chooseObjects', player: 'p1', min: 0 });
    s = answer(s, { kind: 'chooseObjects', ids: [s.zones.hand.p1![0]!] });
    s = playUntil(s, firstMain);
    expect(life(s, 'p1')).toBe(26);
    expect(life(s, 'p2')).toBe(20);
  });
  it('negative: not revealed, the life total stays', () => {
    let s = opening('Providence');
    s = answer(s, { kind: 'chooseObjects', ids: [] });
    s = playUntil(s, firstMain);
    expect(life(s, 'p1')).toBe(20);
  });
});

// ---- Goblin Charbelcher (CR 701.20a-b, 120.3, 608.2h, 401.4) --------------------------------------------------------------------------------------------------
const BELCHER = card('Test Fume Engine', 'Artifact', '{3}, {T}: Reveal cards from the top of your library until you reveal a land card. This artifact deals damage equal to the number of nonland cards revealed this way to any target. If the revealed land card was a Mountain, this artifact deals double that damage instead. Put the revealed cards on the bottom of your library in any order.');
const PEBBLE = card('Test Pebble', 'Instant', 'You gain 1 life.');
const STONE = card('Test Stone', 'Sorcery', 'You gain 2 life.');

describe('Goblin Charbelcher: damage for each nonland card revealed until a land, doubled for a Mountain (CR 701.20a, 120.3, 608.2h)', () => {
  const board = (library: string[]): GameState => scenario(['Mountain', 'Forest'], { defs: [BELCHER, PEBBLE, STONE], p1: { battlefield: ['Test Fume Engine', ...lands('Mountain', 3)], library } });
  const fire = (s0: GameState): GameState => {
    const s = settle(act(s0, { type: 'activate', player: 'p1', source: find(s0, 'Test Fume Engine', 'battlefield'), ability: 'p:0:0' }), { targets: [{ kind: 'player', id: 'p2' }] });
    return resolveAll(s, { targets: [{ kind: 'player', id: 'p2' }] });
  };
  it('the synthetic card is fully automated', () => expect(full(BELCHER)).toBe(true));
  it('CR 120.3: two nonland cards, then a Forest: 2 damage to the target; the three revealed cards go to the bottom', () => {
    const s0 = board(['Test Pebble', 'Test Stone', 'Forest', 'Test Pebble']);
    const before = life(s0, 'p2');
    const s = fire(s0);
    expect(life(s, 'p2')).toBe(before - 2);
    const lib = namesIn(s, 'library');
    expect(lib[0]).toBe('Test Pebble'); // the fourth card is now on top
    expect(lib.slice(-3).sort()).toEqual(['Forest', 'Test Pebble', 'Test Stone']);
  });
  it('the land is a Mountain: double that damage (4)', () => {
    const s0 = board(['Test Pebble', 'Test Stone', 'Mountain']);
    const before = life(s0, 'p2');
    expect(life(fire(s0), 'p2')).toBe(before - 4);
  });
  it('negative: the top card is a Mountain: no nonland card, no damage (double 0 is 0)', () => {
    const s0 = board(['Mountain', 'Test Pebble']);
    const before = life(s0, 'p2');
    expect(life(fire(s0), 'p2')).toBe(before);
  });
  it('CR 701.20b: a library with no land card: every card is revealed and counted, nothing doubled', () => {
    let s0 = board(['Test Pebble', 'Test Stone', 'Test Pebble']);
    s0 = { ...s0, zones: { ...s0.zones, library: { ...s0.zones.library, p1: s0.zones.library.p1!.slice(0, 3) } } };
    const before = life(s0, 'p2');
    const s = fire(s0);
    expect(life(s, 'p2')).toBe(before - 3);
    expect(s.zones.library.p1!.length).toBe(3);
  });
});

// ---- Depala's reveal: "reveal the top N cards, put all X and Y cards from among them into your hand, then put the rest on the bottom" (CR 701.20a, 608.2c) ------------------
const SIFT = card('Test Dwarven Sift', 'Sorcery', 'Reveal the top four cards of your library, put all Goblin and Equipment cards from among them into your hand, then put the rest on the bottom of your library in a random order.');
const GOB = card('Test Ash Goblin', 'Creature — Goblin', '', ['1', '1']);
const AXE = card('Test Short Axe', 'Artifact — Equipment', 'Equip {1}');
const ELF = card('Test Elf Scout', 'Creature — Elf', '', ['1', '1']);
describe('Depala, Pilot Exemplar\'s dig: every card of either subtype among the revealed cards (CR 701.20a, 205.3m, 608.2c)', () => {
  it('the Goblin and the Equipment go to the hand; the Elf and the land go to the bottom (negative: neither subtype stays)', () => {
    let s = scenario(['Plains'], { defs: [SIFT, GOB, AXE, ELF], p1: { hand: ['Test Dwarven Sift'], library: ['Test Ash Goblin', 'Test Elf Scout', 'Test Short Axe', 'Plains', 'Test Elf Scout'] } });
    s = resolveAll(settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Dwarven Sift', 'hand') })));
    expect(namesIn(s, 'hand').sort()).toEqual(['Test Ash Goblin', 'Test Short Axe']);
    expect(namesIn(s, 'library')[0]).toBe('Test Elf Scout'); // the fifth card is now on top
    expect(namesIn(s, 'library').slice(-2).sort()).toEqual(['Plains', 'Test Elf Scout']);
  });
});

describe('Depala, Pilot Exemplar: "Each Vehicle you control gets +1/+1 as long as it\'s a creature" (CR 613.4c, 301.7)', () => {
  const PILOT = card('Test Pilot Captain', 'Legendary Creature — Dwarf Pilot', "Each Vehicle you control gets +1/+1 as long as it's a creature.", ['2', '2']);
  const CART = card('Test War Cart', 'Artifact — Vehicle', 'Crew 1', ['3', '3']);
  const WALKER = card('Test Walking Cart', 'Artifact Creature — Vehicle', '', ['3', '3']);
  it('a Vehicle that is a creature gets +1/+1; a Vehicle that is not a creature is not changed (negative), nor an opponent\'s Vehicle creature', () => {
    const s = scenario(['Plains'], { defs: [PILOT, CART, WALKER], p1: { battlefield: ['Test Pilot Captain', 'Test War Cart', 'Test Walking Cart'] }, p2: { battlefield: ['Test Walking Cart'] } });
    expect(pt(s, find(s, 'Test Walking Cart', 'battlefield', 'p1'))).toBe('4/4');
    expect(pt(s, find(s, 'Test Walking Cart', 'battlefield', 'p2'))).toBe('3/3');
    expect(pt(s, find(s, 'Test War Cart', 'battlefield', 'p1'))).toBe('3/3');
  });
});

// ---- An Unearthly Child: until a card of any of three descriptions (CR 701.20a) ------------------------------------------------------------------------------
const CHILD = card('Test Strange Lesson', 'Sorcery', 'Reveal cards from the top of your library until you reveal a Wizard card, a card with flying, or an Equipment card. Put that card into your hand and the rest on the bottom of your library in a random order.');
const BIRD = card('Test Sky Finch', 'Creature — Bird', 'Flying', ['1', '1']);
describe('An Unearthly Child: a reveal until a card of any of three descriptions (CR 701.20a, 608.2c)', () => {
  it('stops at the first card with flying; the cards before it (neither description) go to the bottom', () => {
    let s = scenario(['Plains'], { defs: [CHILD, BIRD, ELF, AXE], p1: { hand: ['Test Strange Lesson'], library: ['Test Elf Scout', 'Plains', 'Test Sky Finch', 'Test Short Axe'] } });
    s = resolveAll(settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Strange Lesson', 'hand') })));
    expect(namesIn(s, 'hand')).toEqual(['Test Sky Finch']);
    expect(namesIn(s, 'library')[0]).toBe('Test Short Axe'); // negative: the Equipment after it is not revealed
    expect(namesIn(s, 'library').slice(-2).sort()).toEqual(['Plains', 'Test Elf Scout']);
  });
});

// ---- hand reveals and choices (CR 701.20a, 701.9a, 614.15) -----------------------------------------------------------------------------------------------
const WHACK = card('Test Head Knock', 'Sorcery', 'Target player reveals three cards from their hand. You choose two of them. That player discards those cards.');
const DISCOVERY = card('Test Grim Find', 'Sorcery', 'Target player discards two cards. If a creature died this turn, instead that player reveals their hand, you choose two cards from it, then that player discards those cards.');
const CULL = card('Test Cull', 'Instant', 'Destroy target creature.');
const P2: { kind: 'player'; id: string } = { kind: 'player', id: 'p2' };

describe('Noggin Whack: the target player reveals three cards of their choice, you choose two of them (CR 701.20a, 608.2d)', () => {
  it('Bob chooses the three cards to reveal, Alice chooses two of them, Bob discards those two (negative: the fourth card stays)', () => {
    let s = scenario(['Plains'], { defs: [WHACK, PEBBLE, STONE, ELF, GOB], p1: { hand: ['Test Head Knock'] }, p2: { hand: ['Test Pebble', 'Test Stone', 'Test Elf Scout', 'Test Ash Goblin'] } });
    s = act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Head Knock', 'hand') });
    s = settle(s, { targets: [P2] });
    for (let g = 0; g < 10 && !(s.pending?.kind === 'chooseObjects'); g++) s = s.pending?.kind === 'priority' ? pass(s) : settle(s, { targets: [P2] });
    expect(s.pending).toMatchObject({ kind: 'chooseObjects', player: 'p2', min: 3, max: 3 });
    const hand = s.zones.hand.p2!;
    const shown = [hand[0]!, hand[1]!, hand[2]!];
    const [n0, n1, n2, n3] = hand.map((id) => nameOf(s, id)); // (an object that changes zones is a new object, CR 400.7: names are compared)
    s = answer(s, { kind: 'chooseObjects', ids: shown });
    expect(s.pending).toMatchObject({ kind: 'chooseObjects', player: 'p1', min: 2, max: 2 });
    expect([...(s.pending as { options: ObjectId[] }).options].sort()).toEqual([...shown].sort());
    s = answer(s, { kind: 'chooseObjects', ids: [shown[0]!, shown[2]!] });
    s = resolveAll(s);
    expect(namesIn(s, 'graveyard', 'p2').sort()).toEqual([n0!, n2!].sort());
    expect(namesIn(s, 'hand', 'p2').sort()).toEqual([n1!, n3!].sort());
  });
});

describe('Noggin Whack ruling 2008-04-01: fewer than three cards in hand', () => {
  it('a hand of one card: that card is revealed, chosen and discarded (CR 701.20a, 608.2d)', () => {
    let s = scenario(['Plains'], { defs: [WHACK, PEBBLE], p1: { hand: ['Test Head Knock'] }, p2: { hand: ['Test Pebble'] } });
    s = settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Head Knock', 'hand') }), { targets: [P2] });
    s = resolveAll(s, { targets: [P2] });
    expect(namesIn(s, 'hand', 'p2')).toEqual([]);
    expect(namesIn(s, 'graveyard', 'p2')).toEqual(['Test Pebble']);
  });
});

describe('Gruesome Discovery: the discard replaced by a reveal and your choice once a creature died (CR 614.15, 701.9a, 700.4)', () => {
  const board = (): GameState => scenario(['Plains'], { defs: [DISCOVERY, CULL, PEBBLE, STONE, ELF, GOB], p1: { hand: ['Test Grim Find', 'Test Cull'] }, p2: { hand: ['Test Pebble', 'Test Stone', 'Test Elf Scout'], battlefield: ['Test Ash Goblin'] } });
  const castFind = (s0: GameState): GameState => {
    let s = settle(act(s0, { type: 'cast', player: 'p1', card: find(s0, 'Test Grim Find', 'hand') }), { targets: [P2] });
    for (let g = 0; g < 10 && !(s.pending?.kind === 'chooseObjects'); g++) s = s.pending?.kind === 'priority' ? pass(s) : settle(s, { targets: [P2] });
    return s;
  };
  it('negative: no creature died this turn: Bob discards two cards of his own choice', () => {
    const s = castFind(board());
    expect(s.pending).toMatchObject({ kind: 'chooseObjects', player: 'p2' });
  });
  it('a creature died this turn: Bob reveals his hand, Alice chooses two cards and Bob discards exactly those', () => {
    let s = board();
    s = settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Cull', 'hand') }), { targets: [{ kind: 'object', id: find(s, 'Test Ash Goblin', 'battlefield', 'p2') }] });
    s = resolveAll(s, { targets: [{ kind: 'object', id: find(s, 'Test Ash Goblin', 'battlefield', 'p2') }] });
    s = castFind(s);
    expect(s.pending).toMatchObject({ kind: 'chooseObjects', player: 'p1', min: 2, max: 2 });
    const elf = find(s, 'Test Elf Scout', 'hand', 'p2');
    const stone = find(s, 'Test Stone', 'hand', 'p2');
    s = resolveAll(answer(s, { kind: 'chooseObjects', ids: [elf, stone] }));
    expect(namesIn(s, 'hand', 'p2')).toEqual(['Test Pebble']);
  });
});

// ---- Sages of the Anima: the draw replaced by a reveal (CR 614.1a, 614.6, 121.1) -------------------------------------------------------------------------------
const SAGES = card('Test Anima Sage', 'Creature — Elf Wizard', 'If you would draw a card, instead reveal the top three cards of your library. Put all creature cards revealed this way into your hand and the rest on the bottom of your library in any order.', ['3', '4']);
const DRAW = card('Test Quick Study', 'Instant', 'Draw a card.');
describe('Sages of the Anima: a draw replaced by a reveal of three cards, the creature cards to the hand (CR 614.1a, 614.6)', () => {
  it('the Goblin and the Elf go to the hand, the Pebble to the bottom; no card is drawn', () => {
    let s = scenario(['Plains'], { defs: [SAGES, DRAW, GOB, ELF, PEBBLE], p1: { hand: ['Test Quick Study'], battlefield: ['Test Anima Sage'], library: ['Test Ash Goblin', 'Test Pebble', 'Test Elf Scout', 'Plains'] } });
    s = resolveAll(settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Quick Study', 'hand') })));
    expect(namesIn(s, 'hand').sort()).toEqual(['Test Ash Goblin', 'Test Elf Scout']);
    expect(namesIn(s, 'library')[0]).toBe('Plains');
    expect(namesIn(s, 'library').at(-1)).toBe('Test Pebble');
  });
  it('negative: without the Sage the draw is a draw', () => {
    let s = scenario(['Plains'], { defs: [DRAW, GOB, PEBBLE], p1: { hand: ['Test Quick Study'], library: ['Test Pebble', 'Test Ash Goblin'] } });
    s = resolveAll(settle(act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Quick Study', 'hand') })));
    expect(namesIn(s, 'hand')).toEqual(['Test Pebble']);
  });
});

// ---- Woodvine Elemental: a pump counted once over the revealed cards (CR 608.2h, 611.2c) -----------------------------------------------------------------------
const WOODVINE = card('Test Vine Walker', 'Creature — Elemental', 'Whenever this creature attacks, each player reveals the top card of their library. For each nonland card revealed this way, attacking creatures you control get +1/+1 until end of turn. Then each player draws a card.', ['4', '4']);
describe('Woodvine Elemental: +1/+1 for each nonland card revealed, counted as the ability resolves (CR 608.2h, 611.2c, 613.4c)', () => {
  it('Alice reveals a nonland card, Bob a land: +1/+1 to her attacker; it stays +1/+1 after both draw the revealed cards', () => {
    let s = scenario(['Plains'], { defs: [WOODVINE, PEBBLE], p1: { battlefield: ['Test Vine Walker'], library: ['Test Pebble'] }, p2: { library: ['Plains'] } });
    const id = find(s, 'Test Vine Walker', 'battlefield');
    s = attackWith(s, [id]);
    s = resolveAll(s);
    expect(pt(s, id)).toBe('5/5');
    expect(namesIn(s, 'hand')).toContain('Test Pebble'); // drawn: the count was fixed before
  });
  it('negative: both reveal lands: no bonus', () => {
    let s = scenario(['Plains'], { defs: [WOODVINE], p1: { battlefield: ['Test Vine Walker'], library: ['Plains'] }, p2: { library: ['Plains'] } });
    const id = find(s, 'Test Vine Walker', 'battlefield');
    s = resolveAll(attackWith(s, [id]));
    expect(pt(s, id)).toBe('4/4');
  });
});
