/**
 * Commander coordinator D, round edh-d-106 (EDHREC ranks 10,001-30,000, groups tokens and control): the template data of parser/templates/zz-cloud/edh-d-106.json (see the file) and the
 * round's parser, lowering and renderer changes, tested at the end of this file and in edh-d-106-scenarios.test.ts.
 * Guard G9 (design 6.8): every example lowers with its template, is automated and passes the exact render gate (G6); every counter-example does not parse or
 * parses to different JSON; near-miss mutations fail or differ; a nonsense word in place of any word of an example never leaves an automated card (G2). Examples
 * are synthetic wordings (design 6.10), checked against the local index when it is present. CR cites checked against the Comprehensive Rules of 2026-09-25.
 */
import { describe, expect, it } from 'vitest';
import type { Template } from '../../../src/parser/types';
import { defaultParseOptions, parseCard } from '../../../src/parser/parse';
import { validateTemplates } from '../../../src/parser/chart';
import { TEMPLATE_FILES, TEMPLATE_SET } from '../../../src/parser/template-set';
import { ENGINE_CAPABILITIES } from '../../../src/model/capabilities';
import edhD106 from '../../../src/parser/templates/zz-cloud/edh-d-106.json';
import review from '../../m5/golden/cards/edh-d-106-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';
import { compileCard, renderGate } from '../../../src/index';

const MECH = edhD106 as Template[];
const MECH_COUNT = 6;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one card, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing
 * rule 2026-10-27; one-card templates are allowed in this effort).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhd106.eachOpp.chooseTarget.damageEach': ['Shellshock'],
  'eff.edhd106.eachOpp.chooseTarget.damageEqualEach': ['Mega Flare'],
  'eff.edhd106.eachOpp.createAttackThatOpponent.haste': ['Furygale Flocking'],
  'eff.edhd106.createForEach.creatureDealtCombatDamageToPlayer': ['Indulge // Excess'],
  'eff.edhd106.createThenEachChoiceOfThreeCounters': ['Invoke the Ancients'],
  'eff.edhd106.sacrifice.theirChoice.forEach.thenAnother': ['Din of the Fireherd'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a Saga for chapters, a static, activated or triggered ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^I -- /.test(text) ? card('Example Saga', 'Enchantment — Saga', text.replaceAll(' -- ', ' — '))
    : t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-d-106 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-106.json, path order: after edh-d-102.json, before edh-d-11.json) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-106.json');
    expect(files.indexOf('zz-cloud/edh-d-106.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-102.json'));
    expect(files.indexOf('zz-cloud/edh-d-106.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-11.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhd106.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|rst|ch|rid|cm)\.edhd106\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(9);
    }
  });
  it('design 6.9: a stable template has its evidence: three or more hand-verified golden cards, or (a recorded deviation) the one card that prints the wording', () => {
    const golden = [...review] as { card: string; verified: string; expect?: string }[];
    for (const t of MECH.filter((x) => x.status === 'stable')) {
      const cards = golden.filter((g) => g.expect === 'full' && (g.verified.includes(`(${t.id}`) || g.verified.includes(` ${t.id}`) || g.verified.includes(`${t.id},`))).map((g) => g.card);
      if (NARROW[t.id] !== undefined) for (const n of NARROW[t.id]!) expect(cards, t.id).toContain(n);
      else expect(cards.length, t.id).toBeGreaterThanOrEqual(3);
    }
    for (const g of review as { card: string; expect?: string }[]) expect(g.expect, g.card).toBe('full');
  });
  it('guard G3: a critical word a pattern spells out is listed in `consumes`', () => {
    for (const t of MECH) {
      const words = t.pattern.toLowerCase().replace(/\{[^}]*:[^}]*\}/g, ' ').split(/[^a-z']+/).filter(Boolean);
      for (const w of ['all', 'each', 'another', 'other', 'may', 'if', 'unless', 'until', 'instead', 'only', 'chosen', 'additional', 'except', "can't", 'would', 'next', 'then', 'during', 'still']) {
        if (words.includes(w)) expect(t.consumes ?? [], `${t.id}: ${w}`).toContain(w);
      }
    }
  });
});

