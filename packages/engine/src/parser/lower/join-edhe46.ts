/**
 * edh-e-46 sentence joins (parser/lower/ability.ts#buildProgram). Each joins sentences that are one instruction only for exactly the shape it names, else the sentences stay as they are.
 *
 * `fogExceptWhenAdditionalPaid` (CR 615.1a, 510.1, 118.8, 608.2c; Undergrowth): "Prevent all combat damage that would be dealt this turn. If this spell's additional cost was paid, this
 * effect doesn't affect combat damage that would be dealt by red creatures.": "this effect" of the second sentence is the prevention of the first, so the two sentences are one instruction that
 * one template reads (eff.edhe46.fog.combat.exceptWhenAdditionalPaid). Joined only as that pair, exactly.
 */
import type { Tok } from '../holes/tok';

const norms = (t: readonly Tok[]): string => t.map((x) => x.norm).join(' ');
const FOG = 'prevent all combat damage that would be dealt this turn .';
const EXCEPT = /^if ~ 's additional cost was paid , this effect doesn't affect combat damage that would be dealt by [^.,]+ \.$/;

export function joinEdhE46<P extends { tokens: Tok[] }>(pieces: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!;
    const a = pieces[i + 1];
    if (a !== undefined && norms(p.tokens) === FOG && EXCEPT.test(norms(a.tokens))) {
      out.push({ ...p, tokens: [...p.tokens, ...a.tokens] });
      i++;
      continue;
    }
    out.push(p);
  }
  return out;
}
