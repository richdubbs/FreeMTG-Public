/**
 * Commander coordinator E, round edh-e-64 (EDHREC top 30,000, group graveyard 1/1): the template data of parser/templates/zz-cloud/edh-e-64.json (see the file) and the round's
 * parser and renderer changes (a target player's graveyard as the zone of target cards, parser/lower/targets.ts; one target for each color, TargetSpec.perQuality; the folds of
 * render/fold-edhe64.ts and fold-r4refs.ts). Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every
 * counter-example does not parse or parses to different JSON. Examples are synthetic wordings (design 6.10). CR cites from memory where marked unverified in the record.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE64 from '../../../src/parser/templates/zz-cloud/edh-e-64.json';
import review from '../../m5/golden/cards/edh-e-64-review.json';
import { automated, card, fullyAutomated, jsonKey } from '../../m5/templates/support';

const MECH = edhE64 as Template[];
/** design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): the wording is printed by these cards only. */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe64.search.targetPlayerGraveyardHandLibrary.chosenName.all.exile': ['Cranial Extraction'],
  'eff.edhe64.foreach.playerLosesYouGain.1': ['Suffer the Past'],
  'eff.edhe64.search.libraryOfPlayer.sameName.exileThenShuffles': ['Invasive Surgery'],
  'eff.edhe64.player.revealsHand.exilesAllSameNameHandGraveyard': ["Legion's End"],
  'eff.edhe64.shuffle.selfAndObjs.ownersLibraries': ['Serene Remembrance'],
  'eff.edhe64.forEachColor.returnUpToOneCard.hand': ["All Suns' Dawn"],
  'eff.edhe64.forEachColor.returnUpToOneCreatureCard.hand': ["Rogues' Gallery"],
  'eff.edhe64.hand.choose.orGraveyardCard': ['Agonizing Remorse'],
  'eff.edhe64.search.graveyardHandLibrary.battlefield.attached': ['Boonweaver Giant'],
  'eff.edhe64.search.libraryHandGraveyard.battlefield.attached': ['Runed Crown'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES });
const typeFor = (text: string): string => (text.includes('When ~') ? 'Creature — Zombie' : 'Sorcery');
const parsedWith = (text: string, type = typeFor(text)) => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;

describe('edh-e-64 template file (design 6.3, 6.9)', () => {
  it('is loaded by the default compiler and its ids are unique in the whole set', () => {
    expect(TEMPLATE_FILES.map((f) => f.file)).toContain('zz-cloud/edh-e-64.json');
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('every template cites rules, has two examples and two counter-examples; ids are *.edhe64.*; stable ones have their golden evidence', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH) {
      expect(t.id).toMatch(/^(eff|sta|rep|trg|rst|ch|rid|cm)\.edhe64\./);
      expect(t.cr.length).toBeGreaterThan(0);
      expect(t.examples.length).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length).toBeGreaterThanOrEqual(2);
      expect(NARROW[t.id], `${t.id} is named in NARROW`).toBeDefined();
      const cards = golden.filter((g) => g.verified.includes(t.id)).map((g) => g.card);
      for (const n of NARROW[t.id] ?? []) expect(cards, t.id).toContain(n);
    }
    for (const g of golden) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) for (const w of ["can't", 'unless', 'each', 'all', 'up to', 'if able', 'as though']) if (t.pattern.includes(w)) expect(t.consumes ?? [], t.id).toContain(w);
  });
});

describe('edh-e-64 guard G9: examples and counter-examples', () => {
  for (const t of MECH) {
    it(`${t.id}: every example parses with it, is automated and passes the render gate; counter-examples never give the same JSON`, () => {
      const first = parsedWith(t.examples[0]!.text);
      for (const e of t.examples) {
        const f = parsedWith(e.text);
        expect(f.templatesUsed.includes(t.id), `${e.text}: ${f.templatesUsed.join(', ')}`).toBe(true);
        expect(automated(f.abilities), e.text).toBe(true);
        expect(f.gate.every((g) => g.ok), e.text).toBe(true);
      }
      for (const c of t.counterExamples) {
        const f = parsedWith(c);
        expect(fullyAutomated(f) && jsonKey(f.abilities) === jsonKey(first.abilities), c).toBe(false);
      }
    });
  }
});

describe('edh-e-64 readings: the wordings the round opens, and what stays manual', () => {
  const auto = (text: string, type = 'Sorcery') => { const f = parsedWith(text, type); return automated(f.abilities) && f.gate.every((g) => g.ok); };
  it('"target cards from target player\'s graveyard" (CR 115.1, 601.2c, 404.1): the player is a target of its own, announced first, and the cards are in that player\'s graveyard', () => {
    expect(auto("Exile target card from target player's graveyard.")).toBe(true);
    expect(auto("Exile up to two target creature cards from target player's graveyard.")).toBe(true);
    expect(auto("Put up to two target artifact cards from target player's graveyard on top of their library in any order.")).toBe(true);
    expect(auto("Exile target card from target player's graveyard. That player loses 2 life.")).toBe(true);
    const f = parsedWith("Exile target card from target player's graveyard.");
    const spec = (f.abilities[0] as unknown as { effect: { targets: { id: string; kind: string; filter?: { owner?: unknown } }[] } }).effect.targets;
    expect(spec.map((x) => x.kind)).toEqual(['player', 'object']);
    expect(spec[1]!.filter!.owner).toEqual({ ref: 'target', id: 't0' });
  });
  it('negatives: a graveyard of "a player" or of two target players has no such reading', () => {
    expect(auto("Exile target card from target player's graveyard and target player's graveyard.")).toBe(false);
    expect(auto("Exile target card from target player's hand.")).toBe(false);
  });
  it('"that spell\'s controller\'s graveyard, hand, and library" after a counter: the player of the search is named for "that player" (CR 608.2c)', () => {
    expect(auto("Counter target sorcery spell. Search that spell's controller's graveyard, hand, and library for any number of cards with the same name as that spell and exile them. Then that player shuffles.")).toBe(true);
    expect(auto("Counter target sorcery spell. Search that spell's controller's graveyard, hand, and library for any number of cards with the same name as that spell and put them into your hand. Then that player shuffles.")).toBe(false);
  });
});
