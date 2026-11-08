/**
 * Commander round edh-d-110 (coordinator D, EDHREC ranks 10,001-30,000, groups library 1/3 and 2/3): the template data of parser/templates/zz-cloud/edh-d-110.json (see the file) and the
 * round's parser, lowering and renderer changes, tested at the end of this file and in edh-d-110-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites checked against MagicCompRules 20260925 (fetched in the cloud session).
 */
import { describe, expect, it } from 'vitest';
import type { OracleCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhD110 from '../../../src/parser/templates/zz-cloud/edh-d-110.json';
import review from '../../m5/golden/cards/edh-d-110-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhD110 as Template[];
const MECH_COUNT = 8;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the card of the EDHREC top 30,000 that prints the wording and is full (each wording is printed on that one card)
  'eff.edhd110.reveal.putAll.hand.thenRest.bottomRandom': ['Depala, Pilot Exemplar'],
  'eff.edhd110.revealUntil.listOfThree': ['An Unearthly Child'],
  'eff.edhd110.revealUntilLand.damageNonland.doubleIfMountain.bottomAnyOrder': ['Goblin Charbelcher'],
  'eff.edhd110.youChooseN.fromHand': ['Gruesome Discovery'],
  'eff.edhd110.player.revealsNCards.fromTheirHand': ['Noggin Whack'],
  'eff.edhd110.you.chooseN.of': ['Noggin Whack'],
  'rep.edhd110.draw.insteadReveal.putAllRevealed.restBottomAnyOrder': ['Sages of the Anima'],
  'eff.edhd110.pump.forEachFirst.group': ['Woodvine Elemental'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^[+\u2212-]\d+:/.test(text) || /loyalty counter/.test(text) ? card('Example Sage', 'Legendary Planeswalker — Example', text, { loyalty: '4' }) :
  /enchanted (creature|land|artifact|permanent|enchantment)/.test(text) ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-d-110 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-110.json, path order: after edh-d-11, before edh-d-12) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-110.json');
    expect(files.indexOf('zz-cloud/edh-d-110.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-11.json'));
    expect(files.indexOf('zz-cloud/edh-d-110.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-12.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhd110.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhd110\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(9);
    }
  });
  it('design 6.9: a stable template has its evidence: three or more hand-verified golden cards, or (a recorded deviation) the one card that prints the wording', () => {
    const golden = review as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const cards = golden.filter((g) => g.verified.includes(`(${t.id}`) || g.verified.includes(` ${t.id}`) || g.verified.includes(`${t.id},`)).map((g) => g.card);
      if (NARROW[t.id] !== undefined) for (const n of NARROW[t.id]!) expect(cards, t.id).toContain(n);
      else expect(cards.length, t.id).toBeGreaterThanOrEqual(3);
    }
    for (const g of review as { card: string; expect?: string }[]) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) {
      const words = t.pattern.toLowerCase().replace(/\{[^}]*:[^}]*\}/g, ' ').split(/[^a-z']+/).filter(Boolean);
      for (const w of ['all', 'each', 'another', 'other', 'may', 'if', 'unless', 'until', 'instead', 'only', 'chosen', 'additional', 'except', "can't", 'would', 'next', 'then', 'during']) {
        if (words.includes(w)) expect(t.consumes ?? [], `${t.id}: ${w}`).toContain(w);
      }
    }
  });
});

describe('edh-d-110 guard G9 (design 6.8): examples and counter-examples', () => {
  for (const t of MECH) {
    it(`${t.id} (${t.cr.join(', ')}): every example parses with it, is automated and passes the render gate; counter-examples do not give the same JSON`, () => {
      const first = parsedWith(t, t.examples[0]!.text);
      for (const e of t.examples) {
        const f = parsedWith(t, e.text);
        expect(f.templatesUsed.includes(t.id), `${e.text}: ${f.templatesUsed.join(', ')}`).toBe(true);
        expect(automated(f.abilities), `${e.text}: ${JSON.stringify(f.abilities)} ${JSON.stringify(f.diagnostics)}`).toBe(true);
        expect(f.gate.every((g) => g.ok), `${e.text}: ${JSON.stringify(f.gate)}`).toBe(true);
        expect(f.diagnostics.filter((d) => d.level === 'manual'), e.text).toEqual([]);
        if (e.expect !== undefined) expect(bare(f.abilities), e.text).toEqual(e.expect);
      }
      for (const c of t.counterExamples) {
        const f = parsedWith(t, c);
        expect(fullyAutomated(f) && jsonKey(f.abilities) === jsonKey(first.abilities), c).toBe(false);
      }
    });
  }
});

