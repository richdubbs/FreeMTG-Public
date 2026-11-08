/**
 * trek-23 (lane trek, coordinator D; Vulcan Mind-Meld): the round's readings played through the engine with synthetic cards (invented names, design 6.10), compiled by the game's
 * default compiler, in a four-player game (Commander is four players). Each test is named after the rule it checks, with its negative case. CR cites checked against the Comprehensive
 * Rules text of 2026-09-25.
 *
 *   CR 701.20e, 406.3, 608.2c   "Target opponent looks at the top card of your library, then exiles it face down. You look at the top two cards of their library, then exile them
 *                               face down.": each card is exiled face down by the player who looked at it, and only that player may look at it in exile
 *   CR 608.2c, 611.2a, 400.7    "For each card exiled this way, the player who exiled it may play it for as long as it remains exiled.": the target opponent may play YOUR card, you
 *                               may play THEIR two cards; nobody may play a card they did not exile (its owner included), and the other players none
 *   CR 609.4b                   "Mana of any type can be spent to cast spells this way.": a blue spell cast with white mana, by either player
 *   CR 611.2b, 400.7            each card's permission is its own: playing one of the cards leaves the other playable; a card that left exile is a new object, never played again
 *   CR 608.2c (fail closed)     an exile that does not say who exiles ("Exile the top two cards ... face down") is never read as "the player who exiled it": not automated
 */
import { describe, expect, it } from 'vitest';
import { legalActions, type GameState, type ObjectId, type PlayerId } from '../../../src/index';
import { act, find } from '../../m3/scenario';
import { mpScenario } from '../../m12/rules/helpers';
import { card, full, resolveAll, settle } from '../cmd3/helpers';
import { canSee } from '../../../src/core/view';

const MELD = card('Test Mind Link', 'Sorcery',
  'Target opponent looks at the top card of your library, then exiles it face down. You look at the top two cards of their library, then exile them face down. For each card exiled this way, the player who exiled it may play it for as long as it remains exiled. Mana of any type can be spent to cast spells this way.',
  undefined, '{0}');
const PONDER = card('Test Ponder', 'Instant', 'Draw a card.', undefined, '{U}');
const TONIC = card('Test Tonic', 'Instant', 'You gain 2 life.', undefined, '{U}');
const CUB = card('Test Cub', 'Creature — Bear', '', ['2', '2'], '{1}{G}');
const IMPERATIVE = card('Test Mind Grab', 'Sorcery',
  "Exile the top two cards of target opponent's library face down. For each card exiled this way, the player who exiled it may play it for as long as it remains exiled.", undefined, '{0}');
// trek-23 review: a group as the exiler (nobody would be remembered) and a duration of "their next turn" (one turn for every exiler) are never automated either
const GROUP = card('Test Mind Swarm', 'Sorcery',
  'Each opponent looks at the top card of your library, then exiles it face down. For each card exiled this way, the player who exiled it may play it for as long as it remains exiled.', undefined, '{0}');
const THEIR_TURN = card('Test Mind Lease', 'Sorcery',
  'Target opponent looks at the top card of your library, then exiles it face down. You look at the top two cards of their library, then exile them face down. For each card exiled this way, the player who exiled it may play it until the end of their next turn.', undefined, '{0}');
const UP_TO = card('Test Mind Peek', 'Sorcery', 'Up to one target opponent looks at the top card of your library, then exiles it face down.', undefined, '{0}');
const UP_TO_PLAY = card('Test Mind Offer', 'Sorcery',
  'Up to one target opponent looks at the top card of your library, then exiles it face down. For each card exiled this way, the player who exiled it may play it this turn.', undefined, '{0}');
const DEFS = [MELD, PONDER, TONIC, CUB, IMPERATIVE, UP_TO];

const castsOf = (s: GameState, id: ObjectId, player: PlayerId) => legalActions(s, player).filter((a) => a.kind === 'cast' && a.object === id);
const exiled = (s: GameState, name: string): ObjectId => s.zones.exile.find((id) => s.defs[s.objects[id]!.defId]!.name === name)!;

