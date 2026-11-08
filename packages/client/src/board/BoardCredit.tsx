/**
 * The artist credit line under a large card picture on the board (the zoom, the stage overlays, the zone viewers): "Illustrated by <artist>" for a Scryfall
 * picture, from the board's `useArtist` (GameBoardProps), drawn by the card component's shared line (cards/ArtistCredit.tsx).
 * Nothing for uploaded images, our own frames and card backs. Always outside the picture, never on it.
 */
import type { CardDef, PlayerId } from '@openmtg/engine';
import { ArtistCredit } from '../cards';
import { useBoard } from './context';

export function BoardCredit({ def, face, className, owner }: { def: CardDef | null; face: number; className?: string; owner?: PlayerId }) {
  const { useArtist } = useBoard();
  const artist = useArtist(def, face, owner);
  return <ArtistCredit artist={artist} {...(className ? { className } : {})} />;
}