/** Near-miss mutations of one example (design 6.8 G9): each must not parse, or parse to different JSON. */
function nearMisses(text: string): string[] {
  const body = text.replace(/\.$/, '');
  const out = [`${body} unless it is blue.`, `${body} instead.`, `${body} at random.`, `${body} twice.`, `${body} if able.`, `${body} until end of turn.`];
  const swaps: [RegExp, string][] = [
    [/\bMountain\b/g, 'Forest'], [/\binto your hand\b/, 'into your graveyard'], [/\bin a random order\b/, 'in any order'], [/\bin any order\b/, 'in a random order'], [/\bflying\b/g, 'reach'],
    [/\btheir hand\b/, 'your hand'], [/\bnonland\b/, 'nonartifact'], [/\bYou choose\b/, 'That player chooses'], [/\btwo\b/, 'three'], [/\buntil end of turn\b/, 'this combat'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-d-110 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
  for (const t of MECH) {
    it(`${t.id}: an appended "unless/instead/at random/twice/if able/until end of turn" or a swapped key word never gives the example's JSON`, () => {
      for (const e of t.examples) {
        const orig = parsedWith(t, e.text);
        for (const m of nearMisses(e.text)) {
          if (m === e.text) continue;
          const f = parsedWith(t, m);
          expect(automated(f.abilities) && f.gate.every((g) => g.ok) && jsonKey(f.abilities) === jsonKey(orig.abilities), m).toBe(false);
        }
      }
    });
  }
});

describe('edh-d-110 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        let reminder = false; // CR 207.2: reminder text (in parentheses) has no rules meaning; its words are not tested
        words.forEach((w, i) => {
          const inReminder = reminder || w.startsWith('(') || w.startsWith('\n(');
          if (w.includes(')')) reminder = false;
          else if (w.startsWith('(') || w.includes('\n(')) reminder = true;
          if (inReminder) return;
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          const lead = w.match(/^["\n]+/)?.[0] ?? '';
          const end = w.match(/[.,:"\n]+$/)?.[0] ?? '';
          const mutated = [...words.slice(0, i), `${lead}blorfty${end}`, ...words.slice(i + 1)].join(' ');
          expect(fullyAutomated(parsedWith(t, mutated)), mutated).toBe(false);
        });
      }
    }, 120_000); // like the other rounds' G2 guards: one parse per word of each example
  }
});

const index = localIndex();

describe.skipIf(index === null)('edh-d-110 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-110 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
    const lines = new Set<string>();
    for (const c of index ?? []) {
      for (const text of [c.oracle_text, ...(c.card_faces ?? []).map((x) => x.oracle_text)]) {
        if (typeof text !== 'string') continue;
        for (const l of text.split('\n')) {
          lines.add(l.trim());
          lines.add(l.replaceAll(c.name, '~').replace(/\bthis (creature|land|artifact|enchantment|Aura|spell|card|Equipment)\b/gi, '~').trim());
        }
      }
    }
    const verbatim = MECH.flatMap((t) => [...t.examples.map((e) => e.text), ...t.counterExamples].filter((x) => x.split('\n').some((l) => lines.has(l.trim()))).map((x) => `${t.id}: ${x}`));
    expect(verbatim).toEqual([]);
  }, 120_000);
});




