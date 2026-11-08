/**
 * Commander coordinator E, round edh-e-18 (group replace-prevent): the template data of parser/templates/zz-cloud/edh-e-18.json and the round's parser, lowering and
 * renderer changes (hole readings, anaphora, folds), tested at the end of this file and played in edh-e-18-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or parses to different JSON;
 * near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples are synthetic wordings (design 6.10), checked
 * against the local index when it is present. CR cites checked against the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhE18 from '../../../src/parser/templates/zz-cloud/edh-e-18.json';
import review from '../../m5/golden/cards/edh-e-18-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE18 as Template[];
const MECH_COUNT = 12;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on only one card, with
 * their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing rule 2026-10-27).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe18.prevent.next.anyTarget.bySourceOfChoice': ['Healing Grace'],
  'eff.edhe18.prevent.next.anyTarget.gainLife': ["Candles' Glow"],
  'eff.edhe18.redirect.all.bySourceOfChoice.obj': ['Kor Chant', 'Kor Dirge'],
  'eff.edhe18.redirect.next.fromSourceOfChoice.youAndPerms': ["Harm's Way"],
  'eff.edhe18.prevent.next.fromSourceOfChoice.youAndPerms.thenDamage': ['Refraction Trap'],
  'eff.edhe18.prevent.all.twoGroupsWould.dur': ['Luminesce'],
  'eff.edhe18.prevent.all.toObj.dur.byFilter': ["Lithomancer's Focus"],
  'sta.edhe18.asLongAs.redirectAllToYouBy.toObj': ['Veteran Bodyguard'],
  'sta.edhe18.asLongAs.redirectAllCombatToYouBy.toObj': ['Weathered Bodyguards'],
  'eff.edhe18.redirect.allCombat.toYouBy.dur': ['Kjeldoran Royal Guard'],
  'eff.edhe18.redirect.all.byObj.dur': ['Reverberation'],
  'sta.edhe18.prevent.all.toEnchanted.byFilter': ['Prismatic Ward'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or a triggered / activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  t.kind === 'static' || t.kind === 'rider' || text.includes(':') || /^(When|Whenever|At the beginning|Once)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;
const compiled = (type: string, text: string) => parseCard(card('Example Relic', type, text, type.includes('Creature') ? { power: '2', toughness: '2' } : {}), OPTS).faces[0]!;

describe('edh-e-18 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-18.json, path order: after edh-d-99, before edh-next-1) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-18.json');
    expect(files.indexOf('zz-cloud/edh-e-18.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-18.json')).toBeLessThan(files.indexOf('zz-cloud/edh-next-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe18.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe18\./);
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

describe('edh-e-18 guard G9 (design 6.8): examples and counter-examples', () => {
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
  const out = [`${body} unless it is blue.`, `${body} at random.`, `${body} twice.`, `${body} if able.`];
  const swaps: [RegExp, string][] = [[/\bthat much\b/, 'twice that much'], [/\bnext 3\b/, 'next 4'], [/\bunblocked\b/, 'blocked'], [/\bshuffle the rest\b/, 'put the rest']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-18 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
  for (const t of MECH) {
    it(`${t.id}: an appended "unless/at random/twice/if able" or a swapped key word never gives the example's JSON`, () => {
      for (const e of t.examples) {
        const orig = parsedWith(t, e.text);
        for (const m of nearMisses(e.text)) {
          if (m === e.text) continue;
          const f = parsedWith(t, m);
          expect(automated(f.abilities) && f.gate.every((g) => g.ok) && jsonKey(f.abilities) === jsonKey(orig.abilities), m).toBe(false);
        }
      }
    }, 120_000);
  }
});

describe('edh-e-18 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe('edh-e-18: the renderer and parser changes (one test each)', () => {
  const steps = (f: ReturnType<typeof compiled>): string => JSON.stringify(f.abilities);
  it('render/self-replacement.ts#isFixedChoice (CR 702.33d, 614.15): "If it was kicked" in the enters trigger of a permanent replaces one targetless instruction by another as a whole; a target on either side is still refused', () => {
    const kick = 'Kicker {1}\nWhen this creature enters, destroy all other creatures you control. If it was kicked, destroy all other creatures instead.';
    const f = compiled('Creature — Giant', kick);
    expect(fullyAutomated(f)).toBe(true);
    expect(steps(f)).toContain('"cond":"wasCast"');
    expect(fullyAutomated(compiled('Creature — Giant', 'Kicker {1}\nWhen this creature enters, destroy target creature you control. If it was kicked, destroy target creature instead.'))).toBe(false);
    expect(fullyAutomated(compiled('Creature — Giant', 'Kicker {1}\nWhen this creature enters, destroy all other creatures you control. If it was kicked, you may destroy all other creatures instead.'))).toBe(false);
  });
  it('render/stat.ts (CR 109.4, 105.2c): a prevention by "colorless sources" and by "sources of the chosen color" is said with sources; a different noun is not the same JSON', () => {
    const a = compiled('Instant', 'Prevent all damage that would be dealt to target creature this turn by colorless sources.');
    expect(fullyAutomated(a)).toBe(true);
    const b = compiled('Instant', 'Prevent all damage that would be dealt to target creature this turn by colorless creatures.');
    expect(steps(a) === steps(b)).toBe(false);
  });
  it('parser/lower/ability.ts (CR 615.5, 119.3): "Prevent the next N damage ... to <recipient>. You gain life equal to the damage prevented this way." is one shield; the sentence alone is not a reading', () => {
    expect(fullyAutomated(compiled('Instant', 'Prevent the next 2 damage that would be dealt to any target this turn. You gain life equal to the damage prevented this way.'))).toBe(true);
    expect(fullyAutomated(compiled('Instant', 'You gain life equal to the damage prevented this way.'))).toBe(false);
  });
});

const index = localIndex();

describe.skipIf(index === null)('edh-e-18 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-18 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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
