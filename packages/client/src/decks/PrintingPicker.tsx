/**
 * deck-art-1 (owner, 2026-11-07: "the deck editor needs to have the ability to pick which art/printing you want to use"): the printings of a deck card or
 * token, newest first: set name, set code and collector number, release year, artist; with small pictures only when the player turned on "Show card
 * images from Scryfall" (hot-linked from Scryfall's own image URLs through our server, aspect ratio kept, nothing drawn over them). "Default printing" is
 * the one the card data has (today's picture). The player's own uploaded image still wins over any printing (ARCHITECTURE.md "Card images").
 *
 * Offline, only the default printing is offered, with the server's note. A chosen printing the list does not have (an unknown set code from an imported
 * list) is said so: the default picture is shown.
 */
import { useEffect, useState } from 'react';
import type { PrintingRef, PrintingsResponse } from '@openmtg/server/api';
import { findPrinting, releaseYear } from '../images/printings';
import { safeScryfallUrl } from '../images/scryfall';
import { describeApiError, type DecksApi } from './context';
import { printingLabel } from './model';

export interface PrintingTarget {
  name: string;
  oracleId?: string;
  /** What the printing is of, in the heading ("card" or "token"). */
  kind: 'card' | 'token';
}

export function PrintingPicker({
  api,
  target,
  current,
  images,
  onPick,
  onClose,
}: {
  api: DecksApi;
  target: PrintingTarget;
  current: PrintingRef | undefined;
  /** The player's "Show card images from Scryfall" setting: thumbnails only when on. */
  images: boolean;
  onPick: (printing: PrintingRef | null) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'ready'; res: PrintingsResponse } | { status: 'error'; message: string }>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    api.printings({ ...(target.oracleId ? { oracleId: target.oracleId } : { name: target.name }), images }).then(
      (res) => alive && setState({ status: 'ready', res }),
      (e: unknown) => alive && setState({ status: 'error', message: describeApiError(e) }),
    );
    return () => {
      alive = false;
    };
  }, [api, target.oracleId, target.name, images]);

  const list = state.status === 'ready' ? state.res.printings : [];
  const chosen = current && list.length ? findPrinting(list, current) : undefined;
  const missing = current && state.status === 'ready' && list.length > 0 && !chosen;
  const isDefault = (id: string) => state.status === 'ready' && state.res.defaultId === id;

  return (
    <section className="printing-picker" aria-label={`Printings of ${target.name}`}>
      <h2>
        Printing of {target.name}
        {target.kind === 'token' ? ' (token)' : ''}
      </h2>
      {state.status === 'loading' && <p role="status">Looking up the printings…</p>}
      {state.status === 'error' && (
        <p role="alert" className="deck-error">
          The printings could not be read: {state.message}
        </p>
      )}
      {state.status === 'ready' && state.res.note && (
        <p className="muted printing-note" role="note">
          {state.res.note}
        </p>
      )}
      {missing && (
        <p className="printing-note" role="note">
          {printingLabel(current)} is not a printing of {target.name} that Scryfall knows: the default picture is shown.
        </p>
      )}
      <ul className={`printing-list${images ? ' with-images' : ''}`} aria-label="Printings">
        <li>
          <button type="button" className="printing-option" aria-pressed={!current} onClick={() => onPick(null)}>
            <span className="printing-text">
              <strong>Default printing</strong>
              <span className="muted"> the one in the card data</span>
            </span>
          </button>
        </li>
        {list.map((p) => {
          const thumb = images ? safeScryfallUrl(p.faces[0]?.small) ?? safeScryfallUrl(p.faces[0]?.normal) : null;
          return (
            <li key={p.id}>
              <button
                type="button"
                className="printing-option"
                aria-pressed={chosen?.id === p.id}
                onClick={() => onPick({ set: p.set, number: p.number })}
                aria-label={`${p.setName} (${p.set.toUpperCase()}) ${p.number}, ${releaseYear(p)}${p.artist ? `, illustrated by ${p.artist}` : ''}`}
              >
                {thumb && <img className="printing-thumb" src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" draggable={false} />}
                <span className="printing-text">
                  <strong>{p.setName}</strong>{' '}
                  <span className="printing-code">
                    ({p.set.toUpperCase()}) {p.number}
                  </span>
                  <span className="muted printing-meta">
                    {releaseYear(p)}
                    {p.artist ? ` · ${p.artist}` : ''}
                    {p.lang ? ` · ${p.lang}` : ''}
                    {isDefault(p.id) ? ' · default' : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="card-preview-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </p>
    </section>
  );
}
