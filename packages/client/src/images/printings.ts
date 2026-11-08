/**
 * deck-art-1: a deck's chosen printing of a card or token ("(SET) number") and the picture it shows. The printings and their Scryfall image URLs come
 * from our own server (GET /api/printings, which asks Scryfall's API); the client never calls api.scryfall.com. URL strings only, kept in memory.
 *
 * The picture look-up of a card with a chosen printing is keyed by name + printing (`printedKey`), so "a card keeps its picture when it changes zones"
 * (ARCHITECTURE.md) holds per printing; a printing the list does not have (an unknown set code from an imported list) shows the default picture.
 */
import type { PrintingRef, Printing, PrintingsResponse } from '@openmtg/server/api';
import { apiGet } from '../api/http';
import type { CardModel } from '../cards/model';

export type { Printing, PrintingRef, PrintingsResponse };

const SEP = '\u0001';

/**
 * The look-up key of a card's picture: its name, plus the printing when one is chosen, plus the Oracle id when known (a token's: token names are not
 * unique, so its printings are looked up by Oracle id).
 */
export function printedKey(name: string, printing: PrintingRef | undefined, oracleId?: string): string {
  return printing ? `${name}${SEP}${printing.set.toLowerCase()}${SEP}${printing.number}${oracleId ? `${SEP}${oracleId}` : ''}` : name;
}

/** The name, printing and Oracle id in a look-up key. */
export function parsePrintedKey(key: string): { name: string; printing?: PrintingRef; oracleId?: string } {
  const [name = key, set, number, oracleId] = key.split(SEP);
  return set !== undefined ? { name, printing: { set, number: number ?? '' }, ...(oracleId ? { oracleId } : {}) } : { name };
}

/** A printing reference with the right shape (a damaged saved deck may hold anything). */
export function isPrintingRef(p: unknown): p is PrintingRef {
  return typeof p === 'object' && p !== null && typeof (p as PrintingRef).set === 'string' && (p as PrintingRef).set !== '' && typeof (p as PrintingRef).number === 'string';
}

/** The printing a reference names in a list: same set (any case) and number; a reference without a number takes the set's first printing listed. */
export function findPrinting(list: readonly Printing[], ref: PrintingRef): Printing | undefined {
  const set = ref.set.toLowerCase();
  return list.find((p) => p.set === set && (ref.number === '' || p.number.toLowerCase() === ref.number.toLowerCase()));
}

/** The printing's year, for the picker. */
export const releaseYear = (p: Printing): string => p.released.slice(0, 4);

export type PrintingsLookup = (q: { oracleId?: string; name?: string; images: boolean }) => Promise<PrintingsResponse>;

export const fetchPrintings: PrintingsLookup = ({ oracleId, name, images }) =>
  apiGet('GET /api/printings', { query: { ...(oracleId ? { oracleId } : name ? { name } : {}), ...(images ? { images: 1 as const } : {}) } });

/** Printing lists by card, for the page's life (a failed request is asked again next time). */
export class PrintingsCache {
  private readonly cache = new Map<string, Promise<PrintingsResponse>>();
  constructor(private readonly lookup: PrintingsLookup = fetchPrintings) {}

  get(q: { oracleId?: string; name?: string; images: boolean }): Promise<PrintingsResponse> {
    const key = `${q.images ? 'i' : 't'}${SEP}${q.oracleId ?? ''}${SEP}${q.name ?? ''}`;
    let p = this.cache.get(key);
    if (!p) {
      p = this.lookup(q);
      const mine = p;
      // A failure, or an offline answer (no list, a note), is asked again next time: the internet may be back.
      p.then(
        (r) => {
          if (!r.printings.length && r.note && this.cache.get(key) === mine) this.cache.delete(key);
        },
        () => {
          if (this.cache.get(key) === mine) this.cache.delete(key);
        },
      );
      this.cache.set(key, p);
    }
    return p;
  }
}

export const pagePrintings = new PrintingsCache();

const printedModels = new WeakMap<CardModel, Map<string, CardModel>>();

/**
 * The model of a card shown in a chosen printing: the same card, the printing named, its own image URLs left out (they are the default printing's), so
 * its picture is looked up by name + printing. The same object for the same card and printing (CardPicture is memoized by its props).
 */
export function withPrinting(model: CardModel, printing: PrintingRef | undefined, oracleId?: string): CardModel {
  if (!isPrintingRef(printing)) return model;
  const key = printedKey('', printing, oracleId);
  let byKey = printedModels.get(model);
  if (!byKey) printedModels.set(model, (byKey = new Map()));
  let m = byKey.get(key);
  if (!m) {
    m = { ...model, printing: { set: printing.set.toLowerCase(), number: printing.number }, ...(oracleId ? { printingOracleId: oracleId } : {}), faces: model.faces.map(({ imageUris: _uris, ...f }) => f) };
    byKey.set(key, m);
  }
  return m;
}
