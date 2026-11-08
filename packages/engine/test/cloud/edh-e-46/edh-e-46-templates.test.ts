/**
 * Commander lane edh-d (coordinator E, group cost), round edh-e-46: the template data of parser/templates/zz-cloud/edh-e-46.json (see the file) and the round's parser, lowering,
 * engine and renderer changes, tested at the end of this file and in edh-e-46-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites checked against the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { OracleCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import { classifyAbility } from '../../../src/model/classify';
import edhE46 from '../../../src/parser/templates/zz-cloud/edh-e-46.json';
import review0 from '../../m5/golden/cards/edh-e-46-review.json';
import cmd5Review from '../../m5/golden/cards/cloud-cmd5-review.json'; // the golden entry of Accursed Witch is the one that names sta.cmd5.spells.less.opp.targetSelf too
const review = [...(review0 as unknown[]), ...(cmd5Review as { card: string }[]).filter((g) => g.card === 'Accursed Witch // Infectious Curse')];
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE46 as Template[];
const MECH_COUNT = 5;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the cards of the EDHREC top 30,000 that print each wording and are full
  'cm.edhe46.self.moreLife.perTarget': ['Phyrexian Purge'],
  'cm.edhe46.spells.you.targetEnchantedPlayer.less': ['Accursed Witch // Infectious Curse'],
  'sta.edhe46.cond.cycling.payZero': ['New Perspectives'],
  'cm.edhe46.additional.optional.mana': ['Undergrowth'],
  'eff.edhe46.fog.combat.exceptWhenAdditionalPaid': ['Undergrowth'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /enchanted (creature|land|artifact|permanent|enchantment|player)/.test(text) || text.startsWith('Enchant player') ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  /^(~ costs|This spell costs|As an additional cost to cast)/.test(text) && text.includes('\n') ? card('Example Plan', 'Sorcery', text) : t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-e-46 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-46.json, path order: after edh-d-9, before edh-mana-keywords-1) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-46.json');
    expect(files.indexOf('zz-cloud/edh-e-46.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-46.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 8; ids are *.edhe46.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe46\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(8);
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

describe('edh-e-46 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\bloses\b/, 'gains'], [/\bpoison\b/, 'x'], [/\bthird\b/, 'fourth'], [/\bland\b/, 'x'], [/\bgain control\b/, 'x'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-46 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-46 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w)) return;
          const lead = w.match(/^["\n]+/)?.[0] ?? '';
          const end = w.match(/[.,:"\n]+$/)?.[0] ?? '';
          const mutated = [...words.slice(0, i), `${lead}blorfty${end}`, ...words.slice(i + 1)].join(' ');
          expect(fullyAutomated(parsedWith(t, mutated)), mutated).toBe(false);
        });
      }
    }, 120_000);
  }
});

const index = localIndex();

describe.skipIf(index === null)('edh-e-46 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-46 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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
    // (only the lines that carry this round's wording: the plain second lines of an example, "Destroy any number of target creatures.", "Enchant player", are lines of many real cards)
    const ours = (l: string): boolean => /~ costs|additional cost|enchanted player|cycling costs|prevent all combat damage/i.test(l);
    const verbatim = MECH.flatMap((t) => [...t.examples.map((e) => e.text), ...t.counterExamples].filter((x) => x.split('\n').some((l) => ours(l) && lines.has(l.trim()))).map((x) => `${t.id}: ${x}`));
    expect(verbatim).toEqual([]);
  }, 120_000);
});





describe('edh-e-46 parser, renderer and engine changes (one test each)', () => {
  const spell = (text: string, type = 'Instant') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;
  it('parser/lower/join-edhe46.ts + render/fold-edhe46.ts (CR 615.1a, 510.1, 118.8; Undergrowth): the prevention and its exception are joined only as a pair; either alone, or an exception that is not for combat damage dealt by a group, stays unread', () => {
    const pay = 'As an additional cost to cast ~, you may pay {1}{W}.\n';
    const fog = 'Prevent all combat damage that would be dealt this turn.';
    const exc = "If ~'s additional cost was paid, this effect doesn't affect combat damage that would be dealt by white creatures.";
    expect(fullyAutomated(spell(`${pay}${fog} ${exc}`))).toBe(true);
    expect(fullyAutomated(spell(`${pay}${exc}`))).toBe(false);
    expect(fullyAutomated(spell(`${pay}${fog} ${exc.replace('combat damage that would be dealt by', 'combat damage that would be dealt to')}`))).toBe(false);
    expect(fullyAutomated(spell(`${pay}${fog.replace('combat damage', 'damage')} ${exc}`))).toBe(false);
  });
  it('statics/costmods.ts + render/stat.ts (CR 702.29a, 118.9; New Perspectives): a set cost of {0} for every cycling ability is said "you may pay {0} rather than pay cycling costs"; for another keyword, for other players or with a mana cost it stays unread', () => {
    const t = (x: string) => parseCard(card('Example Rite', 'Enchantment', x), OPTS).faces[0]!;
    expect(fullyAutomated(t('As long as you control an artifact, you may pay {0} rather than pay cycling costs.'))).toBe(true);
    expect(fullyAutomated(t('As long as you control an artifact, you may pay {0} rather than pay landcycling costs.'))).toBe(false);
    expect(fullyAutomated(t('As long as you control an artifact, your opponents may pay {0} rather than pay cycling costs.'))).toBe(false);
  });
  it('statics/costmods.ts#spellTargetsSource + render/stat.ts (CR 303.4, 115.1; Infectious Curse): "spells you cast that target enchanted player" is automated on an Aura that enchants a player; with "cost {1} more" it stays unread', () => {
    const aura = (x: string) => parseCard(card('Example Curse', 'Enchantment — Aura Curse', x), OPTS).faces[0]!;
    expect(fullyAutomated(aura('Enchant player\nSpells you cast that target enchanted player cost {1} less to cast.'))).toBe(true);
    expect(fullyAutomated(aura('Enchant player\nSpells you cast that target enchanted player cost {1} more to cast.'))).toBe(false);
  });
});
