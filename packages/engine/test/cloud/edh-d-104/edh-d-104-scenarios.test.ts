/**
 * edh-d-104 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups exile-play, players-life, sacrifice-destroy, rest 2/2): the round's readings played through the engine with
 * synthetic cards compiled by the game's default compiler (invented names and wordings, design 6.10), in four-player games. Each test is named after the rule it checks, with its
 * negative case. CR cites checked against the Comprehensive Rules of 2026-09-25 (media.wizards.com MagicCompRules 20260925.txt).
 */
import { describe, expect, it } from 'vitest';
import { compileCard, getChars, listLegalActions, type CardDef, type GameState, type PlayerId, type TargetChoice } from '../../../src/index';
import { act, answer, find } from '../../m3/scenario';
import { mpScenario, passUntil } from '../../m12/rules/helpers';

function card(name: string, type: string, text: string, opts: { cost?: string; pt?: [string, string]; colors?: string[] } = {}): CardDef {
  return compileCard({ name, layout: 'normal', mana_cost: opts.cost ?? '{0}', type_line: type, oracle_text: text, colors: opts.colors ?? [], keywords: [], ...(opts.pt ? { power: opts.pt[0], toughness: opts.pt[1] } : {}) } as never);
}
const full = (d: CardDef): boolean => d.automation.level === 'full' && !JSON.stringify(d.faces).includes('"op":"manual"') && d.faces.every((f) => f.abilities.every((a) => a.kind !== 'manual'));
const pl = (id: PlayerId): TargetChoice => ({ kind: 'player', id }) as TargetChoice;
const obj = (id: string): TargetChoice => ({ kind: 'object', id }) as TargetChoice;
const lifeOf = (s: GameState, p: PlayerId): number => s.players.find((x) => x.id === p)!.life;
const nameOf = (s: GameState, id: string): string => s.defs[s.objects[id]!.defId]!.name;
const names = (s: GameState, ids: readonly string[]): string[] => ids.map((id) => nameOf(s, id)).sort();
const exileOf = (s: GameState, p: PlayerId): string[] => names(s, s.zones.exile.filter((id) => s.objects[id]!.owner === p));
const handOf = (s: GameState, p: PlayerId): string[] => names(s, s.zones.hand[p]!).filter((n) => n !== 'Plains');
const bf = (s: GameState, n: string): string | undefined => s.zones.battlefield.find((x) => nameOf(s, x) === n);

interface Script { yes?: boolean[]; targets?: TargetChoice[][]; options?: string[][]; objects?: (string[] | ((options: string[], s: GameState) => string[]))[] }
/** Answer the decisions that come up until someone has priority. */
function drive(s0: GameState, script: Script = {}): GameState {
  let s = s0;
  for (let guard = 0; guard < 100 && s.pending && s.pending.kind !== 'priority'; guard++) {
    const p = s.pending;
    if (p.kind === 'yesNo') s = answer(s, { kind: 'yesNo', yes: script.yes?.shift() ?? false });
    else if (p.kind === 'payCost') s = answer(s, { kind: 'payCost', auto: true });
    else if (p.kind === 'chooseTargets') s = answer(s, { kind: 'chooseTargets', targets: script.targets?.shift() ?? [] });
    else if (p.kind === 'chooseOption') s = answer(s, { kind: 'chooseOption', ids: script.options?.shift() ?? p.options.slice(0, p.min).map((o) => o.id) });
    else if (p.kind === 'chooseObjects') { const pick = script.objects?.shift(); s = answer(s, { kind: 'chooseObjects', ids: typeof pick === 'function' ? pick(p.options as string[], s) : pick ?? (p.options as string[]).slice(0, p.min) }); }
    else if (p.kind === 'order') s = answer(s, { kind: 'order', ids: p.items.map((i) => i.id) });
    else if (p.kind === 'declareAttackers') s = answer(s, { kind: 'declareAttackers', attacks: [] });
    else if (p.kind === 'declareBlockers') s = answer(s, { kind: 'declareBlockers', blocks: [] });
    else throw new Error(`unexpected decision ${p.kind}: ${JSON.stringify(p)}`);
  }
  return s;
}
/** Everyone passes until the stack is empty again, answering what comes up. */
function settle(s0: GameState, script: Script = {}): GameState {
  let s = drive(s0, script);
  for (let guard = 0; s.zones.stack.length > 0 && s.pending?.kind === 'priority' && guard < 60; guard++) s = drive(act(s, { type: 'pass', player: s.pending.player }), script);
  return s;
}
const cast = (s: GameState, name: string, script: Script = {}, player: PlayerId = 'p1'): GameState => settle(drive(act(s, { type: 'cast', player, card: find(s, name, 'hand', player) }), script), script);
/** The options of a choice whose card has this name. */
const named = (n: string) => (options: string[], s: GameState): string[] => options.filter((id) => nameOf(s, id) === n).slice(0, 1);
void pl; void obj; void passUntil;

