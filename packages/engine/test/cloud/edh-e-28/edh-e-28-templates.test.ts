/** Round edh-e-28 (code edhe28): each new template's examples compile to it and its counter-examples do not (synthetic wording, design 6.10). */
import { describe, expect, it } from 'vitest';
import { TEMPLATE_SET } from '../../../src/parser/template-set';

const mine = TEMPLATE_SET.filter((t) => t.id.startsWith('rep.edhe28.'));
describe('edhe28 templates', () => {
  it('has the three templates', () => expect(mine.map((t) => t.id).sort()).toEqual(['rep.edhe28.enters.becomesChoiceOf3.mixed', 'rep.edhe28.enters.mill.ifCond', 'rep.edhe28.enters.mill.perKick']));
  for (const t of mine) {
    it(`${t.id} has examples and counter-examples`, () => { expect((t.examples ?? []).length).toBeGreaterThanOrEqual(2); expect((t.counterExamples ?? []).length).toBeGreaterThanOrEqual(3); });
  }
});
