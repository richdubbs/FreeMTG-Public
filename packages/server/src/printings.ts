/**
 * GET /api/printings?oracleId=&name=&images=1 (deck-art-1, owner 2026-11-07: "the deck editor needs to have the ability to pick which art/printing you
 * want to use"): every printing of a card or token, newest first, for the deckbuilder's printing picker. The local index keeps one printing per Oracle
 * card (Scryfall's oracle-cards file), so the printings come from Scryfall's API through this server (the client never calls api.scryfall.com):
 * `/cards/search?q=oracleid:<id>&unique=prints&order=released`, every page (next_page), through the cards package's ScryfallClient, which sends an
 * identifying User-Agent and Accept header and spaces search requests 600 ms apart (stricter than Scryfall's limits), one queue per process.
 *
 * Only printing metadata and image URL strings are kept, in memory, for the server's run. Image URLs are Scryfall's own `image_uris` (never built by
 * hand), https on *.scryfall.io only (the CSP's img-src), and only sent with `images=1` (the player turned on "Show card images from Scryfall").
 * Offline (or when Scryfall refuses), the answer is the default printing only (the one the local index has: `printings` empty) with a note.
 */
import { ScryfallClient, ScryfallHttpError } from '@openmtg/cards';
import type { OracleCard } from '@openmtg/engine';
import type { ImageUris, Printing, PrintingsResponse } from './api';
import { cardStore, storeError, type CardStore } from './cache';
import { badRequest, type Handler, type ServerContext } from './context';

const API = 'https://api.scryfall.com';
/** At most this many result pages (175 printings each) per card: no card has nearly that many. */
const MAX_PAGES = 10;

interface ScryfallImageUris {
  small?: string;
  normal?: string;
  large?: string;
}
interface ScryfallPrint {
  id?: string;
  set?: string;
  set_name?: string;
  collector_number?: string;
  released_at?: string;
  artist?: string;
  lang?: string;
  image_uris?: ScryfallImageUris;
  card_faces?: { artist?: string; image_uris?: ScryfallImageUris }[];
}
interface ScryfallPage {
  data?: ScryfallPrint[];
  has_more?: boolean;
  next_page?: string;
}

/** An https URL on Scryfall's image host, else undefined (the CSP's img-src allows *.scryfall.io only). */
export function scryfallImageUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'scryfall.io' || u.hostname.endsWith('.scryfall.io')) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function imageUris(uris: ScryfallImageUris | undefined, artist: string | undefined): ImageUris | undefined {
  if (!uris) return undefined;
  const out: ImageUris = {};
  const small = scryfallImageUrl(uris.small);
  const normal = scryfallImageUrl(uris.normal);
  const large = scryfallImageUrl(uris.large);
  if (small) out.small = small;
  if (normal) out.normal = normal;
  if (large) out.large = large;
  if (!normal && !large) return undefined;
  if (artist) out.artist = artist;
  return out;
}

/** One Scryfall print -> our Printing (with its pictures per printed side), or null when it lacks what a printing needs. */
export function printingOf(p: ScryfallPrint): Printing | null {
  if (typeof p.id !== 'string' || typeof p.set !== 'string' || typeof p.collector_number !== 'string') return null;
  const faces = p.image_uris ? [imageUris(p.image_uris, p.artist)] : (p.card_faces ?? []).map((f) => imageUris(f.image_uris, f.artist ?? p.artist));
  const artist = p.artist ?? p.card_faces?.find((f) => f.artist)?.artist;
  return {
    id: p.id,
    set: p.set.toLowerCase(),
    setName: p.set_name ?? p.set.toUpperCase(),
    number: p.collector_number,
    released: p.released_at ?? '',
    ...(artist ? { artist } : {}),
    ...(p.lang && p.lang !== 'en' ? { lang: p.lang } : {}),
    faces: faces.map((f) => f ?? {}),
  };
}

/** The Scryfall card id in an image URL (…/front/8/2/<id>.jpg): the index's own printing, so the picker can mark it. */
export function printingIdOfImage(url: string | undefined): string | null {
  const m = url ? /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(?:jpg|png)/i.exec(url) : null;
  return m ? m[1]!.toLowerCase() : null;
}

/** Printing lists by Oracle id, kept in memory for the server's run (a failed fetch is not kept: the next request tries again). */
export class PrintingLists {
  private readonly lists = new Map<string, Promise<Printing[]>>();
  constructor(private readonly client: ScryfallClient) {}

  get(oracleId: string, token: boolean): Promise<Printing[]> {
    let p = this.lists.get(oracleId);
    if (!p) {
      p = this.fetch(oracleId, token);
      p.catch(() => {
        if (this.lists.get(oracleId) === p) this.lists.delete(oracleId);
      });
      this.lists.set(oracleId, p);
    }
    return p;
  }