// ---- Widespread Thieving: "Whenever you cast a multicolored spell, create a Treasure token. Then you may pay {W}{U}{B}{R}{G}. If you do, you may play the exiled card ..." ----

const LARCENY = card('Test Hidden Larceny', 'Enchantment', 'Hideaway 3\nWhenever you cast a multicolored spell, create a Treasure token. Then you may pay {W}{W}. If you do, you may play the exiled card without paying its mana cost.');
const GOLD = card('Test Gold Charm', 'Instant', 'You gain 1 life.', { colors: ['W', 'U'] });
const MONO = card('Test White Charm', 'Instant', 'You gain 1 life.', { colors: ['W'] });
const HIDDEN = card('Test Hidden Bolt', 'Sorcery', 'You gain 5 life.', { cost: '{7}' });

describe('CR 702.75a, 607.2a, 118.9 (Widespread Thieving): after the payment, "you may play the exiled card without paying its mana cost" plays the card hideaway exiled', () => {
  const setup = (): GameState => {
    const s0 = mpScenario({ defs: [LARCENY, GOLD, MONO, HIDDEN], zones: { p1: { hand: ['Test Hidden Larceny', 'Test Gold Charm', 'Test White Charm'], library: ['Plains', 'Test Hidden Bolt', 'Plains', 'Plains'], battlefield: ['Plains', 'Plains'] } } });
    return cast(s0, 'Test Hidden Larceny', { objects: [named('Test Hidden Bolt')] });
  };
  it('is automated', () => expect(full(LARCENY)).toBe(true));
  it('hideaway exiles the chosen card face down, linked to the enchantment', () => {
    const s = setup();
    expect(exileOf(s, 'p1')).toEqual(['Test Hidden Bolt']);
  });
  it('a multicolored spell: a Treasure, then the payment, then the free play of the exiled card (it leaves exile and resolves)', () => {
    const s = cast(setup(), 'Test Gold Charm', { yes: [true, true] });
    expect(exileOf(s, 'p1')).toEqual([]);
    expect(lifeOf(s, 'p1')).toBe(26); // 1 + 5 (the Treasure may pay part of the cost: ruling 2022-04-29)
  });
  it('the payment declined: the exiled card stays in exile (the negative case)', () => {
    const s = cast(setup(), 'Test Gold Charm', { yes: [false] });
    expect(exileOf(s, 'p1')).toEqual(['Test Hidden Bolt']);
    expect(lifeOf(s, 'p1')).toBe(21);
    expect(s.zones.battlefield.filter((x) => nameOf(s, x).startsWith('Treasure')).length).toBe(1);
  });
  it('a one-colored spell triggers nothing (no Treasure, the card stays exiled)', () => {
    const s = cast(setup(), 'Test White Charm', { yes: [true, true] });
    expect(exileOf(s, 'p1')).toEqual(['Test Hidden Bolt']);
    expect(s.zones.battlefield.filter((x) => nameOf(s, x).startsWith('Treasure')).length).toBe(0);
  });
});

