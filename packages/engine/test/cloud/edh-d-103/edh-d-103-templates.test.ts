/**
 * Commander lane edh-d (coordinator D, groups replace-prevent and cost), round edh-d-103: the template data of parser/templates/zz-cloud/edh-d-103.json (see the file) and the round's parser,
 * lowering, engine and renderer changes, tested at the end of this file and in edh-d-103-scenarios.test.ts.
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
import edhD103 from '../../../src/parser/templates/zz-cloud/edh-d-103.json';
import review from '../../m5/golden/cards/edh-d-103-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhD103 as Template[];
const MECH_COUNT = 8;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the cards of the EDHREC top 30,000 that print each wording and are full
  'eff.edhd103.preventNext.player.thenDamage': ['Vengeful Archon'],
  'eff.edhd103.nextSourceOfChoice.anyTarget.prevent.colorSourceBack': ['Honorable Passage'],
  'eff.edhd103.preventAll.you.sourceOfChoice.whenColorPrevented.gainLife': ['Samite Ministration'],
  'eff.edhd103.nextSourceOfChoice.chosenColor.you.prevent': ['Story Circle'],
  'eff.edhd103.nextCreatureOfChoice.withShadow.you.prevent': ['Circle of Protection: Shadow'],
  'eff.edhd103.redirect.nextSpellToYou.toItsController': ['Aegis of Honor'],
  'eff.edhd103.preventAll.youAndPerms.bySourcesNotYours.mayDamageBack': ['Channel Harm'],
  'eff.edhd103.preventNext.eachCreatureAndEachPlayer': ['Kitsune Palliator'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /enchanted (creature|land|artifact|permanent|enchantment)/.test(text) ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-d-103 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-103.json, path order: after edh-d-102, before edh-d-11) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-103.json');
    expect(files.indexOf('zz-cloud/edh-d-103.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-102.json'));
    expect(files.indexOf('zz-cloud/edh-d-103.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-11.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 8; ids are *.edhd103.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhd103\./);
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

describe('edh-d-103 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\bnext\b/, 'first'], [/\bprevented\b/, 'dealt'], [/\bcontroller\b/, 'owner'], [/\bshadow\b/, 'flying'], [/\bkicked\b/, 'cast'], [/\beach player\b/, 'each opponent'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-d-103 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-d-103 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe.skipIf(index === null)('edh-d-103 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-103 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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
    // the lines a template's own sentence is on (the last one): a leading "As ~ enters, choose a color." line is the producer another template reads (CR 607.2d), printed on many cards
    const verbatim = MECH.flatMap((t) => [...t.examples.map((e) => e.text), ...t.counterExamples].filter((x) => lines.has(x.split('\n').at(-1)!.trim()) || x.split('\n').slice(0, -1).some((l) => l.trim() !== 'As ~ enters, choose a color.' && lines.has(l.trim()))).map((x) => `${t.id}: ${x}`));
    expect(verbatim).toEqual([]);
  }, 120_000);
});




describe('edh-d-103 parser, renderer and engine changes (one test each)', () => {
  const spell = (text: string, type = 'Instant') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;
  const relic = (text: string) => parseCard(card('Example Relic', 'Artifact', text), OPTS).faces[0]!;
  it('types shield.each + render/stat.ts (CR 615.7, 611.2c; Kitsune Palliator): "each creature and each player" is one shield each; "each creature" alone stays unread', () => {
    expect(fullyAutomated(relic('{T}: Prevent the next 2 damage that would be dealt to each creature and each player this turn.'))).toBe(true);
    expect(ENGINE_CAPABILITIES.has('feature:shield.each')).toBe(true);
    expect(fullyAutomated(relic('{T}: Prevent the next 2 damage that would be dealt to each creature this turn.'))).toBe(false);
  });
  it('parser/lower/util.ts#CHOSEN_LINK_MARKER + lower/links.ts (CR 607.2d; Story Circle): "of the chosen color" names the face\'s "As ~ enters, choose a color."; without it the marker stays and the ability is manual', () => {
    const t = (x: string) => parseCard(card('Example Ward', 'Enchantment', x), OPTS).faces[0]!;
    const a = t('As ~ enters, choose a color.\n{1}{W}: The next time a source of your choice of the chosen color would deal damage to you this turn, prevent that damage.');
    expect(fullyAutomated(a)).toBe(true);
    expect(JSON.stringify(a.abilities)).not.toContain('@chosenLink');
    expect(fullyAutomated(t('{1}{W}: The next time a source of your choice of the chosen color would deal damage to you this turn, prevent that damage.'))).toBe(false);
  });
  it('parser/lower/ability.ts#joinPreventedThisWay (CR 615.5; Honorable Passage, Samite Ministration, Channel Harm): only the exact pairs are joined; another additional sentence stays unread', () => {
    expect(fullyAutomated(spell("The next time a source of your choice would deal damage to any target this turn, prevent that damage. If damage from a green source is prevented this way, ~ deals that much damage to the source's controller."))).toBe(true);
    expect(fullyAutomated(spell("The next time a source of your choice would deal damage to any target this turn, prevent that damage. If damage from a green source is prevented this way, ~ deals that much damage to you."))).toBe(false);
    expect(fullyAutomated(spell('Prevent all damage that would be dealt to you this turn by a source of your choice. Whenever damage from a blue or green source is prevented this way this turn, you gain that much life.'))).toBe(true);
    expect(fullyAutomated(spell('Prevent all damage that would be dealt to you this turn by a source of your choice. Whenever damage from a blue source is prevented this way this turn, you gain that much life.'))).toBe(false);
    expect(fullyAutomated(spell("Prevent all damage that would be dealt to you and permanents you control this turn by sources you don't control. If damage is prevented this way, you may have ~ deal that much damage to any target."))).toBe(true);
  });
  it('effects/handlers/lasting.ts + render/stat.ts (CR 614.9; Aegis of Honor): the redirection to the spell\'s controller is said and kept unfixed; another recipient stays unread', () => {
    expect(fullyAutomated(relic('{1}: The next time an instant or sorcery spell would deal damage to you this turn, that spell deals that damage to its controller instead.'))).toBe(true);
    expect(fullyAutomated(relic('{1}: The next time an instant or sorcery spell would deal damage to target creature this turn, that spell deals that damage to its controller instead.'))).toBe(false);
  });
});
