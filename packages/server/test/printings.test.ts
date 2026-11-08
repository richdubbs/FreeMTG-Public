/**
 * deck-art-1: GET /api/printings (a card's or token's printings from Scryfall's API through the server, kept in memory, image URLs only from Scryfall's
 * own image_uris on *.scryfall.io and only with images=1, offline: the default printing only with a note) and POST /api/decks/tokens (the tokens a
 * deck's cards make, from all_parts matched to the token index). Scryfall is a fake fetch here: no test reaches the network.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ScryfallClient } from '@openmtg/cards';
import { cardStore, closeCardStores, type CardStore } from '../src/cache';
import type { ServerContext } from '../src/context';
import { deckTokens, postDeckTokens } from '../src/deckTokens';
import { getPrintings, printingIdOfImage, printingOf } from '../src/printings';
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

const print = (id: string, set: string, number: string, extra: Record<string, unknown> = {}) => ({
  id, set, set_name: `Set ${set.toUpperCase()}`, collector_number: number, released_at: '2020-01-02', artist: 'Some Artist',
  image_uris: { small: `https://cards.scryfall.io/small/front/a/b/${id}.jpg`, normal: `https://cards.scryfall.io/normal/front/a/b/${id}.jpg`, large: `https://evil.example/large/${id}.jpg` },
  ...extra,
});
const ID1 = '11111111-1111-4111-8111-111111111111';
const ID2 = '22222222-2222-4222-8222-222222222222';

/** A context whose Scryfall client answers from `pages` (by URL) through a fake fetch, recording each request with its headers. */
function fakeScryfall(answer: (url: string) => { status: number; body: unknown }) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    const a = answer(String(url));
    return new Response(JSON.stringify(a.body), { status: a.status, headers: { 'content-type': 'application/json' } });
  }) as typeof globalThis.fetch;
  const ctx: ServerContext = { ...fx.ctx, scryfall: new ScryfallClient({ fetch, clock: { now: () => 0, sleep: async () => undefined } }) };
  return { ctx, calls };
}

describe('deck-art-1: GET /api/printings', () => {
  it('follows next_page, keeps Scryfall image URLs on *.scryfall.io only, marks the index printing, and asks Scryfall once per run', async () => {
    const bolt = store.db.lookup('Lightning Bolt')!;
    const { ctx, calls } = fakeScryfall((url) =>
      url.includes('page=2')
        ? { status: 200, body: { data: [print(ID2, 'LEB', '161', { lang: 'de' })], has_more: false } }
        : { status: 200, body: { data: [print(ID1, 'm10', '146')], has_more: true, next_page: 'https://api.scryfall.com/cards/search?page=2&q=x' } },
    );
    const r = await getPrintings(req({ query: { oracleId: bolt.oracle_id!, images: '1' } }), ctx);
    expect(r.status).toBe(200);
    const body = r.body as import('../src/api').PrintingsResponse;
    expect(body.name).toBe('Lightning Bolt');
    expect(body.printings.map((p) => [p.set, p.number, p.lang])).toEqual([['m10', '146', undefined], ['leb', '161', 'de']]);
    expect(body.printings[0]!.faces[0]).toEqual({ small: `https://cards.scryfall.io/small/front/a/b/${ID1}.jpg`, normal: `https://cards.scryfall.io/normal/front/a/b/${ID1}.jpg`, artist: 'Some Artist' });
    expect(calls[0]!.url).toBe(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`oracleid:${bolt.oracle_id}`)}&unique=prints&order=released`);
    expect(calls[0]!.headers['User-Agent']).toMatch(/OpenMTG/);
    expect(calls[0]!.headers['Accept']).toBe('application/json');
    // The second request is answered from memory; without images=1 no URL is sent.
    const again = (await getPrintings(req({ query: { name: 'Lightning Bolt' } }), ctx)).body as import('../src/api').PrintingsResponse;
    expect(calls).toHaveLength(2);
    expect(again.printings[0]!.faces).toEqual([{}]);
  });

  it('offline: the default printing only (no list), with a note; never a failure', async () => {
    const { ctx } = fakeScryfall(() => ({ status: 503, body: { details: 'down' } }));
    const r = await getPrintings(req({ query: { name: 'Lightning Bolt' } }), ctx);
    expect(r.status).toBe(200);
    const body = r.body as import('../src/api').PrintingsResponse;
    expect(body.printings).toEqual([]);
    expect(body.note).toMatch(/only the default printing/);
  });

  it('a token is searched with include_extras; an unknown card is 404; a bad id is 400', async () => {
    const token = store.db.lookupTokens('Goblin')[0]!;
    const { ctx, calls } = fakeScryfall(() => ({ status: 200, body: { data: [print(ID1, 'tgk2', '6')], has_more: false } }));
    expect((await getPrintings(req({ query: { oracleId: token.oracle_id! } }), ctx)).status).toBe(200);
    expect(calls[0]!.url).toContain('include_extras=true');
    expect((await getPrintings(req({ query: { name: 'No Such Card Anywhere' } }), ctx)).status).toBe(404);
    expect((await getPrintings(req({ query: { oracleId: 'not-an-id' } }), ctx)).status).toBe(400);
  });

  it('a print without an id, set or number is skipped; the index printing is read from its image URL', () => {
    expect(printingOf({ set: 'm10' })).toBeNull();
    expect(printingIdOfImage(`https://cards.scryfall.io/normal/front/8/2/824b2d73-2151-4e5e-9f05-8f63e2bdcaa9.jpg?1783909065`)).toBe('824b2d73-2151-4e5e-9f05-8f63e2bdcaa9');
    expect(printingIdOfImage(undefined)).toBeNull();
  });
});

describe('deck-art-1: POST /api/decks/tokens', () => {
  it("Dragon Fodder makes the plain 1/1 red Goblin (picked among the Goblins by its own text); Academy Manufactor's tokens; one row per token", () => {
    const tokens = deckTokens(store, ['Dragon Fodder', 'Academy Manufactor', 'Lightning Bolt', 'Dragon Fodder']);
    const goblin = tokens.find((t) => t.name === 'Goblin')!;
    expect(goblin).toMatchObject({ power: '1', toughness: '1', colors: ['R'], oracleText: '', makers: ['Dragon Fodder'] });
    expect(goblin.oracleId).toBeTruthy();
    expect(tokens.filter((t) => t.makers.includes('Academy Manufactor')).map((t) => t.name).sort()).toEqual(['Clue', 'Food', 'Treasure']);
    expect(new Set(tokens.map((t) => t.key)).size).toBe(tokens.length);
  });

  it('the handler checks its body', async () => {
    expect((await postDeckTokens(req({ body: { names: 'x' } }), fx.ctx)).status).toBe(400);
    expect((await postDeckTokens(req({ body: { names: ['Dragon Fodder'] } }), fx.ctx)).status).toBe(200);
  });
});