const activate = (s: GameState, source: string, script: Script = {}, ability = 'p:0:0'): GameState => settle(drive(act(s, { type: 'activate', player: 'p1', source: bf(s, source)!, ability } as never), script), script);
const castable = (s: GameState, id: string, p: PlayerId = 'p1'): boolean => listLegalActions(s, p).some((a) => (a.kind === 'cast' || a.kind === 'playLand') && ((a as { card?: string }).card === id || (a as { object?: string }).object === id));
const exiledId = (s: GameState, n: string): string => s.zones.exile.find((x) => nameOf(s, x) === n)!;
/** p1's next turn, at the step `step` (after the turn of every other player). */
const nextTurnAt = (s: GameState, step: string): GameState => {
  const turn = s.turn.number;
  return passUntil(act(s, { type: 'pass', player: s.pending!.player }), (t) => t.turn.activePlayer === 'p1' && t.turn.number > turn && t.turn.step === step && t.pending?.kind === 'priority', `p1's next ${step}`);
};

// ---- Fires of Mount Doom: "Exile the top card of your library. You may play that card this turn. When you play a card this way, ~ deals 2 damage to each player." ----

const FORGE = card('Test Ember Forge', 'Artifact', '{T}: Exile the top card of your library. You may play that card this turn. When you play a card this way, this artifact deals 2 damage to each player.');
const ROCK = card('Test Ember Rock', 'Land', '');
const SPARKLE = card('Test Ember Sparkle', 'Instant', 'You gain 1 life.');

describe('CR 603.7a, 305.1, 601.2i (Fires of Mount Doom): "When you play a card this way" triggers for a land played and for a spell cast with that permission, and for nothing else', () => {
  const setup = (top: string): GameState => activate(mpScenario({ defs: [FORGE, ROCK, SPARKLE], zones: { p1: { battlefield: ['Test Ember Forge'], library: ['Plains', top], hand: ['Test Ember Rock', 'Test Ember Sparkle'] } } }), 'Test Ember Forge');
  it('is automated', () => expect(full(FORGE)).toBe(true));
  it('a land exiled this way and played: the land is on the battlefield and each player is dealt 2 damage (a land play is no cast, CR 305.1)', () => {
    const s0 = setup('Test Ember Rock');
    expect(exileOf(s0, 'p1')).toEqual(['Test Ember Rock']);
    const s = settle(act(s0, { type: 'playLand', player: 'p1', card: exiledId(s0, 'Test Ember Rock') } as never));
    expect(bf(s, 'Test Ember Rock')).toBeDefined();
    for (const p of ['p1', 'p2', 'p3', 'p4'] as const) expect(lifeOf(s, p)).toBe(18);
  });
  it('a spell exiled this way and cast: it resolves and each player is dealt 2 damage', () => {
    const s0 = setup('Test Ember Sparkle');
    const s = settle(act(s0, { type: 'cast', player: 'p1', card: exiledId(s0, 'Test Ember Sparkle') }));
    expect(lifeOf(s, 'p1')).toBe(19); // 20 + 1 - 2
    for (const p of ['p2', 'p3', 'p4'] as const) expect(lifeOf(s, p)).toBe(18);
  });
  it('a land played from the hand, and a spell cast from the hand, trigger nothing (the negative case)', () => {
    const s0 = setup('Test Ember Sparkle');
    const s1 = settle(act(s0, { type: 'playLand', player: 'p1', card: find(s0, 'Test Ember Rock', 'hand', 'p1') } as never));
    const s = cast(s1, 'Test Ember Sparkle');
    expect(lifeOf(s, 'p1')).toBe(21);
    for (const p of ['p2', 'p3', 'p4'] as const) expect(lifeOf(s, p)).toBe(20);
  });
});

// ---- Daredevil, Fearless Fighter: "exile the top card of your library. ~ deals damage to you equal to that card's mana value. You may play it this turn." ----

