/**
 * The saved deck (docs/design/decks-and-formats.md "Deck library"): name, format, main deck, sideboard, commander and companion slots, notes, dates and
 * an optional cover card. Cards are referenced by Oracle name and Oracle id so decks survive card-data refreshes. Pure helpers only: no storage here.
 */
import type { DeckEntry, DeckList, DeckSection, PrintingRef, TokenPrinting } from '@openmtg/server/api';

export type { DeckEntry, DeckSection, PrintingRef, TokenPrinting };

export interface Deck {
  id: string;
  name: string;
  /** Format id (formats.ts), e.g. "modern", "commander", "casual". */
  format: string;
  main: DeckEntry[];
  sideboard: DeckEntry[];
  commander: DeckEntry[];
  companion: DeckEntry[];
  notes: string;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Oracle name of the card shown for the deck in the library. */
  cover?: string;
  /**
   * deck-art-1 (additive): the printings chosen for the tokens the deck's cards make, by token image slot key. Not cards of the deck: not counted,
   * checked or exported as cards.
   */
  tokens?: Record<string, TokenPrinting>;
}

/** "(M10) 146": a printing as decklists write it. */
export function printingLabel(p: PrintingRef): string {
  if (typeof p?.set !== 'string') return '';
  return `(${p.set.toUpperCase()})${typeof p.number === 'string' && p.number ? ` ${p.number}` : ''}`;
}

/** Same printing (set codes compare in any case). */
export function samePrinting(a: PrintingRef | undefined, b: PrintingRef | undefined): boolean {
  if (!a || !b) return a === b;
  return a.set.toLowerCase() === b.set.toLowerCase() && a.number === b.number;
}

/** The printing chosen for a card: its first entry with one, sections in SECTIONS order (a game shows one picture per card name). */
export function printingOf(deck: Pick<Deck, 'main' | 'sideboard' | 'commander' | 'companion'>, name: string): PrintingRef | undefined {
  for (const s of SECTIONS) {
    const p = deck[s].find((e) => e.name === name && e.printing)?.printing;
    // A damaged saved record (not a printing) counts as none.
    if (p && typeof p.set === 'string' && p.set !== '' && typeof p.number === 'string') return p;
  }
  return undefined;
}

/** Choose a card's printing (null: the default) in every section that has the card, so the card shows one picture. Same deck when nothing changes. */
export function setPrinting(deck: Deck, name: string, printing: PrintingRef | null): Deck {
  let changed = false;
  const next = { ...deck };
  for (const s of SECTIONS) {
    if (!deck[s].some((e) => e.name === name && !samePrinting(e.printing, printing ?? undefined))) continue;
    changed = true;
    next[s] = deck[s].map((e) => {
      if (e.name !== name) return e;
      const { printing: _old, ...rest } = e;
      return printing ? { ...rest, printing: { set: printing.set.toLowerCase(), number: printing.number } } : rest;
    });
  }
  return changed ? next : deck;
}

/** Choose a token's printing (null: the default). */
export function setTokenPrinting(deck: Deck, key: string, token: TokenPrinting | null): Deck {
  const cur = deck.tokens?.[key];
  if (token ? cur && cur.oracleId === token.oracleId && samePrinting(cur.printing, token.printing) : !cur) return deck;
  const tokens = { ...(deck.tokens ?? {}) };
  if (token) tokens[key] = { oracleId: token.oracleId, name: token.name, printing: { set: token.printing.set.toLowerCase(), number: token.printing.number } };
  else delete tokens[key];
  const { tokens: _old, ...rest } = deck;
  return Object.keys(tokens).length ? { ...rest, tokens } : rest;
}

export const SECTIONS: readonly DeckSection[] = ['commander', 'companion', 'main', 'sideboard'];

export const SECTION_LABEL: Record<DeckSection, string> = {
  commander: 'Commander',
  companion: 'Companion',
  main: 'Main deck',
  sideboard: 'Sideboard',
};

/** A new id for a deck (random UUID when the browser has one). */
export function newDeckId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyDeck(name: string, format: string, now: string, id: string = newDeckId()): Deck {
  return { id, name, format, main: [], sideboard: [], commander: [], companion: [], notes: '', createdAt: now, updatedAt: now };
}

/** Number of cards in one section. */
export function sectionCount(deck: Deck, section: DeckSection): number {
  return deck[section].reduce((n, e) => n + e.count, 0);
}

/** Copies of a card in one section (0 when absent). */
export function countOf(deck: Deck, section: DeckSection, name: string): number {
  return deck[section].find((e) => e.name === name)?.count ?? 0;
}

