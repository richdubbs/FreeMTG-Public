/**
 * Commander coordinator E, round edh-e-15 (counters 3/3): the hole readings, lowering and renderer changes of the round (no template file), played in edh-e-15-scenarios.test.ts.
 * CR cites from memory (no rules/cr in the cloud session): unverified.
 */
import { describe, expect, it } from 'vitest';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import { card, fullyAutomated } from '../../m5/templates/support';

const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES });
const compiled = (type: string, text: string) => parseCard(card('Example Relic', type, text, type.includes('Creature') ? { power: '2', toughness: '2' } : {}), OPTS).faces[0]!;

describe('edh-e-15: the hole readings, lowering and renderer changes (one test each)', () => {
  const steps = (f: ReturnType<typeof compiled>): string => JSON.stringify(f.abilities);
  it('holes/cond.ts: "no counters were removed this way" is the removal right before it removing none (q:countersRemoved == 0); without a removal before it, the card is not automated', () => {
    const f = compiled('Enchantment', 'At the beginning of your upkeep, remove all flood counters from this enchantment. If no counters were removed this way, draw a card. Otherwise, you gain 1 life.');
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"cond":"compare","left":{"q":"countersRemoved","step":"removed"},"op":"==","right":0');
    expect(fullyAutomated(compiled('Enchantment', 'At the beginning of your upkeep, if no counters were removed this way, draw a card.'))).toBe(false);
  });
  it('holes/qty.ts: "for each spell countered this way" counts the spells of a counter step whose objects are all spells; a step that could counter an ability stays manual (the render gate refuses it)', () => {
    const f = compiled('Instant', 'Counter all other spells. Draw a card for each spell countered this way.');
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"count":{"q":"resultCount","step":"counter"}');
    expect(fullyAutomated(compiled('Instant', 'Counter target spell or ability. Draw a card for each spell countered this way.'))).toBe(false);
  });
  it('render/steps-life.ts: "Remove X counters from target permanent, where X is the number of Elves you control." keeps its wording, "where X" being read as the same amount', () => {
    const f = compiled('Sorcery', 'Remove X counters from target permanent, where X is the number of Elves you control.');
    expect(fullyAutomated(f)).toBe(true);
    expect(fullyAutomated(compiled('Sorcery', 'Remove X counters from target permanent, where X is the number of Goblin Elves you control and Wizards.'))).toBe(false);
  });
});