const SCOUT = card('Test Daring Scout', 'Creature — Human', "{T}: Exile the top card of your library. This creature deals damage to you equal to that card's mana value. You may play it this turn.", { pt: ['2', '2'] });
const HEAVY = card('Test Heavy Tome', 'Sorcery', 'You gain 4 life.', { cost: '{3}' });

describe('CR 305.1, 601.2a, 608.2c (Daredevil, Fearless Fighter): "you may play it" after a sentence that names ~ is the exiled card, never the permanent itself', () => {
  it('is automated', () => expect(full(SCOUT)).toBe(true));
  it('the exiled card deals its mana value as damage from ~ to you, and that card (not ~) may be cast this turn', () => {
    const s = activate(mpScenario({ defs: [SCOUT, HEAVY], zones: { p1: { battlefield: ['Test Daring Scout', 'Plains', 'Plains', 'Plains'], library: ['Plains', 'Test Heavy Tome'] } } }), 'Test Daring Scout');
    expect(lifeOf(s, 'p1')).toBe(17);
    const tome = exiledId(s, 'Test Heavy Tome');
    expect(castable(s, tome)).toBe(true);
    const t = settle(act(s, { type: 'cast', player: 'p1', card: tome }));
    expect(lifeOf(t, 'p1')).toBe(21);
  });
  it('the permission ends with the turn: on the next turn the card can no longer be cast (the negative case)', () => {
    const s = activate(mpScenario({ defs: [SCOUT, HEAVY], zones: { p1: { battlefield: ['Test Daring Scout', 'Plains', 'Plains', 'Plains'], library: ['Plains', 'Test Heavy Tome'] } } }), 'Test Daring Scout');
    const t = nextTurnAt(s, 'main1');
    expect(castable(t, exiledId(t, 'Test Heavy Tome'))).toBe(false);
  });
});

// ---- Pulse of the Forge: "deals 4 damage to target player or planeswalker. Then if that player or that planeswalker's controller has more life than you, return ~ to its owner's hand." ----

const PULSE = card('Test Pulse Flare', 'Instant', "This spell deals 4 damage to target player or planeswalker. Then if that player or that planeswalker's controller has more life than you, return this spell to its owner's hand.");
const WALKER = card('Test Pulse Walker', 'Legendary Planeswalker — Testa', '+1: You gain 1 life.');

describe("CR 115.1, 109.4, 608.2c (Pulse of the Forge): \"that player or that planeswalker's controller\" is the targeted player, or the controller of the targeted planeswalker", () => {
  it('is automated', () => expect(full(PULSE)).toBe(true));
  it('a target player with more life than you after the damage: the spell returns to its owner\'s hand', () => {
    const s = cast(mpScenario({ defs: [PULSE], life: 30, zones: { p1: { hand: ['Test Pulse Flare'] } }, setup: (x) => { x.players.find((p) => p.id === 'p1')!.life = 20; } }), 'Test Pulse Flare', { targets: [[pl('p2')]] });
    expect(lifeOf(s, 'p2')).toBe(26);
    expect(handOf(s, 'p1')).toEqual(['Test Pulse Flare']);
  });
  it('a target player with no more life than you after the damage: the spell goes to the graveyard (the negative case)', () => {
    const s = cast(mpScenario({ defs: [PULSE], zones: { p1: { hand: ['Test Pulse Flare'] } }, setup: (x) => { x.players.find((p) => p.id === 'p2')!.life = 24; } }), 'Test Pulse Flare', { targets: [[pl('p2')]] });
    expect(lifeOf(s, 'p2')).toBe(20);
    expect(handOf(s, 'p1')).toEqual([]);
  });
  it("a target planeswalker: its controller's life is compared (more life than you: back to the hand; the same life: not)", () => {
    const go = (oppLife: number): GameState => {
      const s0 = mpScenario({ defs: [PULSE, WALKER], zones: { p1: { hand: ['Test Pulse Flare'] }, p3: { battlefield: [{ name: 'Test Pulse Walker', counters: { loyalty: 6 } }] } }, setup: (x) => { x.players.find((p) => p.id === 'p3')!.life = oppLife; } });
      return cast(s0, 'Test Pulse Flare', { targets: [[obj(bf(s0, 'Test Pulse Walker')!)]] });
    };
    const more = go(25);
    expect(more.objects[bf(more, 'Test Pulse Walker')!]!.counters.loyalty).toBe(2);
    expect(handOf(more, 'p1')).toEqual(['Test Pulse Flare']);
    expect(handOf(go(20), 'p1')).toEqual([]);
  });
});