/**
 * Add `delta` copies (negative removes) of a card to a section; entries at 0 disappear. Returns a new deck (the input is not changed). The section keeps
 * its insertion order so the list does not jump around while building.
 */
export function addCard(deck: Deck, section: DeckSection, card: { name: string; oracleId?: string; printing?: PrintingRef }, delta = 1): Deck {
  const list = deck[section];
  const i = list.findIndex((e) => e.name === card.name);
  let next: DeckEntry[];
  if (i < 0) {
    if (delta <= 0) return deck;
    // A new entry takes the printing given, else the one the card already has elsewhere in the deck (one picture per card).
    const printing = card.printing ?? printingOf(deck, card.name);
    next = [...list, { name: card.name, count: delta, ...(card.oracleId ? { oracleId: card.oracleId } : {}), ...(printing ? { printing } : {}) }];
  } else {
    const old = list[i]!;
    const count = old.count + delta;
    const entry: DeckEntry = { ...old, count, ...(card.oracleId && !old.oracleId ? { oracleId: card.oracleId } : {}) };
    next = count > 0 ? list.map((e, j) => (j === i ? entry : e)) : list.filter((_, j) => j !== i);
  }
  return { ...deck, [section]: next };
}

/** Move `count` copies (default: all) of a card from one section to another. */
export function moveCard(deck: Deck, from: DeckSection, to: DeckSection, name: string, count?: number): Deck {
  if (from === to) return deck;
  const entry = deck[from].find((e) => e.name === name);
  if (!entry) return deck;
  const n = Math.min(count ?? entry.count, entry.count);
  const card = { name, ...(entry.oracleId ? { oracleId: entry.oracleId } : {}), ...(entry.printing ? { printing: entry.printing } : {}) };
  return addCard(addCard(deck, from, card, -n), to, card, n);
}

/** Merge entries with the same name (counts add up), keeping first-seen order. */
export function mergeEntries(entries: readonly DeckEntry[]): DeckEntry[] {
  const out: DeckEntry[] = [];
  for (const e of entries) {
    const prev = out.find((o) => o.name === e.name);
    if (prev) {
      prev.count += e.count;
      if (!prev.oracleId && e.oracleId) prev.oracleId = e.oracleId;
      if (!prev.printing && e.printing) prev.printing = e.printing;
    } else out.push({ ...e });
  }
  return out;
}

/** The deck as the validation API takes it. */
export function toDeckList(deck: Deck): DeckList {
  const list: DeckList = { main: deck.main, sideboard: deck.sideboard };
  if (deck.commander.length) list.commander = deck.commander;
  if (deck.companion.length) list.companion = deck.companion;
  if (deck.tokens && Object.keys(deck.tokens).length) list.tokens = deck.tokens;
  return list;
}

/** Every distinct Oracle name in the deck, in section order. */
export function deckNames(deck: Deck): string[] {
  const seen = new Set<string>();
  for (const s of SECTIONS) for (const e of deck[s]) seen.add(e.name);
  return [...seen];
}

/** A copy under a new id and name ("Copy of ..."), with fresh dates. */
export function duplicateDeck(deck: Deck, now: string, id: string = newDeckId()): Deck {
  const copy = structuredCloneDeck(deck);
  return { ...copy, id, name: `Copy of ${deck.name}`, createdAt: now, updatedAt: now };
}

function structuredCloneDeck(deck: Deck): Deck {
  const clone = (l: DeckEntry[]) => l.map((e) => ({ ...e, ...(e.printing ? { printing: { ...e.printing } } : {}) }));
  return { ...deck, ...(deck.tokens ? { tokens: { ...deck.tokens } } : {}), main: clone(deck.main), sideboard: clone(deck.sideboard), commander: clone(deck.commander), companion: clone(deck.companion) };
}

/** Check that a value read back from storage looks like a deck (old or damaged records are skipped, never half-loaded). */
export function isDeck(v: unknown): v is Deck {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  const entries = (x: unknown) => Array.isArray(x) && x.every((e) => e && typeof e === 'object' && typeof (e as DeckEntry).name === 'string' && typeof (e as DeckEntry).count === 'number');
  return (
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    typeof d.format === 'string' &&
    entries(d.main) &&
    entries(d.sideboard) &&
    entries(d.commander) &&
    entries(d.companion) &&
    typeof d.createdAt === 'string' &&
    typeof d.updatedAt === 'string'
  );
}
