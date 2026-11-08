/**
 * deck-art-1: each player's chosen printings in a game (owner, 2026-11-07: the chosen printing's picture is shown "in games for that player's copies").
 * Built from the decks the players chose on New game, like their sleeves, and read by the board's card picture by the card's owner (CR 108.3; a token's
 * owner is the player who created it, CR 111.2). Cards are matched by Oracle name, tokens by image slot key (cards/pool.ts imageSlots), so a token made
 * in the game shows the printing its creator's deck chose. Pictures only: nothing here reaches the rules.
 */
import { createContext, useContext } from 'react';
import type { PlayerId } from '@openmtg/engine';
import type { DeckList, PrintingRef } from '@openmtg/server/api';
import type { CardModel } from '../cards/model';
import { isPrintingRef, printedKey, withPrinting } from '../images/printings';

export interface SeatPrintings {
  cards: Readonly<Record<string, PrintingRef>>;
  /** By token image slot key: the printing and the token's Oracle id (its printings are looked up by it). */
  tokens: Readonly<Record<string, { printing: PrintingRef; oracleId: string }>>;
}
export type GamePrintings = Readonly<Partial<Record<PlayerId, SeatPrintings>>>;

export const GamePrintingsContext = createContext<GamePrintings>({});

/** A deck's chosen printings (null when it chose none). */
export function seatPrintings(deck: DeckList): SeatPrintings | null {
  const cards: Record<string, PrintingRef> = {};
  for (const list of [deck.main, deck.sideboard, deck.commander ?? [], deck.companion ?? []]) for (const e of list) if (isPrintingRef(e.printing) && !cards[e.name]) cards[e.name] = e.printing;
  const tokens: Record<string, { printing: PrintingRef; oracleId: string }> = {};
  for (const [key, t] of Object.entries(deck.tokens ?? {})) if (isPrintingRef(t?.printing)) tokens[key] = { printing: t.printing, oracleId: t.oracleId };
  return Object.keys(cards).length || Object.keys(tokens).length ? { cards, tokens } : null;
}

/** The printing a card shows for its owner (with the Oracle id it is looked up by, for a token): a token by its image slot, any other card by name. */
export function chosenFor(printings: GamePrintings, owner: PlayerId | undefined, model: CardModel): { printing: PrintingRef; oracleId?: string } | undefined {
  const seat = owner ? printings[owner] : undefined;
  if (!seat) return undefined;
  if (model.isToken) {
    for (const s of model.slots) if (seat.tokens[s.key]) return seat.tokens[s.key];
    return undefined;
  }
  const p = seat.cards[model.name];
  return p ? { printing: p } : undefined;
}

export function printingFor(printings: GamePrintings, owner: PlayerId | undefined, model: CardModel): PrintingRef | undefined {
  return chosenFor(printings, owner, model)?.printing;
}

/** The card's model in its owner's chosen printing (the same model when none is chosen). */
export function useOwnerPrinting(model: CardModel | null, owner: PlayerId | undefined): CardModel | null {
  const printings = useContext(GamePrintingsContext);
  const chosen = model ? chosenFor(printings, owner, model) : undefined;
  return model ? withPrinting(model, chosen?.printing, chosen?.oracleId) : null;
}

/** The picture look-up keys a card may show in this game: each seat's chosen printing, and the default picture (a seat without a choice). */
export function pictureKeysInGame(printings: GamePrintings, model: CardModel): string[] {
  const keys = new Set<string>([model.name]);
  for (const seat of Object.keys(printings) as PlayerId[]) {
    const chosen = chosenFor(printings, seat, model);
    if (chosen) keys.add(printedKey(model.name, chosen.printing, chosen.oracleId));
  }
  return [...keys];
}
