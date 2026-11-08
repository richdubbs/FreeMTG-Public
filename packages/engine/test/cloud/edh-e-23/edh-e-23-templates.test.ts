/**
 * edh-e-23 (Commander lane edh-players): the template data of parser/templates/zz-cloud/edh-e-23.json and the parser, lowering, renderer and engine changes of the
 * round. Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or parses
 * to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2); G3: a critical word a
 * pattern spells out is consumed. Examples are synthetic wordings (design 6.10), checked against the local index when it is present, where each template is also read
 * on the real cards that print its sentence. The behavior is in edh-e-23-scenarios.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { compileCard, type OracleCard } from '../../../src/index';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhe23 from '../../../src/parser/templates/zz-cloud/edh-e-23.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const EE23 = edhe23 as Template[];
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card in which an example is an ability of the right kind: a spell on a sorcery (with {X} in its cost when it reads X), anything else on a creature. */
function exampleCard(t: Template, text: string): OracleCard {
  const xCost = /\bX\b/.test(text.replace(/, where X is [^.]*/g, '')) && !text.includes('{X}') ? { mana_cost: '{X}' } : {};
  // a ~ that "is still a land" is a land (the rider's type word is the object's own)
  if (/\bstill a land\b/.test(text) && text.includes('~')) return card('Example Nexus', 'Land', text);
  if (t.kind !== 'static' && !text.includes(':') && !/^(When|Whenever|At)\b/.test(text)) return card('Example Volley', 'Sorcery', text, xCost);
  return card('Example Brute', 'Creature — Elf Warrior', text, { power: '3', toughness: '3' });
}
const parsedWith = (t: Template, text: string) => parseCard(exampleCard(t, text), OPTS).faces[0]!;

describe('edh-e-23 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-e-23.json, path order: after edh-players-11, before edh-players-2) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-e-23.json');
    expect(files.indexOf('zz-cloud/edh-e-23.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-99.json'));
    expect(files.indexOf('zz-cloud/edh-e-23.json')).toBeLessThan(files.indexOf('zz-cloud/edh-mana-keywords-1.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 8; ids are <kind>.edhe23.*', () => {
    for (const t of EE23) {
      expect(t.id, t.id).toMatch(/^(eff|sta|trg|rep)\.edhe23\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(8);
    }
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of EE23) {
      const words = t.pattern.toLowerCase().replace(/\{[^}]*:[^}]*\}/g, ' ').split(/[^a-z']+/).filter(Boolean);
      for (const w of ['all', 'each', 'another', 'other', 'may', 'if', 'unless', 'until', 'instead', 'only', 'chosen', 'additional', 'except', "can't", 'would', 'next', 'twice', 'double', 'prevent']) {
        if (words.includes(w)) expect(t.consumes ?? [], `${t.id}: ${w}`).toContain(w);
      }
    }
  });
});

