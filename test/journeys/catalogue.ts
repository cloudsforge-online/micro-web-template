/**
 * THE SCENARIOS EVERY FRONTEND CUT FROM THIS TEMPLATE INHERITS.
 *
 * ── Read this before you copy the repository ──────────────────────────────────────────────────
 *
 * This is the scaffold's own slice of docs/ecosystem/22-browser-journeys.md. The ids are the
 * estate-wide ones, because these scenarios are estate-wide properties: `BJ-ACC-06` is the same
 * assertion on every surface, and `BJ-<KEY>-404` is doc 22 §5.1's one-per-surface row. When you
 * instantiate this template:
 *
 *   1. Rename `BJ-TEMPLATE-404` to your surface's key — `BJ-EMBERKIN-404`, `BJ-SITE-404`.
 *   2. Keep every other scenario in this file. They are not examples; they are the floor.
 *   3. Add your surface's own group from doc 22 beneath them.
 *
 * ── Why the floor is what it is ───────────────────────────────────────────────────────────────
 *
 * A frontend can be entirely broken while every check in this estate passes. nginx answers its
 * healthcheck, `GET /` returns 200, the image builds, the bundle exists in `dist/` — and the
 * script tag can still point at a file that 404s, throw on its first line, or be refused by CORS
 * on every call it makes. `domcontentloaded` fires anyway and the network goes perfectly idle.
 * That gap is why `assertMounted` asserts rendered content, console errors and failed requests
 * together rather than any one of them.
 *
 * The precedent is `stack/infra/beacon/src/journeys/web.js`, the frozen estate's browser suite,
 * which is where the "more than 40 characters of body text" floor comes from.
 *
 * ── What these scenarios may NOT do ───────────────────────────────────────────────────────────
 *
 * Assert a business rule. See the header of scenario.ts, and `checkCatalogue`, which fails the
 * suite rather than reporting green when a scenario tries.
 */
import assert from 'node:assert/strict'
import { assertMounted, open } from './browser.ts'
import { assertAxeClean, assertKnownStillBroken, assertLandmarks, assertSkipLink, type KnownViolation } from './axe.ts'
import type { Scenario } from './scenario.ts'

/**
 * The one accessibility defect in this estate that no frontend can fix.
 *
 * `--cf-fg-mute` is `#63757a`, and on the panel and tile surfaces (`#151d21`) it measures
 * **3.54:1** — under the 4.5:1 WCAG AA threshold for normal text. It is a design-system token
 * (`ui/packages/ui/src/ui.css`, `.cf-tile__label`, `.cf-tile__stamp`, and every `--cf-fg-mute`
 * caption), so it fails identically on every surface in the estate at once and changing it here
 * would be a local fork of a shared token.
 *
 * Recorded rather than switched off: `assertAxeClean` asserts the rule is STILL failing as well as
 * asserting nothing else does, so the day micro-ui raises the token this suite goes red and the
 * exclusion has to be deleted. See the header of that function.
 */
export const UI_CONTRAST: readonly KnownViolation[] = [
  {
    rule: 'color-contrast',
    owner:
      'micro-ui — --cf-fg-mute (#63757a) on the panel/tile surface (#151d21) is 3.54:1, against a ' +
      '4.5:1 requirement for normal text',
  },
]

/**
 * The sign-in surface every `signInRedirect()` in the estate points at. Nothing serves it (§8.1).
 *
 * The surface under test is served from 127.0.0.1, which `cloudsforgeHosts()` treats as local, so
 * every other surface resolves to its registry dev port and the stub table can answer by path
 * alone. Nothing here restates the registry: the ports come out of it at runtime, which is the
 * reason the registry exists (`ui/packages/ui/src/surfaces.ts:8-11` — the same list used to be
 * maintained by hand in eight places and had already drifted).
 */
const SIGNIN = 'http://localhost:3010/account'

/** A session this bundle believes in, without a sign-in surface to obtain one from. */
const SIGNED_IN = { 'cf.accessToken': 'test-access', 'cf.refreshToken': 'test-refresh' }

