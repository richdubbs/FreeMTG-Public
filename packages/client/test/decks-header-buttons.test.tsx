/**
 * deck-art-1 part 0 (owner, 2026-11-07: "when i click on these buttons they move around and are not consistent"): the deckbuilder's Build / Details /
 * Export keep the same boxes (getBoundingClientRect) in both views, on hover and while pressed, with one height, font, weight and padding, in every
 * theme (Neon Grid, LCARS, Fracture). Real layout needs a browser: the header is rendered to markup and laid out in Chromium with the app's own
 * stylesheets. Skipped where Playwright is not installed.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DeckHeaderActions } from '../src/decks/DeckbuilderScreen';
import type { BuilderView } from '../src/decks/view';

type Browser = { newPage(o: object): Promise<Page>; close(): Promise<void> };
type Page = {
  setContent(html: string): Promise<void>;
  evaluate<T, A>(f: (a: A) => T, a: A): Promise<T>;
  hover(sel: string): Promise<void>;
  mouse: { down(): Promise<void>; up(): Promise<void>; move(x: number, y: number): Promise<void> };
};

function chromium(): { launch(): Promise<Browser> } | null {
  for (const from of [__filename, `${process.env['NODE_PATH'] ?? '/'}/`, '/opt/node-tools/']) {
    try {
      return (createRequire(from)('playwright') as { chromium: { launch(): Promise<Browser> } }).chromium;
    } catch {
      // try the next place
    }
  }
  return null;
}

const browserType = chromium();
const css = ['theme/styles.css', 'theme/neon-grid.css', 'theme/lcars.css', 'theme/fracture.css', 'decks/decks.css']
  .map((f) => readFileSync(path.resolve(__dirname, '..', 'src', f), 'utf8'))
  .join('\n');

const header = (view: BuilderView) =>
  `<header class="deck-titlebar"><button type="button" class="deck-back" aria-label="Back">&lt;</button><h1 class="neon-title deck-title">${view === 'details' ? 'Deck Details' : 'Deckbuilder'}</h1>${renderToStaticMarkup(
    <DeckHeaderActions view={view} onView={() => undefined} exporting={false} onExport={() => undefined} />,
  )}</header>`;

interface Box {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  font: string;
  weight: string;
  padding: string;
}

async function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('.deck-header-actions button')].map((b) => {
        const r = b.getBoundingClientRect();
        const s = getComputedStyle(b);
        return { label: b.textContent ?? '', x: r.x, y: r.y, w: r.width, h: r.height, font: `${s.fontFamily} ${s.fontSize}`, weight: s.fontWeight, padding: s.padding };
      }),
    undefined,
  );
}

describe.skipIf(!browserType)('deck-art-1 part 0: the deckbuilder title bar buttons never move', () => {
  for (const ui of ['grid', 'lcars', 'fracture']) {
    it(`${ui}: Build, Details and Export keep their boxes in both views, on hover and pressed, and share height, font, weight and padding`, async () => {
      const browser = await browserType!.launch();
      try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 400 } });
        const seen: Record<string, Box[]> = {};
        for (const view of ['build', 'details'] as const) {
          await page.setContent(`<!doctype html><html data-ui="${ui}" data-motion="off"><head><style>${css}</style></head><body><div class="screen deckbuilder-screen deck-view-${view}">${header(view)}</div></body></html>`);
          seen[view] = await boxes(page);
          for (const label of ['Build', 'Details', 'Export']) {
            const i = ['Build', 'Details', 'Export'].indexOf(label);
            const sel = i < 2 ? `.deck-segment button:nth-child(${i + 1})` : '.deck-header-actions > button';
            await page.hover(sel);
            seen[`${view} hover ${label}`] = await boxes(page);
            await page.mouse.down();
            seen[`${view} press ${label}`] = await boxes(page);
            await page.mouse.up();
          }
          await page.mouse.move(0, 399);
        }
        const build = seen['build']!;
        expect(build.map((b) => b.label)).toEqual(['Build', 'Details', 'Export']);
        for (const [state, list] of Object.entries(seen)) expect({ state, list }).toEqual({ state, list: build });
        for (const b of build) {
          expect(b.h).toBe(build[0]!.h);
          expect([b.font, b.weight, b.padding]).toEqual([build[0]!.font, build[0]!.weight, build[0]!.padding]);
        }
      } finally {
        await browser.close();
      }
    }, 60_000);
  }
});
