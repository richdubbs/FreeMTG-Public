/**
 * edh-d-110 sentence join (parser/lower/ability.ts#buildProgram; CR 608.2c, 608.2h, 701.20a, 120.3; Goblin Charbelcher, ruling 2004-10-04): "Reveal cards from the top of your
 * library until you reveal a land card. ~ deals damage equal to the number of nonland cards revealed this way to any target. If the revealed land card was a Mountain, ~ deals double
 * that damage instead. Put the revealed cards on the bottom of your library in any order." is one instruction: "instead" replaces the damage of the sentence before it, and both
 * read the cards the first sentence revealed, so the four sentences are joined and one template reads them
 * (eff.edhd110.revealUntilLand.damageNonland.doubleIfMountain.bottomAnyOrder). Joined only for exactly this shape, else the sentences stay as they are.
 */
import type { Tok } from '../holes/tok';

const norms = (t: readonly Tok[]): string => t.map((x) => x.norm).join(' ');
const SHAPE: readonly RegExp[] = [
  /^reveal cards from the top of your library until you reveal a land card \.$/,
  /^~ deals damage equal to the number of nonland cards revealed this way to any target \.$/,
  /^if the revealed land card was a mountain , ~ deals double that damage instead \.$/,
  /^put the revealed cards on the bottom of your library in any order \.$/,
];

export function joinEdhD110<P extends { tokens: Tok[] }>(pieces: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const run = pieces.slice(i, i + SHAPE.length);
    if (run.length === SHAPE.length && run.every((p, k) => SHAPE[k]!.test(norms(p.tokens)))) {
      out.push({ ...run[0]!, tokens: run.flatMap((p) => p.tokens) });
      i += SHAPE.length - 1;
      continue;
    }
    out.push(pieces[i]!);
  }
  return out;
}