describe('edh-e-23 guard G9 (design 6.8): examples and counter-examples', () => {
  for (const t of EE23) {
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

/** Near-miss mutations of one example sentence (design 6.8 G9): each must not parse, or parse to different JSON. */
function nearMisses(text: string): string[] {
  const body = text.replace(/\.$/, '');
  const out = [`${body} unless it is blue.`, `${body} at random.`, `${body} if able.`];
  const swaps: [RegExp, string][] = [
    [/\binstead\b/, 'also'], [/\btwice\b/, 'three times'], [/\bdouble\b/, 'triple'], [/\bplus\b/, 'minus'], [/\byou control\b/, 'an opponent controls'],
    [/\bexile it\b/, 'destroy it'], [/\byour graveyard\b/, 'your hand'], [/\bwould\b/, 'could'], [/\bone or more\b/, 'exactly one'], [/\bcreature spell\b/, 'artifact spell'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-e-23 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
  for (const t of EE23) {
    it(`${t.id}: an appended "unless/at random/if able" or a swapped key word never gives the example's JSON`, () => {
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

describe('edh-e-23 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of EE23) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (w === '~' || w === '~.' || w === '~,' || w === "~'s" || /^"?\{/.test(w) || w.includes('\n')) return;
          // a counter's kind is an open class (design 6.11: the word before "counter(s)" is any word, weak when it is not in the lexicon): not a G2 word here
          if (/^counters?[.,]?$/.test(words[i + 1] ?? '')) return;
          const end = w.match(/[.,"]+$/)?.[0] ?? '';
          const start = w.startsWith('"') ? '"' : '';
          const mutated = [...words.slice(0, i), `${start}blorfty${end}`, ...words.slice(i + 1)].join(' ');
          expect(fullyAutomated(parsedWith(t, mutated)), mutated).toBe(false);
        });
      }
    });
  }
});

const index = localIndex();


/** The real cards that print each template's sentence (design 6.10: the examples above are synthetic; these are the cards the sentences were taken from). */
const REAL: Readonly<Record<string, readonly string[]>> = {
  'eff.edhe23.crownGain': ['Crown of Awe', 'Crown of Ascension'],
  'eff.edhe23.crownPump': ['Crown of Vigor', 'Crown of Suspicion'],
  'eff.edhe23.crownPumpGain': ['Crown of Fury'],
  'sta.edhe23.pumpHasProtection.keepsAura': ['Tattoo Ward'],
  'rep.edhe23.enters.discardHand': ['Heightened Awareness'],
  'rep.edhe23.enters.sacrificeLands': ['Overlaid Terrain'],
};
const ids = (n: string): string[] => parseCard((index ?? []).find((c) => c.name === n)!, OPTS).faces.flatMap((f) => f.templatesUsed);

describe.skipIf(index === null)('edh-e-23 design 6.10 (local index): synthetic examples, real cards', () => {
  it('no example or counter-example line is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
    const lines = new Set<string>();
    for (const c of index ?? []) {
      for (const text of [c.oracle_text, ...(c.card_faces ?? []).map((x) => x.oracle_text)]) {
        if (typeof text !== 'string') continue;
        for (const l of text.split('\n')) {
          lines.add(l.trim());
          lines.add(l.replaceAll(c.name, '~').replace(/\bthis (creature|land|artifact|enchantment|Aura|spell|card|Vehicle|Saga)\b/gi, '~').trim());
        }
      }
    }
    // a pattern with no hole is the rule's own words: its sentence alone is the one line an example can't avoid ("As ~ enters, discard your hand.")
    const norm = (x: string): string => x.toLowerCase().replace(/\s+/g, ' ').replace(/ ([',.])/g, '$1').replace(/\.$/, '').trim();
    const own = (t: Template, l: string): boolean => !t.pattern.includes('{') && norm(l) === norm(t.pattern);
    const verbatim = EE23.flatMap((t) => [...t.examples.map((e) => e.text), ...t.counterExamples].filter((x) => x.split('\n').some((l) => lines.has(l.trim()) && !own(t, l))).map((x) => `${t.id}: ${x}`));
    expect(verbatim).toEqual([]);
  }, 120_000);
  for (const [id, names] of Object.entries(REAL)) {
    it(`${id}: ${names.join(', ')} read the line with it and are fully automated`, () => {
      for (const n of names) {
        const oracle = (index ?? []).find((c) => c.name === n);
        expect(oracle, n).toBeDefined();
        expect(ids(n), n).toContain(id);
        expect(compileCard(oracle!).automation.level, n).toBe('full');
      }
    }, 60_000);
  }
  it('every template of the file has its real cards listed', () => {
    for (const t of EE23) expect(REAL[t.id] !== undefined, t.id).toBe(true);
  });
});

// ---- the renderer and parser changes of the round (each with its negative cases) ---------------------------------------------------------------------------------------

const aura = (text: string): OracleCard => card('Example Crown', 'Enchantment — Aura', `Enchant creature\n${text}`);
const full = (c: OracleCard): boolean => compileCard(c).automation.level === 'full';
const SAC = 'Sacrifice ~: ';

describe('edh-e-23: "enchanted creature and other creatures that share a creature type with it" (render/refs.ts union branch, parser/lower/anaphora.ts#hasOther; CR 303.4, 205.3m)', () => {
  it('is read with get, gain and both, on an Aura', () => {
    expect(full(aura(`${SAC}Enchanted creature and other creatures that share a creature type with it get +1/+1 until end of turn.`))).toBe(true);
    expect(full(aura(`${SAC}Enchanted creature and other creatures that share a creature type with it gain haste until end of turn.`))).toBe(true);
    expect(full(aura(`${SAC}Enchanted creature and other creatures that share a creature type with it get +1/+1 and gain haste until end of turn.`))).toBe(true);
  });
  it('another quality, another group, a lasting effect or "all" in place of "other" is another text (fail closed)', () => {
    expect(full(aura(`${SAC}Enchanted creature and other creatures that share a color with it get +1/+1 until end of turn.`))).toBe(false);
    expect(full(aura(`${SAC}Enchanted creature and other creatures you control that share a creature type with it get +1/+1 until end of turn.`))).toBe(false);
    expect(full(aura(`${SAC}Enchanted creature and other creatures that share a creature type with it get +1/+1.`))).toBe(false);
    expect(full(aura(`${SAC}Enchanted creature and other creatures that share a creature type with it lose flying until end of turn.`))).toBe(false);
  });
});

describe('edh-e-23: "target enchanted creature or enchantment creature you control" after "target" (render/np.ts; CR 205.2a, 303.4)', () => {
  const T = (tail: string): OracleCard => card('Example Herald', 'Creature — Elf', `At the beginning of combat on your turn, target enchanted creature or enchantment creature you control ${tail}`, { power: '2', toughness: '2' });
  it('is read with a pump and a grant', () => {
    expect(full(T('gets +1/+1 and gains trample until end of turn.'))).toBe(true);
    expect(full(T('gets +1/+1 until end of turn.'))).toBe(true);
  });
  it('another effect or a third description does not read', () => {
    expect(full(card('Example Herald', 'Creature — Elf', 'At the beginning of combat on your turn, target enchanted creature or enchantment creature or land you control gets +1/+1 until end of turn.', { power: '2', toughness: '2' }))).toBe(false);
  });
});

describe('edh-e-23: "enchanted Equipment" of an "Enchant Equipment" Aura (parser/holes/object.ts, render/refs.ts#attachedOptions; CR 303.4, 301.5)', () => {
  it('is read as the attached object, in an enter trigger and a control static; another noun after "enchanted" is not', () => {
    expect(full(card('Example Carry', 'Enchantment — Aura', 'Enchant Equipment\nYou control enchanted Equipment.'))).toBe(true);
    expect(full(card('Example Carry', 'Enchantment — Aura', 'Enchant Equipment\nWhen ~ enters, unattach enchanted Equipment.'))).toBe(true);
    expect(full(card('Example Carry', 'Enchantment — Aura', 'Enchant Equipment\nYou control enchanted Wizard.'))).toBe(false);
    expect(full(card('Example Carry', 'Enchantment — Aura', 'Enchant Equipment\nYou control enchanted Equipments.'))).toBe(false);
  });
});

describe('edh-e-23: "As this enchantment enters, <instruction>" (body enters.steps; CR 614.12, 614.12a)', () => {
  it('reads a hand discard and the sacrifice of all lands you control', () => {
    expect(full(card('Example Relic', 'Enchantment', 'As this enchantment enters, discard your hand.'))).toBe(true);
    expect(full(card('Example Relic', 'Enchantment', 'As this enchantment enters, sacrifice all lands you control.'))).toBe(true);
  });
  it('a different instruction, a may or another player is another text (fail closed)', () => {
    expect(full(card('Example Relic', 'Enchantment', 'As this enchantment enters, you may discard your hand.'))).toBe(false);
    expect(full(card('Example Relic', 'Enchantment', 'As this enchantment enters, each player discards their hand.'))).toBe(false);
    expect(full(card('Example Relic', 'Enchantment', 'As this enchantment enters, sacrifice all creatures you control.'))).toBe(false);
  });
});
