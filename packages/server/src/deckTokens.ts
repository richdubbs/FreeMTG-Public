/**
 * POST /api/decks/tokens { names } (deck-art-1, owner 2026-11-07: "a list of tokens at the end of the deck list that are needed for the deck"): the tokens
 * and emblems the deck's cards make, one per distinct token, with the cards that make it.
 *
 * Source: each card's Scryfall `all_parts` entries with component "token" (the local index keeps them: name and type line), matched to the token index
 * (tokens.jsonl) by name and type line. Several tokens can share a name and type line (Goblin: a plain 1/1, one that can't block, a 2/1 with haste...):
 * the maker's own rules text picks the one it describes (its P/T, its color words, and the token's rules text when it has some); a tie keeps every
 * candidate out rather than guess, and the row is left without a token (`candidates` > 1). Cards whose tokens Scryfall does not list in all_parts are
 * not covered: the engine's token definitions are compiled per game, not for a deck list, so reading them here would be neither simple nor exact.
 *
 * Each token is keyed by its image slot key (engine `oracleTokenVariantKeys`, the key an uploaded token picture binds to), which is how a token made in a
 * game is recognized for its chosen printing.
 */
import { oracleTokenVariantKeys, type OracleCard } from '@openmtg/engine';
import type { DeckTokensResponse, DeckToken } from './api';
import { cardStore, storeError, type CardStore } from './cache';
import { badRequest, type Handler } from './context';
import { colorList } from './summary';

const MAX_NAMES = 500;
const COLOR_WORDS: Record<string, string> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };

/** How well a token fits the maker's text (higher is better). */
export function tokenFit(token: OracleCard, makerText: string): number {
  const text = makerText.toLowerCase();
  let score = 0;
  if (token.power !== undefined && token.toughness !== undefined) score += text.includes(`${token.power}/${token.toughness}`.toLowerCase()) ? 2 : -1;
  const colors = token.colors ?? [];
  if (colors.length === 0) score += /\bcolorless\b/.test(text) ? 1 : 0;
  else score += colors.every((c) => text.includes(COLOR_WORDS[c] ?? '?')) ? 1 : -1;
  const own = (token.oracle_text ?? '').trim().toLowerCase();
  if (own) {
    // A keyword token ("Haste", "Flying") or a token with an ability: the maker says "with haste", or quotes the ability.
    const first = own.split('\n')[0]!.replace(/\.$/, '');
    score += text.includes(first) ? 2 : -2;
  }
  return score;
}

const makerText = (card: OracleCard): string => [card.oracle_text ?? '', ...(card.card_faces ?? []).map((f) => f.oracle_text ?? '')].join('\n');

/** The tokens the named cards make (deck order of first maker), each with its makers. */
export function deckTokens(store: CardStore, names: readonly string[]): DeckToken[] {
  const out = new Map<string, DeckToken>();
  for (const name of names) {
    const card = store.db.lookup(name);
    if (!card) continue;
    for (const part of card.all_parts ?? []) {
      if (part.component !== 'token' || part.name === card.name) continue;
      const same = store.db.lookupTokens(part.name).filter((t) => !part.type_line || t.type_line === part.type_line);
      const pool = same.length ? same : store.db.lookupTokens(part.name);
      if (!pool.length) continue;
      const text = makerText(card);
      const scored = pool.map((t) => ({ t, s: tokenFit(t, text) })).sort((a, b) => b.s - a.s);
      const best = scored[0]!;
      const tied = scored.filter((x) => x.s === best.s).length;
      const token = tied === 1 ? best.t : undefined;
      const key = token ? oracleTokenVariantKeys(token)[0] : `${part.name}\u0001${part.type_line ?? ''}`;
      if (!key) continue;
      const row = out.get(key);
      if (row) {
        if (!row.makers.includes(card.name)) row.makers.push(card.name);
        continue;
      }
      const face = token ?? best.t;
      out.set(key, {
        key,
        name: part.name,
        typeLine: part.type_line ?? face.type_line ?? '',
        ...(token ? { oracleId: token.oracle_id ?? '', oracleText: token.oracle_text ?? '', colors: colorList(token.colors ?? []) } : { oracleText: '', colors: [] }),
        ...(token?.power !== undefined ? { power: token.power } : {}),
        ...(token?.toughness !== undefined ? { toughness: token.toughness } : {}),
        ...(token ? {} : { candidates: tied }),
        makers: [card.name],
      });
    }
  }
  return [...out.values()];
}

export const postDeckTokens: Handler<'POST /api/decks/tokens'> = async (req, ctx) => {
  const b = req.body as { names?: unknown } | null;
  if (!b || typeof b !== 'object' || !Array.isArray(b.names) || b.names.length > MAX_NAMES || !b.names.every((n) => typeof n === 'string' && n.length > 0 && n.length <= 300)) {
    return badRequest(`Body must be { "names": string[] } with at most ${MAX_NAMES} card names`);
  }
  const opened = await cardStore(ctx);
  if (!opened.ok) return storeError(opened);
  const body: DeckTokensResponse = { tokens: deckTokens(opened.store, b.names as string[]) };
  return { status: 200, body };
};
