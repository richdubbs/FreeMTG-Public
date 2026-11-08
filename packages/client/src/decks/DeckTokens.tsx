/**
 * deck-art-1 (owner, 2026-11-07: "It should have a list of tokens at the end of the deck list that are needed for the deck and it should allow you to
 * pick the art as well"): the tokens and emblems the deck's cards make (POST /api/decks/tokens: Scryfall's all_parts of each card, matched to the token
 * index), one row per distinct token with the cards that make it, and a printing choice like a card's. Not cards of the deck: the section is not counted,
 * checked or exported as cards; the chosen printings are saved with the deck (`Deck.tokens`) and shown when that player's cards make the token in a game.
 */
import { useEffect, useState } from 'react';
import type { DeckToken } from '@openmtg/server/api';
import type { DecksApi } from './context';
import { printingLabel, type Deck } from './model';

/** The tokens the deck's cards make; asked again (after a short pause) when the deck's card names change. */
export function useDeckTokens(api: DecksApi, names: readonly string[], delayMs = 300): { tokens: DeckToken[]; error: boolean } {
  const [state, setState] = useState<{ tokens: DeckToken[]; error: boolean }>({ tokens: [], error: false });
  const key = [...names].sort().join('\n');
  useEffect(() => {
    if (!names.length) {
      setState({ tokens: [], error: false });
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api.tokens(names, ctrl.signal).then(
        (r) => {
          if (!ctrl.signal.aborted) setState({ tokens: r.tokens, error: false });
        },
        () => {
          if (!ctrl.signal.aborted) setState((s) => ({ ...s, error: true }));
        },
      );
    }, delayMs);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // `names` is in `key`.
  }, [api, key, delayMs]);
  return state;
}

const pt = (t: DeckToken) => (t.power !== undefined && t.toughness !== undefined ? ` ${t.power}/${t.toughness}` : '');

export function DeckTokensSection({ deck, tokens, error, onPrinting }: { deck: Deck; tokens: readonly DeckToken[]; error: boolean; onPrinting: (token: DeckToken) => void }) {
  if (!tokens.length && !error) return null;
  return (
    <section className="deck-section deck-tokens" aria-labelledby="deck-section-tokens" data-section="tokens">
      <h2 id="deck-section-tokens" tabIndex={-1}>
        Tokens <span className="count">({tokens.length})</span>
      </h2>
      <p className="muted deck-hint">Made by the deck&apos;s cards; not counted as cards of the deck.</p>
      {error && <p className="muted">The tokens could not be listed right now.</p>}
      <ul className="deck-cards">
        {tokens.map((t) => {
          const chosen = deck.tokens?.[t.key]?.printing;
          return (
            <li key={t.key} className="deck-card deck-token" aria-label={`${t.name} token`} data-token={t.key}>
              <div className="deck-card-line">
                <span className="deck-card-name card-name" title={t.oracleText || t.typeLine}>
                  {t.name}
                  <span className="muted deck-token-type">
                    {' '}
                    {t.typeLine.replace(/^Token\s+/, '')}
                    {pt(t)}
                  </span>
                </span>
                {chosen && (
                  <span className="deck-card-printing" title={`Printing ${printingLabel(chosen)}`}>
                    {printingLabel(chosen)}
                  </span>
                )}
                <span className="deck-card-actions">
                  {t.oracleId && (
                    <button type="button" className="icon-button" data-control="printing" onClick={() => onPrinting(t)} aria-label={`Choose the printing of the ${t.name} token`} title="Choose printing (art)">
                      Art
                    </button>
                  )}
                </span>
              </div>
              <p className="muted deck-token-makers">Made by {t.makers.join(', ')}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
