/**
 * deck-art-1 (owner, 2026-11-07: "the deck editor gives you the option to make non legendary creature cards your commander"): the deckbuilder offers a
 * card as a commander only when the deck check would accept it there. The server answers with the cards package's own rule
 * (POST /api/decks/commander-choices, cards/formats/commander.ts canAddCommander: CR 903.3, 903.3a, 903.12c, 702.124), so the rule has one source.
 * Answers are kept per format and commander set; only names not answered yet are asked. Until an answer arrives (or when the server cannot answer)
 * a card is not offered.
 */
import { useEffect, useRef, useState } from 'react';
import type { DeckEntry } from './model';
import type { DecksApi } from './context';

const BATCH = 500;

/** `(name) => may it be added as a commander now`; always false outside a commander format. */
export function useCommanderChoices(api: DecksApi, format: string, commanderFormat: boolean, commander: readonly DeckEntry[], names: readonly string[]): (name: string) => boolean {
  const key = `${format}\n${commander.map((e) => `${e.count} ${e.oracleId ?? ''} ${e.name}`).join('\n')}`;
  const [answers, setAnswers] = useState<{ key: string; map: ReadonlyMap<string, boolean> }>({ key, map: new Map() });
  const asked = useRef<{ key: string; names: Set<string> }>({ key, names: new Set() });
  if (asked.current.key !== key) asked.current = { key, names: new Set() };
  const current = useRef(key);
  current.current = key;
  const shown = answers.key === key ? answers.map : new Map<string, boolean>();
  const namesKey = names.join('\n');
  /** Bumped a moment after a failed request, so the names are asked again. */
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!commanderFormat) return;
    const mine = asked.current;
    const todo = [...new Set(names)].filter((n) => !mine.names.has(n));
    if (!todo.length) return;
    for (const n of todo) mine.names.add(n);
    for (let i = 0; i < todo.length; i += BATCH) {
      const part = todo.slice(i, i + BATCH);
      // Not aborted when the names change (the answers are still wanted); an answer for a commander set that changed meanwhile is dropped.
      api.commanderChoices(format, commander, part).then(
        (r) => {
          if (current.current !== key) return;
          setAnswers((a) => {
            const map = new Map(a.key === key ? a.map : []);
            for (const n of part) map.set(n, r.choices[n] === true);
            return { key, map };
          });
        },
        () => {
          // Asked again shortly (or on the next change).
          for (const n of part) mine.names.delete(n);
          setTimeout(() => setRetry((r) => r + 1), 3000);
        },
      );
    }
    // `commander` and `format` are in `key`.
  }, [api, key, namesKey, commanderFormat, retry]);

  return (name) => commanderFormat && shown.get(name) === true;
}
