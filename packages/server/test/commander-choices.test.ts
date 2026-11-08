/**
 * POST /api/decks/commander-choices (deck-art-1 part 1): the deckbuilder's "may this card be a commander now", answered with the cards package's own
 * rule (canAddCommander: CR 903.3, 903.12c, 702.124) in the deck's format, next to the deck's commanders.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { cardStore, closeCardStores, type CardStore } from '../src/cache';
import { matchRoute } from '../src/routes';
import { commanderChoices, commanderChoicesWith, parseCommanderChoicesRequest } from '../src/validate';
import { makeFixtureCache, req, type FixtureCache } from './fixture-cache';

vi.setConfig({ testTimeout: 60_000 });

let fx: FixtureCache;
let store: CardStore;

beforeAll(async () => {
  fx = makeFixtureCache();
  const opened = await cardStore(fx.ctx);
  if (!opened.ok) throw new Error(opened.error);
  store = opened.store;
});

afterAll(async () => {
  await closeCardStores();
  fx.cleanup();
});

const NAMES = ['Grizzly Bears', 'Sol Ring', 'Adrestia', 'Ajani Steadfast', 'Akroma, Vision of Ixidor', 'Ardenn, Intrepid Archaeologist', "Abdel Adrian, Gorion's Ward", 'Criminal Past', 'No Such Card'];
const offered = (format: string, commander: string[] = []) =>
  Object.entries(commanderChoicesWith(store, { format, commander: commander.map((name) => ({ name, count: 1 })), names: NAMES }).choices)
    .filter(([, ok]) => ok)
    .map(([n]) => n);

describe('deck-art-1: commander choices', () => {
  it('CR 903.3: legendary creatures and Vehicles, never a non-legendary creature, a legendary artifact, an unknown name or a Background alone', () => {
    expect(offered('commander')).toEqual(['Adrestia', 'Akroma, Vision of Ixidor', 'Ardenn, Intrepid Archaeologist', "Abdel Adrian, Gorion's Ward"]);
  });

  it('CR 903.12c: Brawl adds legendary planeswalkers; a format without commanders offers nothing', () => {
    expect(offered('brawl')).toContain('Ajani Steadfast');
    expect(offered('modern')).toEqual([]);
  });

  it('CR 702.124: beside a partner only a partner, beside "Choose a Background" only a Background, beside two nothing', () => {
    expect(offered('commander', ['Akroma, Vision of Ixidor'])).toEqual(['Ardenn, Intrepid Archaeologist']);
    expect(offered('commander', ["Abdel Adrian, Gorion's Ward"])).toEqual(['Criminal Past']);
    expect(offered('commander', ['Akroma, Vision of Ixidor', 'Ardenn, Intrepid Archaeologist'])).toEqual([]);
  });

  it('the route answers 200, and a malformed body 400', async () => {
    expect(matchRoute('POST', '/api/decks/commander-choices').kind).toBe('found');
    const ok = await commanderChoices(req({ body: { format: 'commander', commander: [], names: ['Grizzly Bears', 'Adrestia'] } }), fx.ctx);
    expect(ok).toEqual({ status: 200, body: { choices: { 'Grizzly Bears': false, Adrestia: true } } });
    expect(typeof parseCommanderChoicesRequest({ format: 'commander', names: 'x' })).toBe('string');
    expect(typeof parseCommanderChoicesRequest({ format: 'commander', commander: [{ name: 'X', count: 0 }], names: [] })).toBe('string');
  });
});
