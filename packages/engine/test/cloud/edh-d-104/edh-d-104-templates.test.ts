/**
 * Commander coordinator D, round edh-d-104 (EDHREC ranks 10,001-30,000, groups exile-play, players-life, sacrifice-destroy, rest 2/2): the template data of parser/templates/zz-cloud/edh-d-104.json (see the file) and the round's parser, lowering,
 * engine and renderer changes, tested at the end of this file and in edh-d-104-scenarios.test.ts.
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
import edhD104 from '../../../src/parser/templates/zz-cloud/edh-d-104.json';
import review from '../../m5/golden/cards/edh-d-104-review.json';
import { automated, bare, card, fullyAutomated, jsonKey } from '../../m5/templates/support';
import { localIndex } from '../../m5/parser/support';

const MECH = edhD104 as Template[];
const MECH_COUNT = 3;
/**
 * design 6.9 deviation (docs/CARD_AUTOMATION.md section 5, "Narrow wordings"): templates made stable on fewer than three golden cards because Oracle prints the
 * wording on only one or two cards, with their template tests (G9, G2) and played scenarios. Listed in the round's record for the owner (DECIDED BY DEFAULT,
 * owner instruction 2026-10-21).
 */
const NARROW: Readonly<Record<string, readonly string[]>> = {
  // the card of the EDHREC top 30,000 that prints each wording and is full (each wording is printed on that one card)
  'rid.edhd104.playThisWay.effects': ['Fires of Mount Doom'],
  'eff.edhd104.otherLinkedOwn.toHand': ['Moonring Mirror'],
  'eff.edhd104.mayCast.obj.byPayingMana': ['Jadzi, Oracle of Arcavios // Journey to the Oracle'],
};
const OPTS = defaultParseOptions({ templates: [...TEMPLATE_SET], capabilities: ENGINE_CAPABILITIES }); // what a decklist card gets (design 5.2; `needs`)

/** A synthetic card with the example as its ability: a static or an activated ability on an artifact creature, a spell otherwise. */
const parsedWith = (t: Template, text: string) => parseCard(
  /^[+\u2212-]\d+:/.test(text) || /loyalty counter/.test(text) ? card('Example Sage', 'Legendary Planeswalker — Example', text, { loyalty: '4' }) :
  /enchanted (creature|land|artifact|permanent|enchantment)/.test(text) ? card(
    'Example Boon', 'Enchantment — Aura', text) :
  t.kind === 'static' || text.includes(':') || /^(When|Whenever|At the beginning)/.test(text) || (text.startsWith('~') && !text.includes('as you cast ~')) ? card('Example Relic', 'Artifact Creature — Construct', text, { power: '2', toughness: '2' }) : card('Example Plan', 'Sorcery', text), OPTS).faces[0]!;