/** p1 casts the spell at p2; p1's library then starts with Test Tonic, p2's with Test Ponder and Test Cub. Every player has Plains only (white mana). */
function meld(): GameState {
  let s = mpScenario({
    defs: DEFS,
    zones: {
      p1: { hand: ['Test Mind Link'], battlefield: ['Plains', 'Plains', 'Plains'], library: ['Plains', 'Test Tonic'] }, // CR 103.8c: in a multiplayer game the first player draws (the Plains)
      p2: { battlefield: ['Plains', 'Plains'], library: ['Test Ponder', 'Test Cub'] },
      p3: { battlefield: ['Plains', 'Plains'] },
      p4: { battlefield: ['Plains', 'Plains'] },
    },
  } as never);
  s = act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Mind Link', 'hand') });
  return resolveAll(settle(s, { targets: [{ kind: 'player', id: 'p2' }] }));
}

/** Everyone after p1 passes priority in turn, so `player` holds priority with an empty stack (p1's main phase). */
function priorityTo(s0: GameState, player: PlayerId): GameState {
  let s = s0;
  for (let guard = 0; guard < 4 && s.pending?.player !== player; guard++) s = act(s, { type: 'pass', player: s.pending!.player });
  expect(s.pending?.player).toBe(player);
  return s;
}

describe('the synthetic cards', () => {
  it('"... the player who exiled it may play it ..." after exiles that say who exiles is automated', () => expect(full(MELD), JSON.stringify(MELD.automation)).toBe(true));
  it('CR 608.2c (fail closed): after an exile that does not say who exiles, the same sentence is not automated (nobody would know who exiled each card)', () => {
    expect(full(IMPERATIVE)).toBe(false);
  });
  it('CR 608.2c (fail closed): a group as the one who exiles ("each opponent looks ..., then exiles it") is not automated: no one player is remembered as the exiler', () => {
    expect(full(GROUP)).toBe(false);
  });
  it('CR 608.2c (fail closed): "up to one target opponent" as the one who exiles, before "the player who exiled it may play it", is not automated (trek-23 re-review)', () => {
    expect(full(UP_TO_PLAY)).toBe(false);
  });
  it('CR 611.2a (fail closed): "until the end of their next turn" is not automated: the duration would be the same player\'s turn for every exiler', () => {
    expect(full(THEIR_TURN)).toBe(false);
  });
});

describe('CR 701.20e, 406.3: each card is exiled face down by the player who looked at it, and only that player may look at it', () => {
  it('your top card goes to exile face down, seen by the target opponent only; their top two go to exile face down, seen by you only', () => {
    const s = meld();
    const tonic = exiled(s, 'Test Tonic');
    const ponder = exiled(s, 'Test Ponder');
    const cub = exiled(s, 'Test Cub');
    for (const id of [tonic, ponder, cub]) expect(s.objects[id]!.faceDown, s.defs[s.objects[id]!.defId]!.name).toBe(true);
    expect(s.objects[tonic]!.owner).toBe('p1');
    expect([s.objects[ponder]!.owner, s.objects[cub]!.owner]).toEqual(['p2', 'p2']);
    expect(canSee(s, s.objects[tonic]!, 'p2')).toBe(true);
    expect(canSee(s, s.objects[tonic]!, 'p1')).toBe(false); // CR 406.3: you did not look at your own card
    expect(canSee(s, s.objects[tonic]!, 'p3')).toBe(false);
    for (const id of [ponder, cub]) {
      expect(canSee(s, s.objects[id]!, 'p1')).toBe(true);
      expect(canSee(s, s.objects[id]!, 'p2')).toBe(false);
      expect(canSee(s, s.objects[id]!, 'p4')).toBe(false);
    }
  });
});