// ---- Heaven Sent: "III -- This Saga deals 1 damage to each opponent. Then if an opponent has 0 or less life, draw seven cards. Otherwise, exile this Saga and you may cast it this turn." ----

const SENT = card('Test Sky Sent', 'Enchantment — Saga', '(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)\nI, II — You gain 1 life.\nIII — This Saga deals 1 damage to each opponent. Then if an opponent has 0 or less life, draw seven cards. Otherwise, exile this Saga and you may cast it this turn.');

describe('CR 608.2c, 400.7, 714.4 (Heaven Sent): "Otherwise, exile this Saga and you may cast it this turn": "it" is the card the same sentence exiled', () => {
  // the scenario starts before p1's first precombat main phase: the Saga with two lore counters gets its third after the draw step, and chapter III triggers then
  const chapterThree = (life: number): GameState => settle(mpScenario({ defs: [SENT], zones: { p1: { battlefield: [{ name: 'Test Sky Sent', counters: { lore: 2 } }] } }, setup: (x) => { x.players.find((p) => p.id === 'p4')!.life = life; } }));
  it('is automated', () => expect(full(SENT)).toBe(true));
  it('no opponent at 0 or less life: the Saga is exiled (not sacrificed) and its owner may cast it from exile this turn', () => {
    const s = chapterThree(20);
    expect(lifeOf(s, 'p2')).toBe(19);
    expect(exileOf(s, 'p1')).toEqual(['Test Sky Sent']);
    expect(castable(s, exiledId(s, 'Test Sky Sent'))).toBe(true);
    const t = nextTurnAt(s, 'main1');
    expect(castable(t, exiledId(t, 'Test Sky Sent'))).toBe(false); // "this turn" only
  });
  it('an opponent at 0 or less life after the damage: seven cards are drawn and the Saga is not exiled (the negative case)', () => {
    const s = chapterThree(1);
    expect(exileOf(s, 'p1')).toEqual([]);
    expect(s.zones.hand.p1!.length).toBe(8); // the draw step's card and seven more
    expect(lifeOf(s, 'p4')).toBe(0);
  });
});

// ---- Moonring Mirror: "you may exile all cards from your hand face down. If you do, put all other cards you own exiled with this artifact into your hand." ----

const MIRROR = card('Test Moon Mirror', 'Artifact', 'Whenever you draw a card, exile the top card of your library face down.\nAt the beginning of your upkeep, you may exile all cards from your hand face down. If you do, put all other cards you own exiled with this artifact into your hand.');
const QUILL = card('Test Quill', 'Sorcery', 'Draw a card.');
const KEEP = card('Test Keepsake', 'Instant', 'You gain 1 life.');
const AWAY = card('Test Away Card', 'Instant', 'You gain 2 life.');

