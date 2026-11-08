/**
 * edhe7 (CR 404.1, 404.2, 400.3, 113.6m; Nether Spirit, Death Spark, Krovikan Horror, Nether Shadow): where a card sits in its owner's graveyard. A graveyard is kept in order
 * (`GameState.zones.graveyard`, the last card is the top, CR 404.2). The condition `{cond:'graveyardPos'}` is false unless the object is a card in a graveyard now (a card that left
 * it is a new object, CR 400.7).
 */
import type { GameState } from '../types/state';
import type { ObjectId } from '../types/ids';
import type { GameObject } from '../types/state';

export interface GraveyardPosCond { mode: 'only' | 'directlyAbove' | 'above'; atLeast?: number }

/** `matches` tells whether a card of that graveyard fits the condition's filter. */
export function graveyardPosHolds(s: GameState, selfId: ObjectId, c: GraveyardPosCond, matches: (o: GameObject) => boolean): boolean {
  const self = s.objects[selfId];
  if (self === undefined || self.zone !== 'graveyard') return false;
  const gy = s.zones.graveyard[self.owner] ?? [];
  const at = gy.indexOf(selfId);
  if (at < 0) return false;
  const card = (id: ObjectId): GameObject | undefined => s.objects[id];
  switch (c.mode) {
    case 'only':
      return matches(self) && gy.every((id) => id === selfId || !(card(id) !== undefined && matches(card(id)!)));
    case 'directlyAbove': {
      const above = gy[at + 1];
      const o = above === undefined ? undefined : card(above);
      return o !== undefined && matches(o);
    }
    case 'above': {
      const need = c.atLeast ?? 1;
      let n = 0;
      for (const id of gy.slice(at + 1)) { const o = card(id); if (o !== undefined && matches(o)) n++; }
      return n >= need;
    }
  }
}
