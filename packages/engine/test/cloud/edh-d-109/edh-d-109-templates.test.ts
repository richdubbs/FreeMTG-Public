/**
 * Round edh-d-109 (Commander coordinator D, EDHREC ranks 10,001-30,000, groups combat 1/2 and 2/2): the template data of parser/templates/zz-cloud/edh-d-109.json (see the file) and the
 * round's parser, lowering, engine and renderer changes, tested at the end of this file and in edh-d-109-scenarios.test.ts.
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
import edhD109 from '../../../src/parser/templates/zz-cloud/edh-d-109.json';
import review from '../../m5/golden/cards/edh-d-109-review.json';
import r5Review from '../../m5/golden/cards/cloud-r5-static-review.json';
import r5 from '../../../src/parser/templates/zz-cloud/r5-static.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhD109 as Template[];
const MECH_COUNT = 9;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the card of the EDHREC top 30,000 that prints the wording and is full (each wording is printed on that one card, or on two)
  'trg.edhd109.self.blocksTwoOrMore': ['Lairwatch Giant'],
  'trg.edhd109.selfAndAtLeastTwo.attack': ['Enkira, Hostile Scavenger'],
  'eff.edhd109.instructionChoice.damageOrDamage': ['Lava Storm'],
  'sta.edhd109.attackingLastChosenPlayer.have': ['Triarch Stalker'],
  'sta.edhd109.attackingLastChosenPlayer.get': ["Beckoning Will-o'-Wisp"],
  'sta.edhd109.self.cantBeBlockedBy.asLongDefendingControls': ['Arctic Foxes'],
  'sta.edhd109.self.cantAttack.ifAttackedYourLastTurn': ['Giant Turtle'],
  'trg.edhd109.creatureDealsCombatDamageToItsOwner': ['The Beast, Deathless Prince'],
  'trg.edhd109.selfAndAnother.attackDifferentPlayers': ['Canal Courier'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its abilities: an instruction on an instant, anything else on an artifact creature. */
const parsedWith = (t: Template, text: string) => parseCard(t.kind === 'effect' ? card('Example Plan', 'Instant', text) : card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }), OPTS).faces[0]!;

describe('edh-d-109 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-109.json, path order: after edh-d-10, before edh-d-11) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-109.json');
    expect(files.indexOf('zz-cloud/edh-d-109.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-10.json'));
    expect(files.indexOf('zz-cloud/edh-d-109.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-11.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhd109.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhd109\./);
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

describe('edh-d-109 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\btwo or more\b/, 'three or more'], [/\bat least two\b/, 'at least three'], [/\battacking creature\b/, 'tapped creature'], [/\bblocking creature\b/, 'untapped creature'],
    [/\blast chosen\b/, 'chosen'], [/\bdefending player\b/, 'you'], [/\byour last turn\b/, 'your next turn'], [/\bits owner\b/, 'its controller'], [/\bdifferent players\b/, 'the same player'],
    [/\battack,/, 'block,'], [/\bcombat damage\b/, 'damage'], [/\bpower 3\b/, 'power 2'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-d-109 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-d-109 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe.skipIf(index === null)('edh-d-109 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-109 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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




describe('edh-d-109 parser, renderer and engine changes (one test each)', () => {
  const creature = (text: string) => parseCard(card('Example Beast', 'Creature — Elf', text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  it('parser/parse.ts#linkLastChosenPlayer (CR 607.2d): the one triggered "choose an opponent" of the face gets the link "the last chosen player" reads; with two such choices, or none, the reader is manual', () => {
    const f = creature('At the beginning of your upkeep, choose an opponent.\nCreatures attacking the last chosen player get +1/+0.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities[0])).toContain('"link":"lastChosenPlayer"');
    expect(fullyAutomated(creature('At the beginning of your upkeep, choose an opponent.\nAt the beginning of your end step, choose an opponent.\nCreatures attacking the last chosen player get +1/+0.'))).toBe(false);
    expect(fullyAutomated(creature('As ~ enters, choose an opponent.\nAt the beginning of your upkeep, choose an opponent.\nCreatures attacking the last chosen player get +1/+0.'))).toBe(false);
    expect(fullyAutomated(creature('Creatures attacking the last chosen player get +1/+0.'))).toBe(false);
  });
  it('render/evt.ts (CR 509.3a): "~ blocks two or more creatures"; the bare "blocks" and "blocks a creature" are other events', () => {
    const a = creature('Whenever ~ blocks two or more creatures, you gain 3 life.');
    expect(fullyAutomated(a)).toBe(true);
    expect(JSON.stringify(a.abilities)).toContain('"attackerAtLeast":2');
    expect(JSON.stringify(creature('Whenever ~ blocks, you gain 3 life.').abilities)).not.toContain('attackerAtLeast');
  });
  it('render/evt.ts (CR 508.1, 603.2c): "~ and at least two other Knights attack" (the "other" of the description) and "~ and at least two Knights attack" are both read; "at least one other" stays the older one', () => {
    const two = creature('Whenever ~ and at least two other Knights attack, you gain 2 life.');
    const bare = creature('Whenever ~ and at least two Knights attack, you gain 2 life.');
    expect(fullyAutomated(two) && fullyAutomated(bare)).toBe(true);
    expect(JSON.stringify(two.abilities)).toContain('"withOther":{"other":true,"subtypes":["Knight"]}'); // the description's own "other" (other than the source: the same set, triggers/match.ts)
    expect(JSON.stringify(creature('Whenever ~ and at least one other Knight attack, you gain 2 life.').abilities)).not.toContain('withOtherAtLeast');
  });
  it('render/evt.ts (CR 508.1b, 506.2): "~ and another creature attack different players"; "the same player" is not read', () => {
    expect(JSON.stringify(creature('Whenever ~ and another creature attack different players, you gain 2 life.').abilities)).toContain('"withOtherDifferentPlayer":true');
    expect(fullyAutomated(creature('Whenever ~ and another creature attack the same player, you gain 2 life.'))).toBe(false);
  });
  it('render/evt.ts (CR 120.1, 108.3): "a creature deals combat damage to its owner"; "to its controller" is not read', () => {
    expect(JSON.stringify(creature('Whenever a creature deals combat damage to its owner, you gain 2 life.').abilities)).toContain('"toSourceOwner":true');
    expect(fullyAutomated(creature('Whenever a creature deals combat damage to its controller, you gain 2 life.'))).toBe(false);
  });
  it('rules/history.ts#historyInScope (CR 500.1): `yourLastTurn` and render/stat.ts: "~ can\'t attack if it attacked during your last turn"; "this turn" is not this reading', () => {
    expect(JSON.stringify(creature("~ can't attack if it attacked during your last turn.").abilities)).toContain('"scope":"yourLastTurn"');
    expect(JSON.stringify(creature("~ can't attack if it attacked this turn.").abilities)).not.toContain('yourLastTurn');
  });
  it('promotion (design 6.9, narrow wording): sta.r5static.blockTax.blocking.life is stable on Heat Wave, whose entry is in the review file of the template\'s own round', () => {
    const t = (r5 as Template[]).find((x) => x.id === 'sta.r5static.blockTax.blocking.life')!;
    expect(t.status).toBe('stable');
    const g = (r5Review as { card: string; verified: string }[]).find((x) => x.card === 'Heat Wave');
    expect(g?.verified).toContain('sta.r5static.blockTax.blocking.life');
  });
});