describe('CR 607.2a, 406.3 (Moonring Mirror): the cards both abilities exiled are "exiled with this artifact"; "other" leaves out the cards just exiled from the hand', () => {
  const setup = (): GameState => cast(mpScenario({ defs: [MIRROR, QUILL, KEEP, AWAY], zones: { p1: { battlefield: ['Test Moon Mirror'], hand: ['Test Quill', 'Test Keepsake'], library: ['Plains', 'Plains', 'Plains', 'Test Away Card'] } } }), 'Test Quill');
  it('is automated', () => expect(full(MIRROR)).toBe(true));
  it('a draw exiles the top card face down', () => {
    const s = setup(); // the draw step's draw exiled a Plains, the Quill's draw the Away Card
    expect(exileOf(s, 'p1')).toEqual(['Plains', 'Test Away Card']);
    expect(s.objects[exiledId(s, 'Test Away Card')]!.faceDown).toBe(true);
  });
  it('at the upkeep, yes: the hand is exiled face down and the card the draw trigger exiled comes back to the hand; the cards just exiled stay exiled (ruling 2004-12-01)', () => {
    const turn = setup().turn.number;
    const s = passUntil(act(setup(), { type: 'pass', player: 'p1' }), (t) => t.turn.activePlayer === 'p1' && t.turn.number > turn && t.pending?.kind === 'yesNo', "p1's upkeep choice");
    const t = drive(s, { yes: [true] });
    expect(handOf(t, 'p1')).toEqual(['Test Away Card']);
    expect(exileOf(t, 'p1')).toContain('Test Keepsake');
  });
  it('at the upkeep, no: nothing moves (the negative case)', () => {
    const turn = setup().turn.number;
    const s = passUntil(act(setup(), { type: 'pass', player: 'p1' }), (t) => t.turn.activePlayer === 'p1' && t.turn.number > turn && t.pending?.kind === 'yesNo', "p1's upkeep choice");
    const t = drive(s, { yes: [false] });
    expect(handOf(t, 'p1')).toEqual(['Test Keepsake']);
    expect(exileOf(t, 'p1')).toEqual(['Plains', 'Test Away Card']);
  });
});

// ---- Jadzi, Oracle of Arcavios: "reveal the top card of your library. If it's a nonland card, you may cast it by paying {1} rather than paying its mana cost. If it's a land card, put it onto the battlefield." ----

const ORACLE = card('Test Arcane Oracle', 'Creature — Human Wizard', "Whenever you cast an instant or sorcery spell, reveal the top card of your library. If it's a nonland card, you may cast it by paying {1} rather than paying its mana cost. If it's a land card, put it onto the battlefield.", { pt: ['1', '1'] });
const BIG = card('Test Big Beast', 'Creature — Beast', '', { cost: '{6}{W}', pt: ['6', '6'] });
const SPELL = card('Test Small Spell', 'Instant', 'You gain 1 life.');

describe('CR 118.9, 601.2b, 608.2g (Jadzi, Oracle of Arcavios): the revealed nonland card may be cast for the alternative cost {1}; a land is put onto the battlefield', () => {
  const setup = (top: string): GameState => mpScenario({ defs: [ORACLE, BIG, SPELL, ROCK], zones: { p1: { battlefield: ['Test Arcane Oracle', 'Plains'], hand: ['Test Small Spell'], library: ['Plains', top] } } });
  it('is automated', () => expect(full(ORACLE)).toBe(true));
  it('a nonland card, cast: paid with {1} (one Plains) and it resolves', () => {
    const s = cast(setup('Test Big Beast'), 'Test Small Spell', { yes: [true] });
    expect(bf(s, 'Test Big Beast')).toBeDefined();
  });
  it('a nonland card, not cast: it stays on top of the library (ruling 2021-04-16; the negative case)', () => {
    const s = cast(setup('Test Big Beast'), 'Test Small Spell', { yes: [false] });
    expect(bf(s, 'Test Big Beast')).toBeUndefined();
    expect(nameOf(s, s.zones.library.p1![0]!)).toBe('Test Big Beast');
  });
  it('a land card: onto the battlefield (not a land play)', () => {
    const s = cast(setup('Test Ember Rock'), 'Test Small Spell');
    expect(bf(s, 'Test Ember Rock')).toBeDefined();
    expect(s.players.find((p) => p.id === 'p1')!.landsPlayedThisTurn).toBe(0);
  });
});

// ---- Brazen Cannonade: "Until end of combat on your next turn, you may play that card." ----

const CANNON = card('Test Raid Cannon', 'Enchantment', 'At the beginning of your end step, exile the top card of your library. Until end of combat on your next turn, you may play that card.');
const QUICK = card('Test Quick Mend', 'Instant', 'You gain 3 life.');

