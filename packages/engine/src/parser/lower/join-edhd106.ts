/**
 * edh-d-106 sentence join (parser/lower/ability.ts#buildProgram): "For each opponent, choose up to one target creature that player controls. ~ deals X damage to each of those creatures."
 * (Shellshock) and "... ~ deals damage equal to <quantity> to each of the chosen creatures." (Mega Flare) are one instruction (CR 115.1, 601.2c, 608.2c): the second sentence deals the
 * damage to the targets the first only announced, the same as "For each opponent, ~ deals X damage to up to one target creature that player controls." (eff.r5fxb.forEachOpponent.damage).
 * The two sentences are joined, so one template reads them (eff.edhd106.eachOpp.chooseTarget.damageEach). Joined only for exactly this shape, else the sentences stay as they are.
 */
import type { Tok } from '../holes/tok';

const norms = (t: readonly Tok[]): string => t.map((x) => x.norm).join(' ');
const FIRST = /^for each opponent , choose up to one target [a-z ]+ that player controls \.$/;
const SECOND = /^~ deals .+ damage to each of (?:those|the chosen) creatures \.$|^~ deals damage equal to .+ to each of (?:those|the chosen) creatures \.$/;

/**
 * edh-d-106 (CR 111.1, 508.1d, 611.2a; Furygale Flocking): "For each opponent, create two 3/3 ... tokens with flying that attack that opponent this turn if able. They gain haste until end of
 * turn.": the second sentence gives haste to the tokens the first created for every opponent, so the two are read together (eff.edhd106.eachOpp.createAttackThatOpponent.haste).
 */
const TOKENS_ATTACK = /^for each opponent , create .+ tokens? .*that attacks? that opponent this turn if able \.$/;
const THEY_HASTE = /^(?:they gain|it gains) haste until end of turn \.$/;

/**
 * edh-d-106 (CR 111.1, 122.1b, 608.2c; Invoke the Ancients): "Create two 4/5 green Spirit creature tokens. For each of them, put your choice of a reach counter, a vigilance counter, or a
 * trample counter on it.": "them" are the tokens the first sentence created, so the two are read together (eff.edhd106.createThenEachChoiceOfThreeCounters).
 */
const CREATE_TOKENS = /^create (?:two|three|four|\d+) .+ tokens \.$/;
const EACH_CHOICE = /^for each of them , put your choice of an? [a-z+\/-]+ counter , an? [a-z+\/-]+ counter , or an? [a-z+\/-]+ counter on it \.$/;

export function joinEdhD106<P extends { tokens: Tok[] }>(pieces: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!;
    const a = pieces[i + 1];
    if (a !== undefined && ((FIRST.test(norms(p.tokens)) && SECOND.test(norms(a.tokens))) || (TOKENS_ATTACK.test(norms(p.tokens)) && THEY_HASTE.test(norms(a.tokens))) || (CREATE_TOKENS.test(norms(p.tokens)) && EACH_CHOICE.test(norms(a.tokens))))) {
      out.push({ ...p, tokens: [...p.tokens, ...a.tokens] });
      i += 1;
      continue;
    }
    out.push(p);
  }
  return out;
}
