/**
 * edh-e-6 sentence joins (parser/lower/ability.ts#buildProgram). Each joins sentences that are one instruction only for exactly their shape; anything else stays as it is.
 *
 * `joinEdhE6RevealOpponentMayGive` (CR 608.2c, 608.2d, 701.20a; Covenant of Minds): "Reveal the top three cards of your library. Target opponent may choose to put those cards into
 * your hand. If they don't, put those cards into your graveyard and draw five cards.": "those cards" are the cards revealed and "they" the opponent who was offered them, so the three
 * sentences are joined and one template reads them (eff.edhe6.reveal.opponentMayGiveHand.elseGraveyardDraw).
 *
 * `joinEdhE6OpponentChoosesTopTwo` (CR 608.2c, 608.2d, 404.1; Phyrexian Grimoire): "Target opponent chooses one of the top two cards of your graveyard. Exile that card and put the other
 * into your hand.": "that card" is the card the opponent chose and "the other" the one they left, so the two sentences are joined and one template reads them
 * (eff.edhe6.opponentChoosesTopTwoGraveyard.exileChosenOtherHand).
 */
import type { Tok } from '../holes/tok';

const norms = (t: readonly Tok[]): string => t.map((x) => x.norm).join(' ');
const REVEAL = /^reveal the top \S+ cards of your library \.$/;
const OFFER = /^target opponent may choose to put those cards into your hand \.$/;
const ELSE = /^if they don't , put those cards into your graveyard and draw \S+ cards \.$/;

export function joinEdhE6RevealOpponentMayGive<P extends { tokens: Tok[] }>(pieces: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!;
    const [a, b] = [pieces[i + 1], pieces[i + 2]];
    if (a !== undefined && b !== undefined && REVEAL.test(norms(p.tokens)) && OFFER.test(norms(a.tokens)) && ELSE.test(norms(b.tokens))) {
      out.push({ ...p, tokens: [...p.tokens, ...a.tokens, ...b.tokens] });
      i += 2;
      continue;
    }
    out.push(p);
  }
  return out;
}

const CHOOSE_TOP_TWO = /^target opponent chooses one of the top two cards of your graveyard \.$/;
const EXILE_OTHER_HAND = 'exile that card and put the other one into your hand .';

export function joinEdhE6OpponentChoosesTopTwo<P extends { tokens: Tok[] }>(pieces: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!;
    const a = pieces[i + 1];
    if (a !== undefined && CHOOSE_TOP_TWO.test(norms(p.tokens)) && norms(a.tokens) === EXILE_OTHER_HAND) {
      out.push({ ...p, tokens: [...p.tokens, ...a.tokens] });
      i += 1;
      continue;
    }
    out.push(p);
  }
  return out;
}
