/**
 * A frontend measures nothing, or it measures with a banner. There is no third state.
 *
 * ── WHY THIS IS A TEMPLATE TEST (micro-org#487) ────────────────────────────────────────────────
 *
 * The tag was live on the marketing site and on NO other surface. Every frontend in the estate was
 * cut from this template, every one of them passed its own suite, typechecked, built and went
 * green in CI — because nothing anywhere asserted that a page can report a page view. It is the
 * same shape of defect as the three frontends that shipped with no favicon, and
 * `brand-chrome.test.ts` beside this file already makes the argument: an OMISSION is inherited,
 * so the place to fail is the template.
 *
 * ── AND WHY IT ASSERTS ALL THREE HALVES TOGETHER ───────────────────────────────────────────────
 *
 * micro-org#313 was this defect in reverse: the cookie behaviour and the privacy notice disagreed,
 * in the direction of the notice promising less than the page did. A measurement ID in the head
 * with no banner in the shell is the same disagreement pointing the other way — the notice says
 * the reader may choose, and no surface offers the choice. So the three are checked as one thing:
 *
 *   index.html          carries the property ID, and NOT a loader for the third-party tag
 *   src/main.tsx        primes Consent Mode denied before anything can arrive
 *   components/shell.tsx draws the banner, which is the only thing that can change that
 *
 * A surface that legitimately measures nothing — the operator console, the operator's dashboard,
 * the synthetic-traffic runner — removes the meta tag AND records why in its own index.html. This
 * test then asks for neither of the other two. What it will not allow is one without the others.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const at = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const HTML = readFileSync(at('index.html'), 'utf8')
const MAIN = readFileSync(at('src/main.tsx'), 'utf8')
const SHELL = readFileSync(at('src/components/shell.tsx'), 'utf8')

/** The tag ID as it appears in the head, or null when this surface has opted out of measuring. */
function measurementId(): string | null {
  const found = /<meta\s+name="cf-analytics"\s+content="([^"]*)"/.exec(HTML)
  return found?.[1] ? found[1] : null
}

test('the head names the analytics property, in a meta tag read at runtime', () => {
  const id = measurementId()
  assert.notEqual(id, null, 'index.html carries no cf-analytics meta tag')
  // Google's own format. A blank content attribute is the same as no tag to `initAnalytics`, so
  // it is caught here rather than read as "measuring, quietly, at nothing".
  assert.match(id ?? '', /^G-[A-Z0-9]{6,}$/, `${String(id)} is not a GA4 measurement ID`)
})

test('the head does NOT carry the tag itself, which would set a cookie before any answer', () => {
  // The whole argument for the meta tag. Under ePrivacy Art. 5(3) an analytics cookie set before
  // consent is a violation that a banner underneath it does not cure, and Google's stock snippet —
  // a loader for its tag manager followed by a config call — sets `_ga` the moment it loads.
  // `@cloudsforge/ui/consent` injects that script from exactly one place: Accept.
  //
  // WRITTEN AS A PROPERTY OF EVERY SCRIPT, NOT AS A LIST OF VENDOR NAMES. The first draft matched
  // four literal vendor strings and failed CI, which was the right answer to the wrong question:
  // micro-org's `source-scan` step forbids those exact strings in every file of every frontend
  // (AD-21), and it blanks comments before matching, so a test asserting their ABSENCE is
  // indistinguishable to it from a page loading them. There is no version of that list worth
  // smuggling past the scan, because the scan already checks it on this whole repository and does
  // it better. What is left for this file to assert is the stronger, vendor-free property: this
  // document loads nothing off-origin and runs nothing inline, so NOTHING can execute here before
  // the banner is answered — which also holds for the next vendor, whoever that turns out to be.
  const scripts = [...HTML.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  assert.ok(scripts.length > 0, 'index.html has no script at all — is this still a Vite entry point?')
  for (const [, attrs, body] of scripts) {
    assert.equal(
      (body ?? '').trim(),
      '',
      'index.html runs an inline script; nothing may run in this document before an answer',
    )
    const src = /\bsrc="([^"]*)"/.exec(attrs ?? '')?.[1] ?? ''
    assert.match(
      src,
      /^\.{0,2}\//,
      `index.html loads "${src}" — only a same-origin, path-relative script may load before an answer`,
    )
  }
})

test('boot primes Consent Mode denied, from the shared module', () => {
  assert.match(
    MAIN,
    /import \{[^}]*\binitAnalytics\b[^}]*\} from '@cloudsforge\/ui\/consent'/,
    'src/main.tsx does not import initAnalytics from the shared consent module',
  )
  assert.match(MAIN, /^initAnalytics\(\)$/m, 'src/main.tsx never calls initAnalytics()')
})

test('it primes them BEFORE React mounts, because a default installed late is a race', () => {
  // The losing branch of that race is the one that sets a cookie. Ordering, not presence, is the
  // property — both lines can be there and the guarantee still be absent.
  const primed = MAIN.indexOf('initAnalytics()')
  const rendered = MAIN.indexOf('createRoot(')
  assert.ok(primed > -1 && rendered > -1, 'expected both a prime and a render in src/main.tsx')
  assert.ok(primed < rendered, 'initAnalytics() runs after the first render, which is a race')
})

test('the shell draws the banner, which is the only thing that may load the tag', () => {
  assert.match(
    SHELL,
    /import \{[^}]*\bCookieBanner\b[^}]*\} from '@cloudsforge\/ui'/,
    'the shell does not import CookieBanner',
  )
  assert.match(SHELL, /<CookieBanner \/>/, 'the shell never renders <CookieBanner />')
})

test('the banner is the last thing in the shell, so it cannot trap a reader', () => {
  // Not modal, and last in the tab order on purpose: a reader who came here to read a page reads
  // it and answers afterwards. A consent banner that traps focus is the coercion the regulation
  // is about.
  const banner = SHELL.indexOf('<CookieBanner />')
  const footer = SHELL.indexOf('<CloudsForgeFooter')
  assert.ok(footer > -1, 'the shell has no footer to place the banner after')
  assert.ok(banner > footer, 'the banner is drawn before the footer, so it is not last in the order')
})

test('the three halves stand or fall together', () => {
  // The assertion micro-org#487 is actually about. An ID with no banner is a page whose privacy
  // notice promises a choice it does not offer; a banner with no ID is a question asked for
  // nothing. A surface may have neither — and then it says why, in its own index.html.
  const measuring = measurementId() !== null
  assert.equal(
    MAIN.includes('initAnalytics()'),
    measuring,
    'the measurement ID and the Consent Mode default disagree',
  )
  assert.equal(
    SHELL.includes('<CookieBanner />'),
    measuring,
    'the measurement ID and the consent banner disagree',
  )
})