describe('edh-d-110 parser, lowering and renderer changes (one test each)', () => {
  const spell = (text: string, type = 'Sorcery') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;
  const creature = (text: string, type = 'Creature — Elf') => parseCard(card('Example Beast', type, text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  it('parser/front/spellforms.ts (CR 103.6, 113.6b): "You may reveal this card from your opening hand. If you do, ..." on a sorcery is a pregame static of the card in the hand; from "your hand" it is not', () => {
    const f = spell('You may reveal this card from your opening hand. If you do, at the beginning of the first upkeep, you gain 4 life.\nYou gain 4 life.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"s":"pregame"');
    expect(fullyAutomated(spell('You may reveal this card from your hand. If you do, at the beginning of the first upkeep, you gain 4 life.\nYou gain 4 life.'))).toBe(false);
  });
  it('parser/lower/edhd110.ts#resolveStaticLifeLost (CR 119.3, 608.2c, 603.7a): "the life lost this way" in a pregame delayed body names the loss right before it; a gain before any loss stays manual', () => {
    const f = creature('You may reveal this card from your opening hand. If you do, at the beginning of the first upkeep, each opponent loses 2 life, then you gain life equal to the life lost this way.', 'Creature — Vampire');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toMatch(/"q":"lifeLost","step":"lost110_0"/);
    expect(fullyAutomated(creature('You may reveal this card from your opening hand. If you do, at the beginning of the first upkeep, you gain life equal to the life lost this way, then each opponent loses 2 life.', 'Creature — Vampire'))).toBe(false);
  });
  it('render/stat.ts#isCreatureOnlyPump (CR 613.4c, 301.7): "Each Vehicle you control gets +1/+1 as long as it\'s a creature" is said back; the same pump of Vehicles an opponent controls is not', () => {
    expect(fullyAutomated(creature("Each Vehicle you control gets +1/+1 as long as it's a creature.", 'Legendary Creature — Dwarf'))).toBe(true);
    expect(fullyAutomated(creature("Each Vehicle your opponents control gets -1/-1 as long as it's a creature.", 'Legendary Creature — Dwarf'))).toBe(false);
  });
  it('render/steps-flow.ts (CR 608.2c-d): "You choose two of them" after a group a player revealed is said back; "You choose up to two of them" is not read', () => {
    expect(fullyAutomated(spell('Target player reveals four cards from their hand. You choose two of them. That player discards those cards.'))).toBe(true);
    expect(fullyAutomated(spell('Target player reveals four cards from their hand. You choose up to two of them. That player discards those cards.'))).toBe(false);
  });
  it('render/self-replacement.ts#revealChooseDiscardFor (CR 614.15, 701.9a): "instead that player reveals their hand, you choose ... that player discards" replaces the discard; your own reveal and choice do not', () => {
    expect(fullyAutomated(spell('Target player discards a card. If you control an artifact, instead that player reveals their hand, you choose a nonland card from it, then that player discards that card.'))).toBe(true);
    expect(fullyAutomated(spell('Target player discards a card. If you control an artifact, instead you reveal your hand, you choose a nonland card from it, then you discard that card.'))).toBe(false);
  });
  it('parser/lower/anaphora.ts (rider, CR 608.2c): "it" of an "instead" branch is the hand an earlier instruction of that branch revealed; with no reveal before it, it has no antecedent', () => {
    expect(fullyAutomated(spell('Target player discards two cards. If you control an artifact, instead that player reveals their hand, you choose two cards from it, then that player discards those cards.'))).toBe(true);
    expect(fullyAutomated(spell('Target player discards two cards. If you control an artifact, instead you choose two cards from it, then that player discards those cards.'))).toBe(false);
  });
  it('parser/lower/join-edhd110.ts (CR 608.2c, 120.3): the four sentences of a reveal until with a damage doubled for a Mountain are one instruction; with a Forest they are not joined and stay manual', () => {
    const body = (land: string) => `{4}, {T}: Reveal cards from the top of your library until you reveal a land card. Example Beast deals damage equal to the number of nonland cards revealed this way to any target. If the revealed land card was a ${land}, Example Beast deals double that damage instead. Put the revealed cards on the bottom of your library in any order.`;
    expect(fullyAutomated(creature(body('Mountain'), 'Artifact Creature — Golem'))).toBe(true);
    expect(fullyAutomated(creature(body('Forest'), 'Artifact Creature — Golem'))).toBe(false);
  });
});