describe('edh-d-106 guard G9 (design 6.8): examples and counter-examples', () => {
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
    }, 120_000);
  }
});

/** Near-miss mutations of one example (design 6.8 G9): each must not parse, or parse to different JSON. */
function nearMisses(text: string): string[] {
  const body = text.replace(/\.$/, '');
  const out = [`${body} unless it is blue.`, `${body} instead.`, `${body} at random.`, `${body} twice.`, `${body} if able.`, `${body} until end of turn.`];
  const swaps: [RegExp, string][] = [[/\bsix\b/, 'seven'], [/\bfour\b/, 'five'], [/\bopponent\b/, 'player'], [/\byour graveyard\b/, 'your hand'], [/\bmay\b/, 'must'], [/\b3\b/, '4']];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-d-106 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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
    }, 120_000);
  }
});

describe('edh-d-106 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
  for (const t of MECH) {
    it(`${t.id}: replacing any one word of an example by an invented word makes the card not fully automated`, () => {
      for (const e of t.examples) {
        const words = e.text.split(' ');
        words.forEach((w, i) => {
          if (/^"?~/.test(w) || /^\{/.test(w) || w === '--' || /\S\n\S/.test(w) || /^(I|II|III)$/.test(w.replace(/^\n/, ''))) return; // (a word with a line break inside joins two lines: no single-word mutation)
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

describe.skipIf(index === null)('edh-d-106 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-106 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
    const lines = new Set<string>();
    for (const c of index ?? []) {
      for (const text of [c.oracle_text, ...(c.card_faces ?? []).map((x) => x.oracle_text)]) {
        if (typeof text !== 'string') continue;
        for (const l of text.split('\n')) {
          lines.add(l.trim());
          lines.add(l.replaceAll(c.name, '~').replace(/\bthis (creature|land|artifact|enchantment|Aura|spell|card|Equipment)\b/gi, '~').trim());
          lines.add(l.replaceAll(' — ', ' -- ').trim());
        }
      }
    }
    const verbatim = MECH.flatMap((t) => [...t.examples.map((e) => e.text), ...t.counterExamples].filter((x) => x.split('\n').some((l) => lines.has(l.trim()))).map((x) => `${t.id}: ${x}`));
    expect(verbatim, verbatim.join('\n')).toEqual([]);
  }, 120_000);
});

describe('edh-d-106 parser, lowering and renderer changes (one test each, with the negative case)', () => {
  // the card's automation level as the game compiles it (manual cost parts and capabilities the engine lacks count, which `fullyAutomated` of one face does not see)
  const spellFull = (text: string) => compileCard(card('Example Plan', 'Sorcery', text)).automation.level === 'full';
  const relicFull = (text: string) => compileCard(card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' })).automation.level === 'full';
  it('parser/lower/ability.ts#activated + render/abil.ts (CR 107.3a, 700.2; family x-cant-be-0-each-mode): "X can\'t be 0." after every mode is the ability\'s least X; after only some, or with no X in the cost, it is not', () => {
    expect(relicFull("{X}, {T}: Choose one --\n• You gain X life. X can't be 0.\n• Target player mills X cards. X can't be 0.")).toBe(true);
    expect(relicFull("{X}, {T}: Choose one --\n• You gain X life. X can't be 0.\n• Target player mills X cards.")).toBe(false);
    expect(relicFull("{1}, {T}: Choose one --\n• You gain 2 life. X can't be 0.\n• Target player mills 2 cards. X can't be 0.")).toBe(false);
  });
  it('parser/lower/ability.ts#ownColorTokenModes + render/program.ts (CR 700.2, 111.1): bullets that name their own colors under "choose one that hasn\'t been chosen this turn"; a bullet with no color is not this reading', () => {
    const head = "Whenever another creature you control dies, choose one that hasn't been chosen this turn. Create a creature token with those characteristics.";
    expect(relicFull(`${head}\n• 1/1 white Soldier with lifelink.\n• 2/1 red Goblin with haste.`)).toBe(true);
    expect(relicFull(`${head}\n• 1/1 Soldier with lifelink.\n• 2/1 red Goblin with haste.`)).toBe(false);
    expect(relicFull("Whenever another creature you control dies, choose one. Create a creature token with those characteristics.\n• 1/1 white Soldier with lifelink.\n• 2/1 red Goblin with haste.")).toBe(false);
  });
  it('parser/lower/join-edhd106.ts (CR 115.1, 601.2c): the announcement and the damage are joined only for one target of each OPPONENT and "each of those / the chosen creatures"', () => {
    expect(spellFull('For each opponent, choose up to one target creature that player controls. Example Plan deals 2 damage to each of those creatures.')).toBe(true);
    expect(spellFull('For each opponent, choose up to one target creature that player controls. Example Plan deals 2 damage to each creature.')).toBe(false);
    expect(spellFull('For each opponent, choose up to one target creature that player controls. Example Plan deals 2 damage to that player.')).toBe(false);
  });
  it('render/program.ts#chosenFirstAt (CR 601.2c; family per-opponent-choose-after-instructions): the per-opponent announcement may follow an instruction that does not name it; a single target is not this reading', () => {
    expect(spellFull('You gain 2 life. For each opponent, choose up to one target creature that player controls. Example Plan deals 2 damage to each of the chosen creatures.')).toBe(true);
    expect(spellFull('You gain 2 life. Choose target creature. Example Plan deals 2 damage to it.')).toBe(false);
  });
  it('parser/holes/filter.ts + render/np.ts (CR 202.3, 208.1): "with power, toughness, or mana value N" is any of the three; another statistic in the list is not read', () => {
    expect(relicFull('Whenever you cast a spell with power, toughness, or mana value 3, you gain 1 life.')).toBe(true);
    expect(relicFull('Whenever you cast a spell with power, toughness, or loyalty 3, you gain 1 life.')).toBe(false);
  });
  it('render/abil.ts (CR 201.5; family plural-name-enters-and-whenever): "When ~ enter and whenever ..." of a plural name; "enter" with another event than a cast is not new', () => {
    expect(compileCard(card('Example Twins', 'Creature — Human', 'When Example Twins enter and whenever you cast a spell with mana value 4, you gain 1 life.', { power: '2', toughness: '2' })).automation.level).toBe('full');
    expect(compileCard(card('Example Twins', 'Creature — Human', 'When Example Twins enter and whenever you cast a spell with mana value 4, you gain 1 life for each.', { power: '2', toughness: '2' })).automation.level).not.toBe('full');
  });
  it('parser/holes/r3mech.ts (CR 614.12a, 607.2d): "Believe" and "Doubt" are words a Siege-like choice names; an invented word is not', () => {
    expect(relicFull('As this creature enters, choose Believe or Doubt.\n• Believe -- Whenever you cast a spell, you gain 1 life.\n• Doubt -- Whenever you draw a card, you lose 1 life.')).toBe(true);
    expect(relicFull('As this creature enters, choose Believe or Blorf.\n• Believe -- Whenever you cast a spell, you gain 1 life.\n• Blorf -- Whenever you draw a card, you lose 1 life.')).toBe(false);
  });
  it('render/program.ts#chosenFirstAt (review, CR 608.2c; Cloud std-eoe state.ts#chosen): the announced target is still "it" only for the first instruction; a later "it" after another target is refused', () => {
    const T0 = { id: 't0', kind: 'object', min: 1, max: 1, text: '', filter: { types: ['Creature'] } };
    const T1 = { id: 't1', kind: 'object', min: 1, max: 1, text: '', filter: { types: ['Artifact'] } };
    const def = { kind: 'spell', text: '', effect: { targets: [T0, T1], steps: [{ op: 'tap', what: { ref: 'target', id: 't0' } }, { op: 'destroy', what: { ref: 'target', id: 't1' } }, { op: 'untap', what: { ref: 'target', id: 't0' } }] } };
    const ctx = { selfNames: ['Test Card'], selfTypes: ['Sorcery'] };
    expect(renderGate(def as never, ['Choose target creature. Tap it. Destroy target artifact. Untap it.'], ctx).ok).toBe(false);
    expect(renderGate(def as never, ['Choose target creature. Tap it. Destroy target artifact. Untap that creature.'], ctx).ok).toBe(true);
  });
});