describe('CR 608.2b, 608.2c: "up to one target opponent looks at the top card of your library, then exiles it face down" (trek-23 re-review)', () => {
  const peek = (target: boolean): GameState => {
    let s = mpScenario({ defs: DEFS, zones: { p1: { hand: ['Test Mind Peek'], library: ['Plains', 'Test Tonic'] } } } as never);
    s = act(s, { type: 'cast', player: 'p1', card: find(s, 'Test Mind Peek', 'hand') });
    return resolveAll(settle(s, { targets: target ? [{ kind: 'player', id: 'p2' }] : [] }));
  };
  it('is automated', () => expect(full(UP_TO), JSON.stringify(UP_TO.automation)).toBe(true));
  it('with an opponent chosen, your top card is exiled face down, seen by that opponent only', () => {
    const s = peek(true);
    const tonic = exiled(s, 'Test Tonic');
    expect(s.objects[tonic]!.faceDown).toBe(true);
    expect(canSee(s, s.objects[tonic]!, 'p2')).toBe(true);
    expect(canSee(s, s.objects[tonic]!, 'p1')).toBe(false);
  });
  it('the negative case: with no opponent chosen, nobody looks and nothing is exiled (the top card stays on top)', () => {
    const s = peek(false);
    expect(exiled(s, 'Test Tonic')).toBeUndefined();
    expect(s.defs[s.objects[s.zones.library['p1']![0]!]!.defId]!.name).toBe('Test Tonic');
  });
});

describe('CR 608.2c, 611.2a, 609.4b: the player who exiled each card may play it, with mana of any type', () => {
  it('you cast their blue instant with white mana and their green creature with white mana (CR 609.4b)', () => {
    let s = meld();
    const ponder = exiled(s, 'Test Ponder');
    const cub = exiled(s, 'Test Cub');
    expect(castsOf(s, ponder, 'p1').length).toBeGreaterThan(0);
    expect(castsOf(s, cub, 'p1').length).toBeGreaterThan(0);
    const hand = s.zones.hand['p1']!.length;
    s = resolveAll(settle(act(s, castsOf(s, ponder, 'p1')[0]!.action)));
    expect(s.zones.hand['p1']!.length).toBe(hand + 1); // Draw a card.
    expect(s.objects[ponder]?.zone ?? 'gone').not.toBe('exile');
  });
  it('the target opponent casts your blue instant with white mana while holding priority (CR 609.4b); its owner (you) cannot', () => {
    let s = meld();
    const tonic = exiled(s, 'Test Tonic');
    expect(castsOf(s, tonic, 'p1')).toEqual([]);
    s = priorityTo(s, 'p2');
    const casts = castsOf(s, tonic, 'p2');
    expect(casts.length).toBeGreaterThan(0);
    const life = s.players.find((p) => p.id === 'p2')!.life;
    s = resolveAll(settle(act(s, casts[0]!.action)));
    expect(s.players.find((p) => p.id === 'p2')!.life).toBe(life + 2);
  });
  it('the negative case: nobody may play a card they did not exile: the target opponent not their own two, the other players none', () => {
    let s = meld();
    const ids = ['Test Tonic', 'Test Ponder', 'Test Cub'].map((n) => exiled(s, n));
    s = priorityTo(s, 'p2');
    expect(castsOf(s, ids[1]!, 'p2')).toEqual([]);
    expect(castsOf(s, ids[2]!, 'p2')).toEqual([]);
    s = priorityTo(s, 'p3');
    for (const id of ids) expect(castsOf(s, id, 'p3')).toEqual([]);
    s = priorityTo(s, 'p4');
    for (const id of ids) expect(castsOf(s, id, 'p4')).toEqual([]);
  });
});

describe('CR 611.2b, 400.7: each card\'s permission is its own', () => {
  it('after you cast one of their cards, the other stays playable; the card cast is a new object in its owner\'s graveyard, not playable by the permission (CR 400.7)', () => {
    let s = meld();
    const ponder = exiled(s, 'Test Ponder');
    const cub = exiled(s, 'Test Cub');
    s = resolveAll(settle(act(s, castsOf(s, ponder, 'p1')[0]!.action)));
    const resolved = find(s, 'Test Ponder', 'graveyard', 'p2');
    expect(resolved).not.toBe(ponder);
    expect(castsOf(s, resolved, 'p1')).toEqual([]);
    expect(castsOf(s, ponder, 'p1')).toEqual([]);
    expect(s.objects[cub]!.zone).toBe('exile');
    expect(castsOf(s, cub, 'p1').length).toBeGreaterThan(0);
    s = resolveAll(settle(act(s, castsOf(s, cub, 'p1')[0]!.action)));
    expect(s.zones.battlefield.some((id) => s.defs[s.objects[id]!.defId]!.name === 'Test Cub' && s.objects[id]!.controller === 'p1')).toBe(true);
  });
});