describe('edh-d-104 template file (design 6.3, 6.9; CONTRIBUTING "Adding a template")', () => {
  it('is loaded by the default compiler (zz-cloud/edh-d-104.json, path order: after edh-d-102, before edh-d-11) and its ids are unique in the whole set', () => {
    const files = TEMPLATE_FILES.map((f) => f.file);
    expect(files).toContain('zz-cloud/edh-d-104.json');
    expect(files.indexOf('zz-cloud/edh-d-104.json')).toBeGreaterThan(files.indexOf('zz-cloud/edh-d-102.json'));
    expect(files.indexOf('zz-cloud/edh-d-104.json')).toBeLessThan(files.indexOf('zz-cloud/edh-d-11.json'));
    const ids = TEMPLATE_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(validateTemplates([...TEMPLATE_SET])).toEqual([]);
  });
  it('design 6.9: every template cites rules, has at least two examples and two counter-examples, a status, and is of version 9; ids are *.edhd104.*', () => {
    expect(MECH.length).toBe(MECH_COUNT);
    for (const t of MECH) {
      expect(t.id, t.id).toMatch(/^(eff|sta|rep|trg|ch|rid|cm|dl)\.edhd104\./);
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

describe('edh-d-104 guard G9 (design 6.8): examples and counter-examples', () => {
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
    [/\bplay a card\b/, 'cast a card'], [/\bother cards\b/, 'cards'], [/\binto your hand\b/, 'into your graveyard'], [/\brather than\b/, 'in addition to'], [/\{2\}/, '{3}'], [/\bface down\b/, 'face up'],
  ];
  for (const [re, by] of swaps) if (re.test(text)) out.push(text.replace(re, by));
  return out;
}

describe('edh-d-104 guard G9 (design 6.8): near-miss mutations fail or differ', () => {
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

describe('edh-d-104 guard G2 (design 6.8): a nonsense word never leaves an automated card', () => {
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

describe.skipIf(index === null)('edh-d-104 design 6.10 (local index): synthetic examples', () => {
  it('no edh-d-104 line of an example or counter-example is a line of a real card (with the card\'s own name or "this <type>" read as "~")', () => {
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




describe('edh-d-104 parser, renderer and engine changes (one test each)', () => {
  const spell = (text: string, type = 'Sorcery') => parseCard(card('Example Plan', type, text), OPTS).faces[0]!;
  const creature = (text: string) => parseCard(card('Example Beast', 'Creature — Elf', text, { power: '2', toughness: '2' }), OPTS).faces[0]!;
  const enchantment = (text: string) => parseCard(card('Example Relic', 'Enchantment', text), OPTS).faces[0]!;
  it('parser/parse.ts#exiledCardLinkable (CR 702.75a, 607.2a; Widespread Thieving): "the exiled card" of a free play after a payment names the card a hideaway keyword exiled; without hideaway, or beside an instruction that exiles several cards, it stays unread', () => {
    const pay = 'Whenever you cast a colorless spell, you may pay {4}. If you do, you may play the exiled card without paying its mana cost.';
    const f = enchantment(`Hideaway 4\n${pay}`);
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('{"ref":"linked","link":"exiled"}');
    expect(fullyAutomated(enchantment(pay))).toBe(false);
    expect(fullyAutomated(enchantment(`Hideaway 4\n{T}: Exile the top two cards of your library.\n${pay}`))).toBe(false);
  });
  it('parser/lower/anaphora.ts (resolveUnit, rider; CR 608.2c, 400.7; Heaven Sent): in an "Otherwise" sentence, "it" after "exile ~" is the card that sentence exiled; the earlier branch\'s move is still no antecedent there', () => {
    const f = spell('If you control a Swamp, draw a card. Otherwise, exile this spell and you may cast it this turn.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"as":"moved"');
    expect(fullyAutomated(spell('If you control a Swamp, draw a card. Otherwise, you may cast it this turn.'))).toBe(false);
  });
  it('parser/lower/anaphora.ts#resolveIn + render/refs.ts (cardOnly; CR 305.1, 601.2a; Daredevil, Fearless Fighter): "you may play it" names the exiled card, not the permanent named in between; with the permanent as the only candidate it stays unread', () => {
    const text = 'Exile the top card of your library. This creature deals 2 damage to you. You may play it this turn.';
    expect(fullyAutomated(creature(`{T}: ${text}`))).toBe(true);
    expect(fullyAutomated(creature('{T}: This creature deals 2 damage to you. You may play it this turn.'))).toBe(false); // only the permanent is left: no tie to break
  });
  it("parser/holes/player.ts (weak reading; CR 115.1, 109.4; Pulse of the Forge): \"that player or that planeswalker's controller\" after \"target player or planeswalker\" is the target or its controller; \"that player or that creature's controller\" stays unread", () => {
    const f = spell("This spell deals 3 damage to target player or planeswalker. Then if that player or that planeswalker's controller has more life than you, you draw a card.", 'Instant');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"orPlayer":true');
    expect(fullyAutomated(spell("This spell deals 3 damage to target player or planeswalker. Then if that player or that creature's controller has more life than you, you draw a card.", 'Instant'))).toBe(false);
  });
  it('parser/parse.ts#linkExiled, #plainExilesOnly (CR 607.2a; Moonring Mirror): a group reader that exiles cards itself is linked with the face\'s other plain exiles; beside an exile "until", it stays unread', () => {
    const tail = 'At the beginning of your upkeep, you may exile all cards from your hand face down. If you do, put all other cards you own exiled with this enchantment into your hand.';
    const f = enchantment(`Whenever you gain life, exile the top card of your library face down.\n${tail}`);
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities).split('"link":"exiled"').length - 1).toBe(3); // both exiles carry the link, and the reader reads it
    expect(fullyAutomated(enchantment(`When this enchantment enters, exile target creature an opponent controls until this enchantment leaves the battlefield.\n${tail}`))).toBe(false);
  });
  it('types/ability.ts PermissionDef.onCastLand + render/stat.ts#permitRiders (CR 603.7a, 305.1; Fires of Mount Doom): the play permission carries "when you play a card this way" (capability feature:permit.play.onCastLand); after a cast permission it stays unread', () => {
    const f = parseCard(card('Example Relic', 'Artifact', '{1}: Exile the top card of your library. You may play that card this turn. When you play a card this way, you gain 1 life.'), OPTS).faces[0]!;
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"onCastLand":true');
    expect(ENGINE_CAPABILITIES.has('feature:permit.play.onCastLand')).toBe(true);
    expect(fullyAutomated(parseCard(card('Example Relic', 'Artifact', '{1}: Exile the top card of your library. You may cast that card this turn. When you play a card this way, you gain 1 life.'), OPTS).faces[0]!)).toBe(false);
  });
  it('parser/holes/dur.ts + render/dur.ts + core/durations.ts (endOfCombatNextTurn; CR 611.2a, 500.5a; Brazen Cannonade): "until end of combat on your next turn" is read (capability dur:endOfCombatNextTurn); "until end of combat on your next upkeep" is not', () => {
    const f = enchantment('At the beginning of your end step, exile the top card of your library. Until end of combat on your next turn, you may play that card.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"d":"endOfCombatNextTurn"');
    expect(ENGINE_CAPABILITIES.has('dur:endOfCombatNextTurn')).toBe(true);
    expect(fullyAutomated(enchantment('At the beginning of your end step, exile the top card of your library. Until end of combat on your next upkeep, you may play that card.'))).toBe(false);
  });
  it('parser/holes/moved.ts (CR 701.8a, 608.2c; Cosmic Horror): "if ~ is destroyed this way" after a destroy of ~ is a `did` with `which` {self}; "if ~ is sacrificed this way" after a destroy stays unread', () => {
    const f = creature('At the beginning of your upkeep, destroy this creature unless you pay {2}. If this creature is destroyed this way, it deals 3 damage to you.');
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"which":{"self":true}');
    expect(fullyAutomated(creature('At the beginning of your upkeep, destroy this creature unless you pay {2}. If this creature is sacrificed this way, it deals 3 damage to you.'))).toBe(false);
  });
  it('parser/holes/moved.ts + render/moved.ts (CR 701.21a, 608.2c; Gargantuan Gorilla): "if you don\'t sacrifice a Forest" names the optional sacrifice before it (not done); with no sacrifice before it, it stays unread', () => {
    const f = creature("At the beginning of your upkeep, you may sacrifice a Forest. If you sacrifice a snow Forest this way, this creature gains trample until end of turn. If you don't sacrifice a Forest, sacrifice this creature.");
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"not":true,"which":{"subtypes":["Forest"],"controller":"you"}');
    expect(fullyAutomated(creature("At the beginning of your upkeep, you draw a card. If you don't sacrifice a Forest, sacrifice this creature."))).toBe(false);
  });
  it('render/steps-zones.ts#manaInstead (CR 118.9, 601.2b; Jadzi, Oracle of Arcavios): a cast for a mana alternative cost is said "by paying {N} rather than paying its mana cost"; a free cast keeps its own words', () => {
    const f = creature("Whenever you cast an instant spell, reveal the top card of your library. If it's a creature card, you may cast it by paying {G} rather than paying its mana cost.");
    expect(fullyAutomated(f)).toBe(true);
    expect(JSON.stringify(f.abilities)).toContain('"costChange":{"kind":"set","cost":{"mana":[{"kind":"colored","color":"G"}]},"name":"alternative"}');
    expect(fullyAutomated(creature("Whenever you cast an instant spell, reveal the top card of your library. If it's a creature card, you may cast it by paying {G} rather than paying its mana value."))).toBe(false);
  });
});