describe('CR 611.2a, 500.5a (Brazen Cannonade): "until end of combat on your next turn" lasts through the other players\' turns and the start of your next turn, and ends with its first combat', () => {
  const setup = (): GameState => {
    const s0 = mpScenario({ defs: [CANNON, QUICK], zones: { p1: { battlefield: ['Test Raid Cannon'], library: ['Plains', 'Test Quick Mend'] } } });
    return passUntil(act(s0, { type: 'pass', player: 'p1' }), (t) => t.turn.activePlayer === 'p2' && t.turn.step === 'main1' && t.pending?.kind === 'priority', "p2's main phase");
  };
  it('is automated', () => expect(full(CANNON)).toBe(true));
  it('during another player\'s turn and in your next turn before combat the card may be played', () => {
    const s = setup();
    expect(exileOf(s, 'p1')).toEqual(['Test Quick Mend']);
    expect(castable(s, exiledId(s, 'Test Quick Mend'))).toBe(true);
    const t = nextTurnAt(s, 'main1');
    expect(castable(t, exiledId(t, 'Test Quick Mend'))).toBe(true);
  });
  it('after the combat phase of your next turn it can no longer be played (the negative case)', () => {
    const t = nextTurnAt(setup(), 'main2');
    expect(castable(t, exiledId(t, 'Test Quick Mend'))).toBe(false);
  });
});

// ---- Cosmic Horror: "destroy this creature unless you pay {3}{B}{B}{B}. If this creature is destroyed this way, it deals 7 damage to you." ----

const HORROR = card('Test Void Horror', 'Creature — Horror', 'At the beginning of your upkeep, destroy this creature unless you pay {W}. If this creature is destroyed this way, it deals 7 damage to you.', { pt: ['7', '7'] });
const HARD = card('Test Hard Horror', 'Creature — Horror', 'Indestructible\nAt the beginning of your upkeep, destroy this creature unless you pay {W}. If this creature is destroyed this way, it deals 7 damage to you.', { pt: ['7', '7'] });

describe('CR 701.8a, 608.2c, 702.12b (Cosmic Horror): "if ~ is destroyed this way" is true only when the destroy put it into the graveyard', () => {
  const upkeep = (which: string, pay: boolean): GameState => {
    const s0 = mpScenario({ defs: [HORROR, HARD], zones: { p1: { battlefield: [which, 'Plains'] } } });
    const turn = s0.turn.number;
    const s = passUntil(act(s0, { type: 'pass', player: 'p1' }), (t) => t.turn.activePlayer === 'p1' && t.turn.number > turn && t.pending?.kind === 'yesNo', "p1's upkeep payment");
    return settle(drive(s, { yes: [pay] }));
  };
  it('is automated', () => { expect(full(HORROR)).toBe(true); expect(full(HARD)).toBe(true); });
  it('not paid: destroyed, and it deals 7 damage to you', () => {
    const s = upkeep('Test Void Horror', false);
    expect(bf(s, 'Test Void Horror')).toBeUndefined();
    expect(lifeOf(s, 'p1')).toBe(13);
  });
  it('paid: it stays, no damage', () => {
    const s = upkeep('Test Void Horror', true);
    expect(bf(s, 'Test Void Horror')).toBeDefined();
    expect(lifeOf(s, 'p1')).toBe(20);
  });
  it('not paid but indestructible: not destroyed, so no damage (ruling 2013-07-01; the negative case)', () => {
    const s = upkeep('Test Hard Horror', false);
    expect(bf(s, 'Test Hard Horror')).toBeDefined();
    expect(lifeOf(s, 'p1')).toBe(20);
  });
});

// ---- Gargantuan Gorilla: "you may sacrifice a Forest. If you sacrifice a snow Forest this way, ... If you don't sacrifice a Forest, sacrifice ~ and it deals 7 damage to you." ----

