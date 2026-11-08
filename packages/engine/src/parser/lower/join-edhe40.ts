/**
 * edh-e-40 sentence joins (parser/lower/ability.ts#buildProgram). Each joins sentences that are one instruction only for exactly the shape it names, else the sentences stay as they are.
 *
 * `lookExileOneRestBack` (CR 701.20e, 401.4, 406.1, 608.2c; Sealed Fate): "Look at the top X cards of target opponent's library. Exile one of those cards and put the rest back on top of that
 * player's library in any order.": "that player" is the owner of the library looked at, which only the first sentence names (eff.edhe40.look.exileOne.restBackTop).
 *
 * `lookThatLibraryMayExileRestBack` (CR 701.20e, 401.4, 406.1, 608.2c; Psychic Surgery): "you may look at the top two cards of that library. You may exile one of those cards. Then put the rest on
 * top of that library in any order." (the three sentences after the trigger clause, one instruction about the library of the player who shuffled; eff.edhe40.look.thatLibrary.mayExileOne.restTop).
 *
 * `chooseTypeRevealHandDamage` (CR 608.2d, 607.2d, 701.20a, 120.3; Blood Oath): "Choose a card type. Target opponent reveals their hand. ~ deals 3 damage to that player for each card of the chosen type revealed
 * this way.": the three sentences are one instruction ("that player" and "revealed this way" read the reveal of the second; eff.edhe40.chooseType.revealHand.damagePerChosen).
 */
import type { Tok } from '../holes/tok';


const norms = (t: readonly Tok[]): string => t.map((x) => x.norm).join(' ');
const LOOK = /(^|, )look at the top \S+( cards?)? of [^.]* library \.$/;
const EXILE_ONE_REST_BACK = "exile one of those cards and put the rest back on top of that player 's library in any order .";
const THAT_LIBRARY_LOOK = /^(whenever [^.]*, )?you may look at the top \S+ cards of that library \.$/;
const MAY_EXILE = 'you may exile one of those cards .';
const THEN_REST_TOP = 'then put the rest on top of that library in any order .';

const CHOOSE_TYPE = 'choose a card type .';
const REVEAL_HAND = /^target (opponent|player) reveals their hand \.$/;
const DAMAGE_PER_CHOSEN = /^~ deals \S+ damage to that player for each card of the chosen type revealed this way \.$/;

export function joinEdhE40<P extends { tokens: Tok[] }>(pieces: readonly P[]): P[] {
  const out: P[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i]!;
    const a = pieces[i + 1];
    const b = pieces[i + 2];
    if (a !== undefined && LOOK.test(norms(p.tokens)) && norms(a.tokens) === EXILE_ONE_REST_BACK) {
      out.push({ ...p, tokens: [...p.tokens, ...a.tokens] });
      i++;
      continue;
    }
    if (a !== undefined && b !== undefined && THAT_LIBRARY_LOOK.test(norms(p.tokens)) && norms(a.tokens) === MAY_EXILE && norms(b.tokens) === THEN_REST_TOP) {
      out.push({ ...p, tokens: [...p.tokens, ...a.tokens, ...b.tokens] });
      i += 2;
      continue;
    }
    if (a !== undefined && b !== undefined && norms(p.tokens) === CHOOSE_TYPE && REVEAL_HAND.test(norms(a.tokens)) && DAMAGE_PER_CHOSEN.test(norms(b.tokens))) {
      out.push({ ...p, tokens: [...p.tokens, ...a.tokens, ...b.tokens] });
      i += 2;
      continue;
    }
    out.push(p);
  }
  return out;
}