  private async fetch(oracleId: string, token: boolean): Promise<Printing[]> {
    const out: Printing[] = [];
    // Tokens are "extras" to Scryfall's search; for game cards the extras are other Oracle cards anyway.
    let url: string | undefined = `${API}/cards/search?q=${encodeURIComponent(`oracleid:${oracleId}`)}&unique=prints&order=released${token ? '&include_extras=true' : ''}`;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      let r: ScryfallPage;
      try {
        r = await this.client.getJson<ScryfallPage>(url);
      } catch (e) {
        if (e instanceof ScryfallHttpError && e.status === 404) break; // no printings
        throw e;
      }
      for (const p of r.data ?? []) {
        const printing = printingOf(p);
        if (printing) out.push(printing);
      }
      // Only Scryfall's own next page, on its API host.
      url = r.has_more && typeof r.next_page === 'string' && r.next_page.startsWith(`${API}/`) ? r.next_page : undefined;
    }
    return out;
  }
}

/** The Scryfall API client shared by the server's API look-ups (set lists, printings): one request queue, so the rate limits hold across them. */
let sharedClient: ScryfallClient | null = null;
export function scryfallClientOf(ctx: ServerContext): ScryfallClient {
  if (ctx.scryfall) return ctx.scryfall;
  sharedClient ??= new ScryfallClient();
  return sharedClient;
}

const byClient = new WeakMap<ScryfallClient, PrintingLists>();
export function printingLists(ctx: ServerContext): PrintingLists {
  const client = scryfallClientOf(ctx);
  let lists = byClient.get(client);
  if (!lists) byClient.set(client, (lists = new PrintingLists(client)));
  return lists;
}

/** The card or token a request names: by Oracle id (cards, then tokens), else by name (cards, then the one token of that name). */
export function findPrinted(store: CardStore, oracleId: string | undefined, name: string | undefined): { card: OracleCard; token: boolean } | null {
  if (oracleId) {
    const card = store.byOracleId(oracleId);
    if (card) return { card, token: false };
    const token = store.db.allTokens().find((t) => t.oracle_id === oracleId);
    if (token) return { card: token, token: true };
  }
  if (name) {
    const card = store.db.lookup(name);
    if (card && card.layout !== 'token' && card.layout !== 'emblem') return { card, token: false };
    const tokens = store.db.lookupTokens(name);
    if (tokens.length === 1) return { card: tokens[0]!, token: true };
  }
  return null;
}

const oracleIdOf = (card: OracleCard): string | undefined => card.oracle_id ?? (card.card_faces?.[0] as { oracle_id?: string } | undefined)?.oracle_id;

/** Without `images`, the answer carries no image URLs (the player has not opted into Scryfall images). */
export function withoutImages(p: Printing): Printing {
  return { ...p, faces: p.faces.map(() => ({})) };
}

export const getPrintings: Handler<'GET /api/printings'> = async (req, ctx) => {
  const oracleId = typeof req.query.oracleId === 'string' ? req.query.oracleId.trim() : undefined;
  const name = typeof req.query.name === 'string' ? req.query.name.trim() : undefined;
  if (!oracleId && !name) return badRequest('oracleId or name is required');
  if ((oracleId && !/^[0-9a-f-]{36}$/i.test(oracleId)) || (name && name.length > 300)) return badRequest('oracleId must be a Scryfall Oracle id; name at most 300 characters');
  const images = String(req.query.images ?? '') === '1';
  const opened = await cardStore(ctx);
  if (!opened.ok) return storeError(opened);
  const found = findPrinted(opened.store, oracleId, name);
  if (!found) return { status: 404, body: { error: `No card or token ${oracleId ? `with Oracle id ${oracleId}` : `named "${name}"`} in the local index` } };
  const id = oracleIdOf(found.card);
  const indexImage = found.card.image_uris?.normal ?? found.card.card_faces?.find((f) => f.image_uris?.normal)?.image_uris?.normal;
  const body: PrintingsResponse = { oracleId: id ?? '', name: found.card.name, defaultId: printingIdOfImage(indexImage), printings: [] };
  if (!id) return { status: 200, body: { ...body, note: 'This card has no Oracle id in the card data: only its default printing can be shown.' } };
  try {
    const list = await printingLists(ctx).get(id, found.token);
    body.printings = images ? list : list.map(withoutImages);
  } catch (e) {
    body.note = `The other printings come from Scryfall and could not be fetched (${e instanceof Error ? e.message : String(e)}): only the default printing is offered.`;
  }
  return { status: 200, body };
};
