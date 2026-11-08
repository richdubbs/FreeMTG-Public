/**
 * deck-art-1 part 1 (owner, 2026-11-07: "the deck editor gives you the option to make non legendary creature cards your commander"): the deckbuilder
 * offers "Commander" (the search button, a drop on the Commander section) only for a card the deck check accepts there. The fake server answers
 * POST /api/decks/commander-choices with the cards package's own canAddCommander (CR 903.3, 903.3a, 903.12c, 702.124), as the real server does.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SearchResponse } from '@openmtg/server/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavProvider } from '../src/app/nav';
import { DecksProvider } from '../src/decks/context';
import { DeckbuilderScreen } from '../src/decks/DeckbuilderScreen';
import type { Deck } from '../src/decks/model';
import { MemoryDeckStore } from '../src/decks/store';
import { byName, deckFixture, fakeServer } from './decks-fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

const CANDIDATES = [
  'Grizzly Bears',
  'Sol Ring',
  'Krenko, Mob Boss',
  'Parhelion II',
  'Test Spacecraft',
  'Test Station',
  'Freya, the Fury',
  'Cloakwood Hermit',
  'Wilson, Refined Grizzly',
  'Partner A',
  'Partner B',
];

const page = (): SearchResponse => ({ cards: CANDIDATES.map((n) => byName.get(n)!), page: 1, pageSize: 20, total: CANDIDATES.length });

const shown = () => CANDIDATES.filter((n) => screen.queryByRole('button', { name: `Set ${n} as commander` }) !== null);

async function offered(commander: Deck['commander'], format = 'commander') {
  const deck = deckFixture({ format, main: [{ name: 'Mountain', count: 10, oracleId: 'oid-mountain' }], sideboard: [], commander });
  const fetchMock = fakeServer({ search: page });
  const store = new MemoryDeckStore([deck]);
  render(
    <DecksProvider store={store} showScryfallImages={false}>
      <NavProvider>
        <DeckbuilderScreen deckId={deck.id} now={() => '2026-11-07T00:00:00.000Z'} validateDelayMs={0} autoSearch={false} />
      </NavProvider>
    </DecksProvider>,
  );
  await screen.findByDisplayValue('Gruul Test');
  const search = screen.getByRole('region', { name: 'Card search' });
  fireEvent.click(within(search).getByRole('button', { name: 'Search' }));
  await within(search).findByRole('list', { name: 'Search results' });
  await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/decks/commander-choices'))).toBe(true));
  // The stubbed server answers within a few ticks.
  await new Promise((r) => setTimeout(r, 30));
  return { names: shown(), store };
}

describe('deck-art-1: "Commander" is offered only for a card that can be one', () => {
  it('no commander yet (CR 903.3, 903.3a): legendary creature, Vehicle, Spacecraft with P/T, "can be your commander"; no Background alone', async () => {
    const { names } = await offered([]);
    expect(names).toEqual(['Krenko, Mob Boss', 'Parhelion II', 'Test Spacecraft', 'Freya, the Fury', 'Wilson, Refined Grizzly', 'Partner A', 'Partner B']);
    // Not: a non-legendary creature, a legendary non-creature, a Spacecraft without a P/T box, a Background alone.
  });

  it('Brawl (CR 903.12c): the deck check of the deck\'s format decides (no extra planeswalker in the fixtures, same list)', async () => {
    const { names } = await offered([], 'brawl');
    expect(names).toContain('Freya, the Fury');
    expect(names).not.toContain('Grizzly Bears');
  });

  it('CR 702.124k: beside a "Choose a Background" commander only a Background is offered', async () => {
    const { names } = await offered([{ name: 'Wilson, Refined Grizzly', count: 1, oracleId: 'oid-wilson-refined-grizzly' }]);
    expect(names).toEqual(['Cloakwood Hermit']);
  });

  it('CR 702.124h: beside a Partner only another Partner; beside a commander without a partner ability nothing', async () => {
    expect((await offered([{ name: 'Partner A', count: 1, oracleId: 'oid-partner-a' }])).names).toEqual(['Partner B']);
  });

  it('CR 702.124f: beside Krenko (no partner ability) nothing is offered, and a non-legendary creature cannot be dropped on the Commander section', async () => {
    const { names, store } = await offered([{ name: 'Krenko, Mob Boss', count: 1, oracleId: 'oid-krenko-mob-boss' }]);
    expect(names).toEqual([]);
    const main = screen.getByRole('region', { name: /Main deck/ });
    const target = screen.getByRole('region', { name: /Commander/ });
    const data = new Map<string, string>();
    const dataTransfer = { setData: (t: string, v: string) => data.set(t, v), getData: (t: string) => data.get(t) ?? '', get types() { return [...data.keys()]; }, effectAllowed: '' };
    fireEvent.dragStart(within(main).getByRole('listitem', { name: '10 Mountain' }), { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(within(target).queryByRole('listitem', { name: /Mountain/ })).toBeNull();
    expect((await store.get('deck-1'))!.commander.map((e) => e.name)).toEqual(['Krenko, Mob Boss']);
  });

  it('a card that can be one moves to the Commander section by drag and drop, one copy', async () => {
    const deck = deckFixture({ format: 'commander', main: [{ name: 'Krenko, Mob Boss', count: 2, oracleId: 'oid-krenko-mob-boss' }], sideboard: [], commander: [] });
    fakeServer({ search: page });
    render(
      <DecksProvider store={new MemoryDeckStore([deck])} showScryfallImages={false}>
        <NavProvider>
          <DeckbuilderScreen deckId={deck.id} now={() => '2026-11-07T00:00:00.000Z'} validateDelayMs={0} autoSearch={false} />
        </NavProvider>
      </DecksProvider>,
    );
    await screen.findByDisplayValue('Gruul Test');
    const target = screen.getByRole('region', { name: /Commander/ });
    const data = new Map<string, string>();
    const dataTransfer = { setData: (t: string, v: string) => data.set(t, v), getData: (t: string) => data.get(t) ?? '', get types() { return [...data.keys()]; }, effectAllowed: '' };
    // The answer for the deck's own cards arrives with their card data.
    await new Promise((r) => setTimeout(r, 50));
    await waitFor(() => {
      fireEvent.dragStart(within(screen.getByRole('region', { name: /Main deck/ })).getByRole('listitem', { name: /Krenko/ }), { dataTransfer });
      fireEvent.drop(target, { dataTransfer });
      expect(within(target).getByRole('listitem', { name: '1 Krenko, Mob Boss' })).toBeTruthy();
    });
    expect(within(screen.getByRole('region', { name: /Main deck/ })).getByRole('listitem', { name: '1 Krenko, Mob Boss' })).toBeTruthy();
  });
});
