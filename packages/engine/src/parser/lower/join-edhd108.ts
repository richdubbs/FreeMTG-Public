/**
 * edh-d-108 sentence join (parser/lower/ability.ts#buildProgram): "Search your library for three creature cards and reveal them. If you reveal three cards with different names, choose
 * one of them at random and put that card into your hand. Shuffle the rest into your library." (Signal the Clans; CR 701.23a-b, 701.20a, 608.2d) is one instruction: the second
 * sentence tests and picks among the cards the first found, and the third shuffles the others back. The three sentences are joined, so one template reads them
 * (eff.edhd108.search.threeReveal.differentNames.randomToHand.shuffleRest). Joined only for exactly this shape (one card type word), else the sentences stay as they are.
 */
import type { Tok } from '../holes/tok';

const norms = (t: readonly Tok[]): string => t.map((x) => x.norm).join(' ');
const FIRST = /^search your library for three [a-z]+ cards and reveal them \.$/;
const SECOND = 'if you reveal three cards with different names , choose one of them at random and put that card into your hand .';
const THIRD = /^shuffle the rest into your library \.?$/;

export function joinEdhD108<P extends { tokens: Tok[] }>(pieces: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!;
    const a = pieces[i + 1];
    const b = pieces[i + 2];
    if (a !== undefined && b !== undefined && FIRST.test(norms(p.tokens)) && norms(a.tokens) === SECOND && THIRD.test(norms(b.tokens))) {
      out.push({ ...p, tokens: [...p.tokens, ...a.tokens, ...b.tokens] });
      i += 2;
      continue;
    }
    out.push(p);
  }
  return out;
}
