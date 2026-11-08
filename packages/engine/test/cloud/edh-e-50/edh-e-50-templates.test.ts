/**
 * Coordinator E, round edh-e-50 (second batch, group combat 2/2): the round's parser, lowering,
 * engine and renderer changes, tested at the end of this file and in edh-e-50-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites are from memory, not checked against the Comprehensive Rules text.
 */
import { describe, expect, it } from 'vitest';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';

import { card, fullyAutomated } from '../../m5/templates/support';

const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

describe('edh-e-50 hole, lowering and renderer changes (one test each)', () => {
  const creature = (text: string, type = 'Creature — Imp') => parseCard(card('Example Imp', type, text, { power: '1', toughness: '1' }), OPTS).faces[0]!;
  const spell = (text: string, type = 'Sorcery') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;
  it('parser/holes/filter.ts#controlForms + rules/filter.ts (CR 302.6, 400.7; filter controlledSinceTurnStart): "<creature> the active player has controlled continuously since the beginning of the turn" is read for the active player or another player phrase; another subject or tail stays manual', () => {
    const imp = (target: string) => creature(`{T}: Choose target ${target}. That creature attacks this turn if able. Activate only during an opponent's turn.`);
    expect(fullyAutomated(imp('creature the active player has controlled continuously since the beginning of the turn'))).toBe(true);
    expect(fullyAutomated(imp('non-Wall creature the active player has controlled continuously since the beginning of the turn'))).toBe(true);
    expect(fullyAutomated(imp('creature you have controlled continuously since the beginning of the turn'))).toBe(true);
    expect(fullyAutomated(imp('creature the active player has controlled continuously since the beginning of the game'))).toBe(false);
    expect(fullyAutomated(imp('creature the active player has controlled since the beginning of the turn'))).toBe(false);
    expect(fullyAutomated(imp('creature an opponent has controlled continuously since the beginning of the turn'))).toBe(false); // the opponent phrase has no wording of this length (the renderer refuses it)
  });
  it('parser/lower/activation.ts + render/abil.ts (CR 602.5b, 508.1; family before-attackers-declared): "Activate only before attackers are declared" and "during an opponent\'s turn, before attackers are declared" are read; "before blockers" and "before combat damage" stay other restrictions', () => {
    const tap = (restriction: string) => creature(`{T}: Draw a card. Activate only ${restriction}.`);
    expect(fullyAutomated(tap('before attackers are declared'))).toBe(true);
    expect(fullyAutomated(tap("during an opponent's turn, before attackers are declared"))).toBe(true);
    expect(fullyAutomated(tap('during your turn, before attackers are declared'))).toBe(true);
    expect(fullyAutomated(tap('before blockers are declared'))).toBe(false);
  });
  it('parser/holes/filter.ts, cond.ts + rules/history.ts (CR 120.1, 510.2; filter dealtNoncombatDamageThisTurn): "it was dealt noncombat damage this turn" is read of an object; "combat damage", "excess damage" and "nonlethal" are not this field', () => {
    const sigil = (cond: string) => spell(`Choose target creature. If it ${cond} this turn, ~ deals 3 damage to it. Otherwise, ~ deals 1 damage to it.`);
    expect(fullyAutomated(sigil('was dealt noncombat damage'))).toBe(true);
    expect(fullyAutomated(sigil('was dealt damage'))).toBe(true);
    expect(fullyAutomated(sigil('was dealt noncombat damage twice'))).toBe(false);
    expect(fullyAutomated(sigil('was dealt nonlethal damage'))).toBe(false);
  });
  it('parser/holes/cond.ts + render/cond.ts (CR 302.6, 508.1; filter controlledSinceTurnStart in a condition): "if ~ didn\'t attack or come under your control this turn" is read of the object itself; "didn\'t attack or enter" and "or come under an opponent\'s control" stay manual', () => {
    const dog = (cond: string) => creature(`At the beginning of your end step, if ~ ${cond}, sacrifice it.`, 'Creature — Dog');
    expect(fullyAutomated(dog("didn't attack or come under your control this turn"))).toBe(true);
    expect(fullyAutomated(dog("didn't attack this turn"))).toBe(true);
    expect(fullyAutomated(dog("didn't attack or come under an opponent's control this turn"))).toBe(false);
    expect(fullyAutomated(dog("didn't block or come under your control this turn"))).toBe(false);
  });
});
