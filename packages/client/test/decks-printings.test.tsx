/**
 * deck-art-1 parts 2 and 3: a deck card's (and a deck token's) chosen printing. Saved as an optional field (old decks unchanged), written and read as
 * "1 Lightning Bolt (M10) 146", picked in the deckbuilder (text list with the Scryfall setting off, thumbnails with it on), looked up by name + printing
 * (an unknown printing shows the default picture), and shown for that player's cards and tokens in a game. No network: fetch is stubbed.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { DeckToken, PrintingsResponse } from '@openmtg/server/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavProvider } from '../src/app/nav';
import { modelFromSummary } from '../src/cards';
import { DecksProvider } from '../src/decks/context';
import { DeckbuilderScreen } from '../src/decks/DeckbuilderScreen';
import { addCard, isDeck, moveCard, printingOf, setPrinting, setTokenPrinting, toDeckList, type Deck } from '../src/decks/model';
import { MemoryDeckStore } from '../src/decks/store';
import { deckFromResolve, exportDeck } from '../src/decks/textio';
import { printingFor, seatPrintings } from '../src/game/printings';
import { findPrinting, parsePrintedKey, printedKey, withPrinting } from '../src/images/printings';
import { fetchScryfallUris } from '../src/images/scryfall';
import { byName, deckFixture, fakeServer, type FakeServer } from './decks-fixtures';
import { stubFetch } from './helpers';

afterEach(() => {
  vi.unstubAllGlobals();
});

const M10 = { set: 'm10', number: '146' };
const img = (id: string) => ({ small: `https://cards.scryfall.io/small/front/a/b/${id}.jpg`, normal: `https://cards.scryfall.io/normal/front/a/b/${id}.jpg`, artist: `Artist ${id}` });
const boltPrintings = (images: boolean): PrintingsResponse => ({
  oracleId: 'oid-lightning-bolt',
  name: 'Lightning Bolt',
  defaultId: 'p2',
  printings: [
    { id: 'p1', set: 'm10', setName: 'Magic 2010', number: '146', released: '2009-07-17', artist: 'Christopher Moeller', faces: [images ? img('p1') : {}] },
    { id: 'p2', set: 'leb', setName: 'Limited Edition Beta', number: '161', released: '1993-10-04', artist: 'Christopher Rush', faces: [images ? img('p2') : {}] },
  ],
});

describe('deck-art-1: the deck model keeps a chosen printing', () => {
  it('setPrinting sets it on every entry of the card, null removes it; old decks are unchanged and still valid', () => {
    const deck = deckFixture({ sideboard: [{ name: 'Lightning Bolt', count: 1, oracleId: 'oid-lightning-bolt' }] });
    expect(isDeck(deck)).toBe(true);
    expect(printingOf(deck, 'Lightning Bolt')).toBeUndefined();
    const chosen = setPrinting(deck, 'Lightning Bolt', { set: 'M10', number: '146' });
    expect(chosen.main[0]).toEqual({ name: 'Lightning Bolt', count: 4, oracleId: 'oid-lightning-bolt', printing: M10 });
    expect(chosen.sideboard[0]!.printing).toEqual(M10);
    expect(chosen.main[1]).toBe(deck.main[1]);
    expect(setPrinting(chosen, 'Lightning Bolt', { set: 'm10', number: '146' })).toBe(chosen);
    const back = setPrinting(chosen, 'Lightning Bolt', null);
    expect(back.main[0]).toEqual(deck.main[0]);
    expect(isDeck(chosen)).toBe(true);
  });

  it('a copy added or moved keeps the printing; tokens are saved by slot key and go with the deck list', () => {
    const deck = setPrinting(deckFixture(), 'Lightning Bolt', M10);
    expect(addCard({ ...deck, main: deck.main.filter((e) => e.name !== 'Lightning Bolt'), sideboard: deck.main.filter((e) => e.name === 'Lightning Bolt') }, 'main', { name: 'Lightning Bolt' }).main.at(-1)!.printing).toEqual(M10);
    expect(moveCard(deck, 'main', 'sideboard', 'Lightning Bolt', 1).sideboard.at(-1)!.printing).toEqual(M10);
    const withToken = setTokenPrinting(deck, 'goblin-key', { oracleId: 'oid-goblin', name: 'Goblin', printing: { set: 'TGK2', number: '6' } });
    expect(withToken.tokens).toEqual({ 'goblin-key': { oracleId: 'oid-goblin', name: 'Goblin', printing: { set: 'tgk2', number: '6' } } });
    expect(toDeckList(withToken).tokens).toEqual(withToken.tokens);
    expect(setTokenPrinting(withToken, 'goblin-key', null).tokens).toBeUndefined();
    expect(toDeckList(deck).tokens).toBeUndefined();
  });
});

describe('deck-art-1: decklist text', () => {
  it('Arena and plain text write "(SET) number"; MTGO (no set codes in its format) does not; tokens are never written as cards', () => {
    const deck = setTokenPrinting(setPrinting(deckFixture(), 'Lightning Bolt', M10), 'k', { oracleId: 'o', name: 'Goblin', printing: M10 });
    expect(exportDeck(deck, 'arena')).toContain('\n4 Lightning Bolt (M10) 146\n');
    expect(exportDeck(deck, 'plain')).toContain('\n4 Lightning Bolt (M10) 146\n');
    expect(exportDeck(deck, 'mtgo')).toContain('4 Lightning Bolt\n');
    expect(exportDeck(deck, 'arena')).not.toContain('Goblin');
  });

  it('an imported line\'s set code becomes the chosen printing', () => {
    const d = deckFromResolve(
      { cards: [{ section: 'main', count: 4, name: 'Lightning Bolt', oracleId: 'oid-lightning-bolt', automation: 'full', printing: M10 }, { section: 'main', count: 2, name: 'Forest', oracleId: 'oid-forest', automation: 'full' }], unknown: [], errors: [], links: [], ignored: 0 },
      { name: 'x', format: 'modern', now: 'now' },
    );
    expect(d.main).toEqual([{ name: 'Lightning Bolt', count: 4, oracleId: 'oid-lightning-bolt', printing: M10 }, { name: 'Forest', count: 2, oracleId: 'oid-forest' }]);
  });
});

describe('deck-art-1: pictures by name + printing', () => {
  it('keys, look-up in a list (a set code alone takes the set), and the printed model without the default URLs', () => {
    expect(parsePrintedKey(printedKey('Fire // Ice', M10))).toEqual({ name: 'Fire // Ice', printing: M10 });
    expect(printedKey('Lightning Bolt', undefined)).toBe('Lightning Bolt');
    const list = boltPrintings(false).printings;
    expect(findPrinting(list, { set: 'M10', number: '146' })?.id).toBe('p1');
    expect(findPrinting(list, { set: 'leb', number: '' })?.id).toBe('p2');
    expect(findPrinting(list, { set: 'xyz', number: '1' })).toBeUndefined();
    const model = modelFromSummary({ ...byName.get('Lightning Bolt')!, faces: [{ ...byName.get('Lightning Bolt')!.faces[0]!, imageUris: { normal: 'https://cards.scryfall.io/normal/x.jpg' } }] });
    const printed = withPrinting(model, M10);
    expect(printed.printing).toEqual(M10);
    expect(printed.faces[0]!.imageUris).toBeUndefined();
    expect(withPrinting(model, M10)).toBe(printed);
    expect(withPrinting(model, undefined)).toBe(model);
  });

  it('the chosen printing\'s picture comes from the printings list; an unknown printing falls back to the default picture', async () => {
    const calls: string[] = [];
    stubFetch((url) => {
      calls.push(url);
      if (url.startsWith('/api/printings')) return { status: 200, body: boltPrintings(true) };
      return { status: 200, body: { card: { ...byName.get('Lightning Bolt')!, faces: [{ ...byName.get('Lightning Bolt')!.faces[0]!, imageUris: img('default') }] } } };
    });
    expect(await fetchScryfallUris(printedKey('Lightning Bolt', M10))).toEqual([img('p1')]);
    expect(await fetchScryfallUris(printedKey('Lightning Bolt', { set: 'zzz', number: '9' }))).toEqual([img('default')]);
    expect(calls.every((u) => u.startsWith('/api/'))).toBe(true);
  });

  it('a token\'s chosen printing is looked up by its Oracle id (token names are not unique)', async () => {
    const calls: string[] = [];
    stubFetch((url) => {
      calls.push(url);
      return { status: 200, body: { oracleId: 'oid-goblin-token', name: 'Goblin', defaultId: 't2', printings: [{ id: 't1', set: 'tgk2', setName: 'Tokens', number: '6', released: '2019-02-15', faces: [img('t1')] }, { id: 't2', set: 'tm10', setName: 'Tokens', number: '1', released: '2009-07-17', faces: [img('t2')] }] } };
    });
    expect(await fetchScryfallUris(printedKey('Goblin', { set: 'tgk2', number: '6' }, 'oid-goblin-token'))).toEqual([img('t1')]);
    expect(await fetchScryfallUris(printedKey('Goblin', { set: 'zzz', number: '1' }, 'oid-goblin-token'))).toEqual([img('t2')]);
    expect([...new Set(calls)]).toEqual(['/api/printings?images=1&oracleId=oid-goblin-token']);
  });

  it('in a game each player\'s copies show that player\'s printing; a token by its image slot', () => {
    const deck = setTokenPrinting(setPrinting(deckFixture(), 'Lightning Bolt', M10), 'Goblin|1|1|R|Token Creature — Goblin|', { oracleId: 'o', name: 'Goblin', printing: { set: 'tgk2', number: '6' } });
    const printings = { p1: seatPrintings(toDeckList(deck))! };
    expect(seatPrintings(toDeckList(deckFixture()))).toBeNull();
    const bolt = modelFromSummary(byName.get('Lightning Bolt')!);
    expect(printingFor(printings, 'p1', bolt)).toEqual(M10);
    expect(printingFor(printings, 'p2', bolt)).toBeUndefined();
    const token = { ...bolt, name: 'Goblin', isToken: true, slots: [{ key: 'Goblin|1|1|R|Token Creature — Goblin|', label: 'Goblin', names: ['Goblin'] }] };
    expect(printingFor(printings, 'p1', token)).toEqual({ set: 'tgk2', number: '6' });
  });
});

function renderBuilder(deck: Deck, server: FakeServer, images = false) {
  const fetchMock = fakeServer(server);
  const store = new MemoryDeckStore([deck]);
  render(
    <DecksProvider store={store} showScryfallImages={images}>
      <NavProvider>
        <DeckbuilderScreen deckId={deck.id} now={() => '2026-11-07T00:00:00.000Z'} validateDelayMs={0} autoSearch={false} />
      </NavProvider>
    </DecksProvider>,
  );
  return { store, fetchMock };
}

describe('deck-art-1: the printing picker in the deckbuilder', () => {
  it('setting off: a text list (set, code and number, year, artist), no pictures; the choice is saved and shown on the row', async () => {
    const { store, fetchMock } = renderBuilder(deckFixture(), { printings: (q) => boltPrintings(q.get('images') === '1') });
    await screen.findByDisplayValue('Gruul Test');
    fireEvent.click(screen.getByRole('button', { name: 'Choose the printing of Lightning Bolt' }));
    const picker = await screen.findByRole('region', { name: 'Printings of Lightning Bolt' });
    const option = await within(picker).findByRole('button', { name: 'Magic 2010 (M10) 146, 2009, illustrated by Christopher Moeller' });
    expect(within(picker).getByRole('button', { name: /Default printing/ }).getAttribute('aria-pressed')).toBe('true');
    expect(picker.querySelector('img')).toBeNull();
    expect(fetchMock.mock.calls.map(([u]) => String(u)).find((u) => u.startsWith('/api/printings'))).toBe('/api/printings?oracleId=oid-lightning-bolt');
    fireEvent.click(option);
    await waitFor(async () => expect((await store.get('deck-1'))!.main[0]!.printing).toEqual(M10));
    expect(within(screen.getByRole('listitem', { name: '4 Lightning Bolt' })).getByText('(M10) 146')).toBeTruthy();
    // Back to the default.
    fireEvent.click(screen.getByRole('button', { name: 'Choose the printing of Lightning Bolt' }));
    fireEvent.click(await within(await screen.findByRole('region', { name: 'Printings of Lightning Bolt' })).findByRole('button', { name: /Default printing/ }));
    await waitFor(async () => expect((await store.get('deck-1'))!.main[0]!.printing).toBeUndefined());
  });

  it('setting on: thumbnails from Scryfall\'s URLs, no referrer; a printing Scryfall does not know is said so', async () => {
    renderBuilder(setPrinting(deckFixture(), 'Lightning Bolt', { set: 'dar', number: '1' }), { printings: (q) => boltPrintings(q.get('images') === '1') }, true);
    await screen.findByDisplayValue('Gruul Test');
    fireEvent.click(screen.getByRole('button', { name: 'Choose the printing of Lightning Bolt' }));
    const picker = await screen.findByRole('region', { name: 'Printings of Lightning Bolt' });
    await within(picker).findByRole('button', { name: /Magic 2010/ });
    const thumbs = [...picker.querySelectorAll('img')];
    expect(thumbs.map((i) => i.getAttribute('src'))).toEqual([img('p1').small, img('p2').small]);
    expect(thumbs.every((i) => i.getAttribute('referrerpolicy') === 'no-referrer')).toBe(true);
    expect(within(picker).getByRole('note').textContent).toMatch(/\(DAR\) 1 is not a printing of Lightning Bolt/);
  });

  it('offline: only the default printing, with the server\'s note', async () => {
    renderBuilder(deckFixture(), { printings: () => ({ ...boltPrintings(false), printings: [], note: 'The other printings come from Scryfall and could not be fetched: only the default printing is offered.' }) });
    await screen.findByDisplayValue('Gruul Test');
    fireEvent.click(screen.getByRole('button', { name: 'Choose the printing of Grizzly Bears' }));
    const picker = await screen.findByRole('region', { name: 'Printings of Grizzly Bears' });
    expect((await within(picker).findByRole('note')).textContent).toMatch(/only the default printing/);
    expect(within(picker).getAllByRole('button').map((b) => b.textContent)).toEqual(['Default printing the one in the card data', 'Close']);
  });
});

describe('deck-art-1: the Tokens section', () => {
  const goblin: DeckToken = { key: 'Goblin|1|1|R|Token Creature — Goblin|', name: 'Goblin', typeLine: 'Token Creature — Goblin', oracleId: 'oid-goblin-token', oracleText: '', power: '1', toughness: '1', colors: ['R'], makers: ['Grizzly Bears'] };

  it('lists the tokens the deck makes at the end, outside the card count, and saves a token\'s printing with the deck', async () => {
    const { store } = renderBuilder(deckFixture(), {
      tokens: () => ({ tokens: [goblin] }),
      printings: () => ({ oracleId: 'oid-goblin-token', name: 'Goblin', defaultId: null, printings: [{ id: 't1', set: 'tgk2', setName: 'RNA Guild Kit Tokens', number: '6', released: '2019-02-15', faces: [{}] }] }),
    });
    await screen.findByDisplayValue('Gruul Test');
    const section = await screen.findByRole('region', { name: /Tokens/ });
    expect(within(section).getByRole('listitem', { name: 'Goblin token' }).textContent).toMatch(/Creature — Goblin 1\/1.*Made by Grizzly Bears/);
    expect(screen.getByLabelText('Deck size').textContent).toMatch(/^20\/60/);
    fireEvent.click(within(section).getByRole('button', { name: 'Choose the printing of the Goblin token' }));
    fireEvent.click(await screen.findByRole('button', { name: /RNA Guild Kit Tokens \(TGK2\) 6/ }));
    await waitFor(async () => expect((await store.get('deck-1'))!.tokens).toEqual({ [goblin.key]: { oracleId: 'oid-goblin-token', name: 'Goblin', printing: { set: 'tgk2', number: '6' } } }));
    expect(within(screen.getByRole('region', { name: /Tokens/ })).getByText('(TGK2) 6')).toBeTruthy();
  });

  it('no tokens: no section', async () => {
    renderBuilder(deckFixture(), {});
    await screen.findByDisplayValue('Gruul Test');
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByRole('region', { name: /Tokens/ })).toBeNull();
  });
});
