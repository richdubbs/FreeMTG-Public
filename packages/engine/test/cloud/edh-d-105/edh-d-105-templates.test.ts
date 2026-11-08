/**
 * Commander coordinator D, round edh-d-105 (EDHREC top 30,000, groups copy and type-change): the template data of parser/templates/zz-cloud/edh-d-105.json (see the file) and the
 * round's parser, lowering, engine and renderer changes, tested at the end of this file and in edh-d-105-scenarios.test.ts.
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
import edhD105 from '../../../src/parser/templates/zz-cloud/edh-d-105.json';
import review from '../../m5/golden/cards/edh-d-105-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';
import { compileCard } from '../../../src/index';


const MECH = edhD105 as Template[];
const MECH_COUNT = 5;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one card, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (decided by the owner's standing
 * rule 2026-10-27; one-card templates are allowed in this effort).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  'eff.edhd105.pump.becomes.cardType.inAddition': ['Thran Forge'],
  'eff.edhd105.becomes.landTypeChoiceOfTwo': ['Tundra Kavu'],
  'eff.edhd105.may.basePt.choiceOfTwo': ['Master of Winds'],
  'eff.edhd105.basePowerOrToughness': ['Vhati il-Dal'],
  'eff.edhd105.eachOtherThanCasterMay.copy.newTargets': ['Curse of Echoes'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a Saga for chapters, a static, activated or triggered ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^I -- /.test(text) ? card('Example Saga', 'Enchantment — Saga', text.replaceAll(' -- ', ' — '))
    : t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-d-105 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-105.json, path order: after edh-d-102.json, before edh-d-11.json) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-105.json');
    expect(files.indexOf('zz-cloud/edh-d-105.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-102.json'));
    expect(files.indexOf('zz-cloud/edh-d-105.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-11.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 105; ids are *.edhd105.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|rst|ch|rid|cm)\.edhd105\./);
      expect(t.cr.length, t.id).toBeGreaterThan(0);
      for (const cr of t.cr) expect(cr, t.id).toMatch(/^CR \d{3}(\.\d+[a-z]?)?$/);
      expect(t.examples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.counterExamples.length, t.id).toBeGreaterThanOrEqual(2);
      expect(['stable', 'experimental'], t.id).toContain(t.status);
      expect(t.since, t.id).toBe(105);
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

describe('edh-d-105 guard G9 (design 6.8): examples and counter-examples', () => {
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

describe('edh-d-105 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-d-105 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe.skipIf(index === null)('edh-d-105 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-105 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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


describe('edh-d-105 parser, lowering, renderer and engine changes (one test each, with the negative case)', () => {
  // the card's automation level as the game compiles it (manual cost parts and capabilities the engine lacks count, which `fullyAutomated` of one face does not see)
  const spellFull = (text: string) => compileCard(card('Example Plan', 'Sorcery', text)).automation.level === 'full';
  const relicFull = (text: string) => compileCard(card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' })).automation.level === 'full';
  const shrineFull = (text: string) => compileCard(card('Example Shrine', 'Enchantment', text)).automation.level === 'full';
  it('render/mods.ts (family becomes-x-over-x; CR 107.3, 205.1b): "becomes an X/X ... creature until end of turn, where X is Q. It\'s still a land." is read with the rider after it; another rider is not', () => {
    expect(relicFull("{T}: Target land you control becomes an X/X Elemental creature until end of turn, where X is the number of Elves you control. It's still a land.")).toBe(true);
    expect(relicFull("{T}: Target land you control becomes an X/X Elemental creature until end of turn, where X is the number of Elves you control. It's still a creature.")).toBe(false);
  });
  it('render/mods.ts (CR 107.3a, 602.2b): the announced X of "{X}: ~ becomes an X/X Wall creature with defender in addition to its other types" has no "where X is" clause; without "in addition to its other types" the wording is not read', () => {
    expect(shrineFull('{X}: ~ becomes an X/X Wall creature with defender in addition to its other types until end of turn.')).toBe(true);
    expect(shrineFull('{X}: ~ becomes an X/X Wall creature with defender until end of turn.')).toBe(false);
  });
  it('parser/holes/misc.ts#basePTSaid (CR 613.4b): only printed numbers are the answers of a choice between two sizes; an X/X size is not', () => {
    expect(relicFull("{1}: You may have target creature's base power and toughness become 3/1 or 1/3 until end of turn.")).toBe(true);
    expect(relicFull("{X}: You may have target creature's base power and toughness become X/X or 1/3 until end of turn.")).toBe(false);
  });
  it('render/fold-edhd105.ts (CR 608.2d, 305.7): a choice of two basic land types is said with "or"; two other subtypes, or no duration, are not this fold', () => {
    expect(relicFull('{T}: Target land becomes a Plains or an Island until end of turn.')).toBe(true);
    expect(relicFull('{T}: Target creature becomes a Goblin or an Elf until end of turn.')).toBe(false);
    expect(relicFull('{T}: Target land becomes a Plains or an Island.')).toBe(false);
  });
  it('keywords/actions/tokens.ts + model/cap-walk.ts (CR 701.36a, 508.4): a single populate takes "The token enters tapped and attacking."; populate twice or another action does not', () => {
    expect(relicFull('Whenever ~ attacks, populate. The token enters tapped and attacking.')).toBe(true);
    expect(relicFull('Whenever ~ attacks, populate twice. The tokens enter tapped and attacking.')).toBe(false);
    expect(relicFull('Whenever ~ attacks, investigate. The token enters tapped and attacking.')).toBe(false);
  });
  it('eff.edhd105.eachOtherThanCasterMay.copy.newTargets (CR 603.7c, 102.1): "each other player" is other than the trigger\'s player; outside a triggered ability the reading is refused', () => {
    expect(shrineFull('Whenever an opponent casts an instant spell, each other player may copy that spell and may choose new targets for the copy they control.')).toBe(true);
    expect(spellFull('Choose target instant spell. Each other player may copy that spell and may choose new targets for the copy they control.')).toBe(false);
    // review (model/cap-walk.ts, feature:each.otherPlayer.thanEventNotCast): in a trigger that is not a cast trigger the event's player is not the caster: refused
    expect(shrineFull('Whenever an instant or sorcery spell you control becomes the target of a spell or ability, each other player may copy that spell and may choose new targets for the copy they control.')).toBe(false);
  });
  it('parser/holes/p2copyperm1.ts + render/copy-except.ts (CR 707.9b, 201.2): a token copy given a new name ("its name is <Name> and ...", "it\'s a legendary <subtype> named <Name>"); a lower-case name or more clauses after the legendary one are not read', () => {
    expect(relicFull("{1}: Create a token that's a copy of target artifact you control, except its name is Test Warform and it's a 4/4 Construct artifact creature in addition to its other types.")).toBe(true);
    expect(relicFull("{1}: Create a token that's a copy of target creature, except it's a legendary Alien named Test Prisoner.")).toBe(true);
    expect(relicFull("{1}: Create a token that's a copy of target artifact you control, except its name is test warform and it's a 4/4 Construct artifact creature in addition to its other types.")).toBe(false);
    expect(relicFull("{1}: Create a token that's a copy of target creature, except it's a legendary Alien named Test Prisoner and it has flying.")).toBe(false);
    // the name alone (nothing after it) is not this reading: it is said first, before the other exceptions
    expect(relicFull("{1}: Create a token that's a copy of target creature, except its name is Test Warform.")).toBe(false);
  });
  it('parser/holes/dur.ts + render/turn.ts (CR 502.1, 611.2a): "until its controller\'s next untap step" of one object; of a group it is not read', () => {
    expect(relicFull("{T}: Target land becomes a Swamp until its controller's next untap step.")).toBe(true);
    expect(relicFull("{T}: All lands become Swamps until their controllers' next untap step.")).toBe(false);
  });
});
