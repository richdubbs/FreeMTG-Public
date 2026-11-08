/**
 * Commander coordinator E, round edh-e-53 (second batch, group attach): the template data of parser/templates/zz-cloud/edh-e-53.json and the round's parser, lowering and
 * renderer changes (hole readings, anaphora, folds), tested at the end of this file and played in edh-e-53-scenarios.test.ts.
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
import edhE53 from '../../../src/parser/templates/zz-cloud/edh-e-53.json';
import review from '../../m5/golden/cards/edh-e-53-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhE53 as Template[];
const MECH_COUNT = 3;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the wording on only one card, with
 * their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing rule 2026-10-27).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'sta.edhe53.grant.aslong.itsControllerControlsNoOtherCreatures': ["Predator's Gambit"],
  'eff.edhe53.attach.toAnotherCreature': ['Crown of the Ages', 'Kitsune Mystic // Autumn-Tail, Kitsune Sage'],
  'eff.edhe53.returnAll.attachedTo.ownersHands': ['Scarab of the Unseen'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or a triggered / activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  t.kind === 'static' || t.kind === 'rider' || text.includes(':') || /^(When|Whenever|At the beginning|Once)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;
const compiled = (type: string, text: string) => parseCard(card('Example Relic', type, text, type.includes('Creature') ? { power: '2', toughness: '2' } : {}), OPTS).faces[0]!;

describe('edh-e-53 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-53.json) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-53.json');
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhe53.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhe53\./);
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

describe('edh-e-53 guard G9 (design 6.8): examples and counter-examples', () => {
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
  const swaps: [RegExp, string][] = [[/\blibrary this turn\b/, 'hand this turn'], [/\bfreerunning\b/, 'prowl'], [/\bthat much\b/, 'twice that much'], [/\breduced by \{2\}/, 'reduced by {1}'], [/\bshuffle the rest\b/, 'put the rest']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-53 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-e-53 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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


describe('edh-e-53: the hole readings, lowering and renderer changes (one test each)', () => {
  const spell = (text: string) => compiled('Instant', text);
  it('parser/holes/filter.ts (CR 303.4, 301.5, 608.2c): "all Auras attached to them" is attached to the plural group of targets the sentence names; with a Curse the pronoun stays the players of the older reading', () => {
    expect(fullyAutomated(spell('Exile two target creatures and all Auras attached to them.'))).toBe(true);
    expect(fullyAutomated(spell('Exile any number of target creatures and all Equipment attached to them.'))).toBe(true);
    expect(fullyAutomated(spell('Exile two target creatures and all Auras attached to it.'))).toBe(false); // a singular pronoun for two targets
    expect(fullyAutomated(spell('Exile all Auras attached to them.'))).toBe(false); // nothing for the pronoun to name
    expect(fullyAutomated(compiled('Enchantment', 'Whenever a player draws a card, that player loses 1 life for each Curse attached to them.'))).toBe(true); // Curse of Thirst's reading is unchanged
  });
  it('parser/holes/cost.ts (CR 701.21a, 118.3, 303.4): "Sacrifice enchanted creature" and "Sacrifice equipped creature" are a cost of the one creature the source is attached to; "enchanted land" and a second part are other costs', () => {
    const strict = (f: ReturnType<typeof compiled>): boolean => fullyAutomated(f) && !JSON.stringify(f.abilities).includes('"kind":"manual"'); // (a cost the model cannot state is a manual cost part, not a manual step)
    const aura = (cost: string) => compiled('Enchantment — Aura', `Enchant creature\n${cost}: You gain 2 life.`);
    expect(strict(aura('Sacrifice enchanted creature'))).toBe(true);
    expect(strict(compiled('Artifact — Equipment', 'Equipped creature gets +1/+1.\nSacrifice equipped creature: You gain 2 life.\nEquip {1}'))).toBe(true);
    expect(strict(aura('Sacrifice enchanted land'))).toBe(false);
    expect(strict(aura('Sacrifice enchanted creature and a land'))).toBe(false);
  });
  it('render/cond.ts (CR 303.4e, 611.3a): "its controller controls no other creatures" beside "another creature"; "no other artifacts" and "you control no other creatures" are other conditions', () => {
    const aura = (cond: string) => compiled('Enchantment — Aura', `Enchant creature\nEnchanted creature has hexproof as long as ${cond}.`);
    expect(fullyAutomated(aura('its controller controls no other creatures'))).toBe(true);
    expect(fullyAutomated(aura('its controller controls another creature'))).toBe(true);
    expect(fullyAutomated(aura('its controller controls no other artifacts'))).toBe(false);
    expect(JSON.stringify(aura('its controller controls no other creatures').abilities)).toContain('"cond":"not"');
  });
  it('render/fold-edhe53.ts + rules/filter.ts (CR 701.3a-b, 303.4a, 608.2d; filter auraMovesTo): "Attach <an Aura> to another creature" is a choice among the other creatures the Aura could enchant; "another permanent", "another creature you control" and "target creature" stay other readings', () => {
    const f = (to: string) => compiled('Artifact', `{T}: Attach target Aura you control to ${to}.`);
    expect(fullyAutomated(f('another creature'))).toBe(true);
    expect(JSON.stringify(f('another creature').abilities)).toContain('"auraMovesTo":{"ref":"target","id":"t0"}');
    expect(fullyAutomated(compiled('Artifact', '{T}: Attach target Equipment you control to another creature.'))).toBe(false); // review: only an Aura moves this way
    expect(fullyAutomated(f('another permanent'))).toBe(false);
    expect(fullyAutomated(f('another creature you control'))).toBe(false);
    expect(fullyAutomated(f('target creature'))).toBe(true); // the older template's reading (a second target)
    expect(JSON.stringify(f('target creature').abilities)).not.toContain('auraMovesTo');
  });
});

const index = localIndex();

describe.skipIf(index === null)('edh-e-53 design 6.10 (local index): synthetic examples', () => {
  it('no edh-e-53 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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