const APE = card('Test Giant Ape', 'Creature — Ape', "At the beginning of your upkeep, you may sacrifice a Forest. If you sacrifice a snow Forest this way, this creature gains trample until end of turn. If you don't sacrifice a Forest, sacrifice this creature and it deals 7 damage to you.", { pt: ['7', '7'] });
const WOOD = card('Test Wood', 'Land — Forest', '');
const SNOWWOOD = card('Test Snow Wood', 'Snow Land — Forest', '');

describe('CR 701.21a, 608.2c (Gargantuan Gorilla): "if you don\'t sacrifice a Forest" names the optional sacrifice two sentences before', () => {
  const upkeep = (land: string, yes: boolean): GameState => {
    const s0 = mpScenario({ defs: [APE, WOOD, SNOWWOOD], zones: { p1: { battlefield: ['Test Giant Ape', land] } } });
    const turn = s0.turn.number;
    const s = passUntil(act(s0, { type: 'pass', player: 'p1' }), (t) => t.turn.activePlayer === 'p1' && t.turn.number > turn && t.pending?.kind === 'yesNo', "p1's upkeep choice");
    return settle(drive(s, { yes: [yes] }));
  };
  it('is automated', () => expect(full(APE)).toBe(true));
  it('a snow Forest sacrificed: the Ape stays and gains trample, no damage', () => {
    const s = upkeep('Test Snow Wood', true);
    expect(bf(s, 'Test Snow Wood')).toBeUndefined();
    const ape = bf(s, 'Test Giant Ape');
    expect(ape).toBeDefined();
    expect(getChars(s, ape!).keywords.map((k) => k.keyword)).toContain('trample');
    expect(lifeOf(s, 'p1')).toBe(20);
  });
  it('a plain Forest sacrificed: the Ape stays, no trample needed, no damage', () => {
    const s = upkeep('Test Wood', true);
    expect(bf(s, 'Test Giant Ape')).toBeDefined();
    expect(getChars(s, bf(s, 'Test Giant Ape')!).keywords.map((k) => k.keyword)).not.toContain('trample');
    expect(lifeOf(s, 'p1')).toBe(20);
  });
  it('no Forest sacrificed: the Ape is sacrificed and deals 7 damage to you (the negative case)', () => {
    const s = upkeep('Test Wood', false);
    expect(bf(s, 'Test Giant Ape')).toBeUndefined();
    expect(bf(s, 'Test Wood')).toBeDefined();
    expect(lifeOf(s, 'p1')).toBe(13);
  });
});

// ---- G10 change (decided by the owner's standing rule 2026-10-27; Bogardan Phoenix): "Otherwise, return it to the battlefield under your control and put a death counter on it." ----

const PHOENIX = card('Test Ash Phoenix', 'Creature — Phoenix', 'When this creature dies, exile it if it had a death counter on it. Otherwise, return it to the battlefield under your control and put a death counter on it.', { pt: ['2', '2'] });
const DOOM = card('Test Doom Word', 'Instant', 'Destroy target creature.');

describe('CR 608.2c, 400.7 (Bogardan Phoenix, the otherwise list\'s own antecedents): "put a death counter on it" names the creature the same sentence returned', () => {
  const die = (counters: Record<string, number>): GameState => {
    const s0 = mpScenario({ defs: [PHOENIX, DOOM], zones: { p1: { battlefield: [{ name: 'Test Ash Phoenix', counters }], hand: ['Test Doom Word'] } } });
    return cast(s0, 'Test Doom Word', { targets: [[obj(bf(s0, 'Test Ash Phoenix')!)]] });
  };
  it('is automated', () => expect(full(PHOENIX)).toBe(true));
  it('no death counter: it returns, and the returned creature gets the death counter', () => {
    const s = die({});
    const id = bf(s, 'Test Ash Phoenix');
    expect(id).toBeDefined();
    expect(s.objects[id!]!.counters.death).toBe(1);
  });
  it('a death counter: it is exiled and does not return (the negative case)', () => {
    const s = die({ death: 1 });
    expect(bf(s, 'Test Ash Phoenix')).toBeUndefined();
    expect(exileOf(s, 'p1')).toEqual(['Test Ash Phoenix']);
  });
});