/** identity's `/auth/me`, in the shape identity actually sends: the profile nested under `user`. */
const ME = { user: { id: 'u_1', handle: 'testuser', roles: ['user'] }, session: {}, organisations: [] }

/** A stand-in for a sign-in page, so a redirect to one completes instead of hanging. */
const SIGNIN_STANDIN = {
  status: 200,
  contentType: 'text/html',
  body: '<!doctype html><title>stand-in</title><body>sign-in stand-in</body>',
}

export const CATALOGUE: readonly Scenario[] = [
  /* ---- doc 22 §5.1, the one universal property ------------------------ */
  {
    id: 'BJ-TEMPLATE-404',
    title: 'an address this surface does not own answers 404 and still serves the app shell',
    tier: 2,
    asserts: 'navigation',
    gate: true,
    expectStatus: 404,
    // The rule is nginx's, in this repository, and it is asserted from two directions: the config
    // is read by test/routes-style tests and by CI's `rules` job, and the running image is curled
    // by the `served-headers` job. This scenario is the third: the browser gets a real page.
    ownedBy: 'web-template/nginx.conf#error_page 404 /index.html',
    async run(surface) {
      assert.equal(surface.nginx.honest404, true, 'nginx.conf has no error_page 404 /index.html')

      for (const path of ['/nope', '/settings/deeper/still', '/overview', '/assets/nope.js']) {
        const { status } = await surface.fetchStatus(path)
        assert.equal(status, 404, `${path} answered ${status}; it must answer 404`)
      }
      // A real route still survives a hard refresh, or the 404 above proves only that everything
      // 404s — which is the same lie inverted.
      assert.equal((await surface.fetchStatus('/settings')).status, 200)
      assert.equal((await surface.fetchStatus('/')).status, 200)

      // And the shell really is served under the 404, so the reader gets the app's own not-found
      // page rather than nginx's default error document.
      const unknown = await surface.fetchStatus('/nope')
      assert.match(unknown.body, /<div id="root">/)
      assert.match(unknown.type, /text\/html/)

      // A missing asset answers 404 and the browser therefore never executes it. Note what is NOT
      // asserted: that its BODY is not the shell. `error_page 404 /index.html` is inherited into
      // every location, so nginx really does answer a missing script with the shell's HTML — under
      // a 404, which is what stops it being parsed as JavaScript. Asserting the body here would be
      // asserting something nginx does not do, and the test would have to be weakened later by
      // somebody who could not tell whether it or the config was wrong.
      const asset = await surface.fetchStatus('/assets/nope.js')
      assert.equal(asset.status, 404)

      const session = await open(surface.origin, { path: '/nope', stubs: [] })
      try {
        assert.equal(session.status, 404)
        await assertMounted(session, { showing: ['There is no page at this address'] })
      } finally {
        await session.close()
      }
    },
  },

  /* ---- the floor: the bundle actually runs ---------------------------- */
  {
    id: 'BJ-TEMPLATE-BOOT',
    title: 'the bundle loads, the application mounts, and nothing goes to the console',
    tier: 2,
    asserts: 'presentation',
    gate: true,
    async run(surface) {
      const session = await open(surface.origin, {
        storage: SIGNED_IN,
        stubs: [
          [`GET /auth/me`, { json: ME }],
          [`GET /v1/overview`, { status: 404, json: { error: { code: 'not_found', message: 'no such route' } } }],
        ],
      })
      try {
        const text = await assertMounted(session, { showing: ['Overview'] })
        // The shared bar is the one thing every surface renders and the first thing to disappear
        // when @cloudsforge/ui fails to load — and it fails identically on every surface at once,
        // so it is worth naming precisely rather than reading as "the page looks short".
        assert.ok(text.includes('Settings'), 'the sub-navigation did not render')
        assert.ok(
          await session.page.evaluate(() => document.querySelectorAll('a[href]').length > 0),
          'the page rendered no links at all',
        )
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-ACC-06 ---------------------------------------------- */
  {
    id: 'BJ-ACC-06',
    title: 'the SSO callback code is stripped from the address bar before the exchange is sent',
    tier: 1,
    asserts: 'client-request',
    // The ordering is implemented in @cloudsforge/ui and awaited by main.tsx before React renders.
    // Asserted here in a real browser because the order is between a history API call and a fetch,
    // and a unit test with a stubbed `history` proves the stub was called in order.
    async run(surface) {
      const session = await open(surface.origin, {
        path: '/#cf_code=handoff-code-123',
        stubs: [
          ['POST /auth/handoff/redeem', { json: { accessToken: 'a', refreshToken: 'r' } }],
          ['GET /auth/me', { json: ME }],
          ['GET /v1/overview', { status: 404, json: {} }],
          ['/account/login', SIGNIN_STANDIN],
        ],
      })
      try {
        await assertMounted(session)
        const hash = await session.page.evaluate(() => window.location.hash)
        assert.equal(hash.includes('cf_code'), false, `cf_code is still in the address bar: ${hash}`)

        const redeem = session.apiCalls().find((c) => c.url.includes('/auth/handoff/redeem'))
        assert.ok(redeem, 'the hand-off code was never redeemed')
        // The code went in the BODY of the redemption, never on an address. The whole point of
        // carrying it in the fragment is that it is not in a log, a referrer or a screenshot.
        assert.ok(redeem.body?.includes('handoff-code-123'), 'the code was not sent in the body')
        assert.equal(redeem.url.includes('handoff-code-123'), false, 'the code was put in a URL')
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-ACC-07 ---------------------------------------------- */
  {
    id: 'BJ-ACC-07',
    title: 'an anonymous visitor to a protected route is offered sign-in, carrying the address they asked for',
    tier: 2,
    asserts: 'client-request',
    // NOT a security assertion. Hiding a route is not the boundary — every service verifies the
    // token on the request itself (src/lib/auth.tsx). What is asserted is that the user is sent
    // somewhere they can act, with their destination preserved.
    async run(surface) {
      const session = await open(surface.origin, {
        path: '/settings',
        stubs: [['/account/login', SIGNIN_STANDIN]],
      })
      try {
        await session.page.waitForURL(/\/account\/login/, { timeout: 15_000 })
        const url = new URL(session.page.url())
        assert.equal(url.origin + url.pathname, `${SIGNIN}/login`)
        assert.equal(
          url.searchParams.get('return'),
          `${surface.origin}/settings`,
          'the address the visitor asked for was not carried to sign-in',
        )
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-ADV-23 ---------------------------------------------- */
  {
    id: 'BJ-ADV-23',
    title: 'a failure renders the request id there is to quote at support',
    tier: 1,
    asserts: 'presentation',
    gate: true,
    async run(surface) {
      const session = await open(surface.origin, {
        storage: SIGNED_IN,
        stubs: [
          ['GET /auth/me', { json: ME }],
          [
            'GET /v1/overview',
            {
              status: 503,
              headers: { 'x-request-id': 'cf-req-abc123' },
              json: { error: { code: 'upstream_unavailable', message: 'The ledger did not answer.', requestId: 'cf-req-abc123' } },
            },
          ],
        ],
      })
      try {
        const text = await assertMounted(session)
        assert.ok(text.includes('cf-req-abc123'), `no request id on screen. Page said: ${text.slice(0, 400)}`)
        assert.ok(text.includes('The ledger did not answer.'), 'the service’s own sentence was replaced')
        // The nested envelope, read as flat, renders "[object Object]" and destroys exactly the
        // field a support conversation runs on. That regression is invisible in a diff.
        assert.equal(text.includes('[object Object]'), false)
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 BJ-DSH-09 shape: the app's own failure state ------------ */
  {
    id: 'BJ-TEMPLATE-DEGRADED',
    title: 'a slow upstream leaves the page painted and the pending state announced, not hanging',
    tier: 1,
    asserts: 'presentation',
    async run(surface) {
      const session = await open(surface.origin, {
        storage: SIGNED_IN,
        stubs: [
          ['GET /auth/me', { json: ME }],
          ['GET /v1/overview', { status: 404, json: {}, delayMs: 1500 }],
        ],
      })
      try {
        // Painted long before the slow call settles: the shell and the loading state are on screen
        // while the request is still open. A page that waits for every upstream before its first
        // paint is a page that is blank for as long as its slowest dependency.
        const early = await session.page.evaluate(() => document.body?.innerText ?? '')
        assert.ok(early.trim().length > 40, 'nothing was painted while the upstream was slow')
        await assertMounted(session)
      } finally {
        await session.close()
      }
    },
  },

  /* ---- doc 22 group T, accessibility ---------------------------------- */
  {
    id: 'BJ-A11Y-01',
    title: 'axe finds no serious or critical violation on any route of this surface',
    tier: 2,
    asserts: 'presentation',
    gate: true,
    async run(surface) {
      const stubs = [
        ['GET /auth/me', { json: ME }],
        ['GET /v1/overview', { status: 404, json: {} }],
        ['/account/login', SIGNIN_STANDIN],
      ] as const
      const seen = new Set<string>()
      for (const path of ['/', '/settings']) {
        const session = await open(surface.origin, { path, storage: SIGNED_IN, stubs })
        try {
          await assertMounted(session)
          for (const id of await assertAxeClean(session.page, path, UI_CONTRAST)) seen.add(id)
        } finally {
          await session.close()
        }
      }
      assertKnownStillBroken(seen, UI_CONTRAST)
      // The not-found page carries no muted caption, so it is held to the whole rule set with no
      // exclusion at all — which is also what proves the exclusion above is scoped and not global.
      const missing = await open(surface.origin, { path: '/nope', stubs })
      try {
        await assertMounted(missing)
        await assertAxeClean(missing.page, '/nope')
      } finally {
        await missing.close()
      }
    },
  },
  {
    id: 'BJ-A11Y-03',
    title: 'a failure state is announced rather than drawn, and axe is clean while it is on screen',
    tier: 1,
    asserts: 'presentation',
    gate: true,
    async run(surface) {
      const session = await open(surface.origin, {
        storage: SIGNED_IN,
        stubs: [
          ['GET /auth/me', { json: ME }],
          ['GET /v1/overview', { status: 503, json: { error: { code: 'x', message: 'The ledger did not answer.' } } }],
        ],
      })
      try {
        await assertMounted(session)
        // role="alert" rather than colour: an error a screen reader is never told about is an
        // error only sighted users have.
        assert.ok(
          await session.page.evaluate(() => document.querySelector('[role="alert"]') !== null),
          'the failure state is not announced — no role="alert" on the page',
        )
        await assertAxeClean(session.page, 'the failure state')
      } finally {
        await session.close()
      }
    },
  },
  {
    id: 'BJ-A11Y-12',
    title: 'a reachable skip link, one main landmark, and a heading order with no level skipped',
    tier: 2,
    asserts: 'presentation',
    async run(surface) {
      for (const path of ['/', '/settings']) {
        const session = await open(surface.origin, {
          path,
          storage: SIGNED_IN,
          stubs: [
            ['GET /auth/me', { json: ME }],
            ['GET /v1/overview', { status: 404, json: {} }],
          ],
        })
        try {
          await assertMounted(session)
          await assertLandmarks(session.page, path)
          await assertSkipLink(session.page, path)
        } finally {
          await session.close()
        }
      }
    },
  },

  /* ---- specified, and not writable today ------------------------------ */
  {
    id: 'BJ-ACC-01',
    title: 'register from the sign-in surface and arrive back with a session',
    tier: 2,
    asserts: 'presentation',
    gate: true,
    blocked:
      'Nothing in the estate serves a sign-in page (doc 22 §8.1). Every SPA’s signInRedirect() ' +
      'sends the browser to ${accountUrl()}/login, and no repository in the working tree serves ' +
      '/login: micro-identity renders no HTML at all. Until a sign-in surface exists, no browser ' +
      'scenario downstream of a session can be written — which is most of doc 22’s ★ set.',
  },
]
