/**
 * axe-core, run inside the page.
 *
 * doc 22 group T asks for axe on every route of every surface and on every modal, failing on any
 * serious or critical violation. `axe-core` is a single self-contained script with no browser of
 * its own, so it is injected into the page the suite already has rather than pulling in
 * `@axe-core/playwright` — which would be a second dependency wrapping the same file.
 *
 * ── Serious and critical only, and why the line is drawn there ────────────────────────────────
 *
 * axe's `minor` and `moderate` findings include things that are matters of taste in a design
 * system (region landmarks on a fragment, colour contrast at 4.4:1). Failing on them would produce
 * a suite people switch off. `serious` and `critical` are the ones a screen-reader user cannot
 * work around, and 14 §11 names exactly that threshold.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import type { Page } from 'playwright-core'

const require = createRequire(import.meta.url)

let source: string | null = null
function axeSource(): string {
  if (source === null) source = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')
  return source
}

export interface Violation {
  readonly id: string
  readonly impact: string
  readonly help: string
  readonly nodes: string[]
}

export interface AxeOptions {
  /** Restrict the sweep to one subtree — the open dialog, for a modal scenario. */
  readonly within?: string
  /**
   * Rules to switch off, each with the reason. Empty by default and expected to stay that way:
   * an exclusion here is a defect somebody decided not to fix, so it has to be written down.
   */
  readonly disable?: ReadonlyArray<readonly [rule: string, why: string]>
}

/** Every serious or critical violation on the page as it currently stands. */
export async function axeViolations(page: Page, options: AxeOptions = {}): Promise<Violation[]> {
  await page.evaluate(axeSource())
  const disabled = (options.disable ?? []).map(([rule]) => rule)
  const raw = await page.evaluate(
    async ({ within, disabled: off }: { within: string | null; disabled: string[] }) => {
      const axe = (globalThis as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<unknown> } }).axe
      const context = within ?? document
      const rules = Object.fromEntries(off.map((r) => [r, { enabled: false }]))
      const result = (await axe.run(context, { resultTypes: ['violations'], rules })) as {
        violations: Array<{ id: string; impact: string; help: string; nodes: Array<{ html: string }> }>
      }
      return result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 160)),
      }))
    },
    { within: options.within ?? null, disabled },
  )
  return raw.filter((v) => v.impact === 'serious' || v.impact === 'critical')
}

export function describeViolations(violations: readonly Violation[]): string {
  return violations
    .map((v) => `  [${v.impact}] ${v.id}: ${v.help}\n    ${v.nodes.join('\n    ')}`)
    .join('\n')
}

/**
 * A violation this surface cannot fix, with who can.
 *
 * ── Why an exclusion list is safe here and is not a way of switching the check off ─────────────
 *
 * `assertAxeClean` asserts BOTH directions: nothing outside the list, and every entry in the list
 * still failing. So an exclusion cannot outlive the defect — the day the owner fixes it, this
 * suite goes red and the entry has to be deleted. An exclusion that could quietly stay for ever
 * would be the same defect as a test that can only pass, which is the class this whole suite was
 * written to stop the estate producing.
 */
export interface KnownViolation {
  readonly rule: string
  /** The repository that owns the fix, and what is actually wrong. */
  readonly owner: string
}

export async function assertAxeClean(
  page: Page,
  where: string,
  known: readonly KnownViolation[] = [],
  options: AxeOptions = {},
): Promise<void> {
  const violations = await axeViolations(page, options)
  const allowed = new Set(known.map((k) => k.rule))

  const unexpected = violations.filter((v) => !allowed.has(v.id))
  if (unexpected.length > 0) {
    throw new Error(`${where}: axe found serious or critical violations\n${describeViolations(unexpected)}`)
  }

  const seen = new Set(violations.map((v) => v.id))
  const fixed = known.filter((k) => !seen.has(k.rule))
  if (fixed.length > 0) {
    throw new Error(
      `${where}: ${fixed.map((f) => f.rule).join(', ')} no longer fails here.\n` +
        `That is good news and the exclusion must now be deleted from this scenario:\n` +
        fixed.map((f) => `  ${f.rule} — was owned by ${f.owner}`).join('\n'),
    )
  }
}

/**
 * The DOM order of two pieces of text.
 *
 * Several scenarios in doc 22 are about ORDER — "the disclosure is above the stake form", "the
 * caveats come before the instructions", "the sources precede the approve control". Order in the
 * accessibility tree is what a screen-reader user and a keyboard user actually get, so it is read
 * from the rendered text rather than from the source file.
 */
export async function textOrder(page: Page, first: string, second: string): Promise<'before' | 'after' | 'missing'> {
  return page.evaluate(
    ([a, b]: [string, string]) => {
      const text = document.body?.innerText ?? ''
      const i = text.indexOf(a)
      const j = text.indexOf(b)
      if (i === -1 || j === -1) return 'missing' as const
      return i < j ? ('before' as const) : ('after' as const)
    },
    [first, second] as [string, string],
  )
}

/**
 * The tab order, as a list of accessible names.
 *
 * Used by the keyboard-only scenarios. Reads `document.activeElement` after each `Tab`, which is
 * the same thing a keyboard user experiences and is not derivable from the markup: a `tabindex`,
 * a focus trap or an `inert` ancestor all change it without changing document order.
 */
export async function tabOrder(page: Page, steps: number): Promise<string[]> {
  const order: string[] = []
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab')
    order.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || el === document.body) return '(body)'
        const label =
          el.getAttribute('aria-label') ??
          el.getAttribute('placeholder') ??
          (el.innerText || el.getAttribute('title') || el.getAttribute('name') || '')
        return `${el.tagName.toLowerCase()}:${label.trim().slice(0, 40)}`
      }),
    )
  }
  return order
}
