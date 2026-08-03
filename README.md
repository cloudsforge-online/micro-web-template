# cloudsforge-web-template

[![ci](https://github.com/cloudsforge-online/micro-web-template/actions/workflows/ci.yml/badge.svg)](https://github.com/cloudsforge-online/micro-web-template/actions/workflows/ci.yml)
![licence](https://img.shields.io/badge/licence-MIT-97CA00)
![node](https://img.shields.io/badge/node-%3E%3D22-5FA04E?logo=node.js&logoColor=white)
![typescript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![module](https://img.shields.io/badge/module-ESM-F7DF1E?logo=javascript&logoColor=black)
![tests](https://img.shields.io/badge/tests-headless%20Chromium-2EAD33?logo=googlechrome&logoColor=white)

The skeleton every CloudsForge single-page application is instantiated from. It is a **working
application**, not a scaffold: it boots, redeems an SSO hand-off, refreshes its own tokens,
reports its own errors, renders four honest states and a page of charts, and passes its own CI.
`cfctl new web <name>` copies it.

It exists because the estate has six frontends that each solved these problems separately, and
the copies have already drifted: three chart implementations, six copies of one 261-line
observability client, four spellings of "the request failed", and one SPA fallback that answers
`200 OK` for every address that does not exist.

---

## What you get

| File | What it is |
| --- | --- |
| `src/main.tsx` | The boot sequence, in an order that is not arbitrary — telemetry, then the SSO hand-off, then render. Each step carries the reason it must precede the next. |
| `src/lib/hosts.ts` | Where this app talks to, resolved at runtime from the browser's hostname. The only file that names the surface this app IS. |
| `src/lib/api.ts` | Tokens, the single-flight refresh, one error shape, and the request id that reaches the screen. |
| `src/lib/auth.tsx` | Session state for the tree, and `ProtectedRoute`. |
| `src/lib/obs.ts` | Browser observability: uncaught errors, rejected promises, failed subresources and page-load timing, batched to Lantern. Replaces the copied 261-line client. |
| `src/lib/resource.ts` | One fetch, four states. The loading/empty/failed/forbidden decision, made once as a pure function. |
| `src/lib/series.ts` | Payload to chart data: labels in UTC, allocations sorted and folded, values to paths. |
| `src/components/states.tsx` | The four states, as four visibly different things. |
| `src/components/shell.tsx` | `CloudsForgeBar`, and a sub-nav docked at `var(--cf-bar-h)`. |
| `src/pages/overview.tsx` | The example page. Delete it, keep its shape. |
| `nginx.conf` | The SPA fallback that keeps its 404. |
| `Dockerfile` | Two stages, non-root, no environment baked in, no toolchain in the final image. |
| `.github/workflows/ci.yml` | Typecheck, tests, build, the estate rules as greps, and a Docker build. |

Nothing in `@cloudsforge/ui` is reimplemented here: the bar, the switcher, the marks, the tokens,
the chart primitives and `cloudsforgeHosts()` all come from the design system.

---

## Running it

```sh
pnpm install
pnpm dev                      # http://localhost:5199
```

```sh
pnpm typecheck && pnpm test && pnpm build
```

```sh
# The `uipkg` context is temporary — see "The one temporary thing" below.
docker build -t web-template --build-context uipkg=../ui --build-arg RELEASE="$(git rev-parse --short HEAD)" .
docker run --rm -p 9310:8080 web-template

curl -si localhost:9310/      | head -1   # HTTP/1.1 200 OK
curl -si localhost:9310/nope  | head -1   # HTTP/1.1 404 Not Found  ← the point
```

---

## Instantiating it

1. **Name the surface.** `PRODUCT` and `APP_NAME` in `src/lib/hosts.ts`, `data-cf-product` and
   `data-cf-substrate` in `index.html`, and the `<title>`. `PRODUCT` is a registry key, so it
   selects the accent, the switcher entry marked current and this app's API host in one move.
2. **Rename the package.** `name` in `package.json`.
3. **Delete the example domain.** `src/lib/overview.ts`, `src/pages/overview.tsx` and the sample
   payload inside it. Everything else stays.
4. **Add your routes**, in three places that must agree: the route table in `src/app.tsx`, `NAV`
   in `src/components/shell.tsx`, and the enumerated locations in `nginx.conf`. The third is what
   keeps an unknown path answering 404, and CI greps for the fallback that would break it. Write
   each nginx route as `^/(name)/?$` and **not** `^/(name)(/|$)` unless the router genuinely has
   children there — the second form serves the shell with a 200 for every address beneath the
   route, so the not-found page is delivered as a success. That is the same defect `site` found in
   `/products/pay`, and it was in this template until a browser scenario probed for it.
5. **Rename `BJ-TEMPLATE-404`** in `test/journeys/catalogue.ts` to your surface's key, and add your
   surface's group from `docs/ecosystem/22-browser-journeys.md` beneath the scenarios already
   there. They are the floor every surface owes, not examples to delete.
6. **Keep the four states.** A screen that renders three of them is a screen that reports a
   timeout as "no data" or a missing scope as "try again".
7. **Do not add a `.env` file.** There is a test that fails if one appears, and another that
   fails if any source file reads a build-time variable.

---

## Decisions worth knowing before you change them

**No build-time configuration, at all.** No `.env`, no `VITE_` variable, no `define`. Hosts come
from `cloudsforgeHosts()`, which reads `window.location.hostname` on every call, so ONE image
serves localhost, a preview deployment, staging and production. An image with an environment
baked into it must be rebuilt to be promoted, which means the artefact that reaches production is
not the artefact that passed CI. `test/no-build-time-config.test.ts` greps the source and fails if
this comes back.

**An unknown path answers 404, not 200.** The usual `try_files $uri /index.html` serves the bundle
with a 200 for every address in existence — which is why the site's "page not found" screen is
delivered as a success today, indexed by crawlers and called healthy by monitors. `nginx.conf`
enumerates the client routes instead and lets everything else fall through to
`error_page 404 /index.html`, which serves the same shell while keeping the status. The price is
one line per top-level route.

**One refresh, however many 401s.** Ten requests firing on mount and all failing on an expired
access token must produce ONE call to `/auth/refresh`. Refresh tokens rotate; ten parallel
refreshes means nine of them present a token that has just been superseded, and a user holding a
valid session is signed out. The slot is cleared when the promise settles, so the next expiry
still refreshes.

**The SSO code leaves the address bar before the exchange is sent.** `consumeAuthCallback()`
strips `#cf_code` with `history.replaceState` and *then* posts it. Doing it afterwards leaves the
code in the browser history, in the referrer of anything the page loads next, and in any
screenshot taken while the request is in flight — and on the failure path, never strips it at all.
The test asserts the ORDER, not just the outcome.

**A failed fetch shows its request id.** It is the one string a user can quote that finds their
exact request across every service at once, so it is on screen, in monospace, selectable.

**Forbidden is not failed.** A 403 was understood and refused; retrying cannot help, so that
screen has no retry button. Offering one teaches people the app is unreliable.

**Telemetry never throws, never reports itself, and is bounded.** A reporter that can break the
page it measures is worse than none; a failed report that produces a report is an outage
amplifier; and a component throwing on every frame must cost a fixed number of requests.

**No chart library, and no pie.** The primitives are hand-rolled SVG in the design system,
because a library arrives with its own palette, type scale and opinion about legends, and those
are already decided. A pie asks a reader to compare angles, which they cannot do. There is no
dual axis anywhere: two scales are two panels.

**`link:` rather than `file:` for the design system.** pnpm *packs* a `file:` directory,
honouring that package's `files` field — which lists only `dist` — so the installed copy would
carry an exports map pointing at sources that were never packed. `link:` symlinks the working
tree, which also means an edit in the design system is visible here without a republish.

---

## Tests

`node:test`, and two layers rather than one: a pure-function suite with no DOM, and a browser
suite that drives the built bundle in a real Chromium. 81 tests.

| File | What it pins |
| --- | --- |
| `test/api.test.ts` | Token storage and clearing, the memory fallback, ONE refresh for ten concurrent 401s, a new refresh after the previous settles, session expiry announced once, the request id on the error, 403 marked forbidden, and the auth callback — including that the code is stripped before the exchange is sent, and stripped even when the exchange fails. |
| `test/hosts.test.ts` | Localhost to dev ports, apex derived from a product subdomain, an unknown prefix left alone, a surface that is a path on another surface, and same-origin versus cross-origin API bases. |
| `test/series.test.ts` | Values to SVG paths, a flat series drawn down the middle rather than along the floor, a single point centred, an empty series yielding no path at all, UTC labels, allocations sorted and folded at eight, and the pricing stamp. |
| `test/no-build-time-config.test.ts` | The grep: no `VITE_`, no build-time environment object, no `define`, no `envPrefix`, no `.env` file. |
| `test/obs.test.ts` | The queue bound drops the oldest, and the envelope stamps the page. |

**There is deliberately no jsdom.** It is a second browser implementation to keep current, it
disagrees with real browsers in exactly the places that matter, and a test that renders a
component in it proves the component renders in jsdom. What the browser suite below adds is not
jsdom; it is the actual engine.

### The browser journeys

`test/browser-journeys.test.ts` and `test/journeys/`. Tiers 1 and 2 of
`docs/ecosystem/22-browser-journeys.md` — everything that needs the bundle, a browser and a set of
stubbed responses, and nothing else. Tier 3, which needs the estate up, lives in `micro-beacon`.

**These scenarios cannot tell you the app works.** The browser is real; the network is not.
`test/journeys/browser.ts` installs `page.route('**/*', …)` and answers every request from a
fixture, so an unreachable API, a wrong host, an unrouted path, a CORS refusal or a stylesheet that
404s are all answered with a cheerful 200 and are structurally invisible here. This is not a
hypothetical: the entry point used to be called `open()`, and under that name the estate shipped
three completely unstyled surfaces and four more whose reads 404'd or 401'd in a browser, with CI
green and 314 browser scenarios green. **The tier that can see those is `micro-beacon`'s smoke
tier** — `beacon smoke` / `pnpm smoke` — which drives real Chromium through the real gateway with
nothing intercepted. `test/harness-honesty.test.ts` fails if the honest name, the warning or
beacon's name is ever removed from the harness.

| File | What it is |
| --- | --- |
| `test/journeys/catalogue.ts` | **The scenarios, as data.** This is the one you edit. |
| `test/journeys/browser.ts` | Finds a Chromium and renders the bundle against a **fake network**. Its entry point is `renderOnlyWithStubbedNetwork()`, named so nobody mistakes it for opening the product. |
| `test/journeys/surface.ts` | `vite build`, then serves `dist/` **through this repository's own `nginx.conf`**, parsed rather than restated. |
| `test/journeys/scenario.ts` | The scenario type, and the meta-test that keeps the layer boundary. |
| `test/journeys/axe.ts` | axe-core in the page, plus tab order and document order. |

**It needs a browser and it will not skip without one.** `playwright-core` drives a Chromium the
machine already has — `/usr/bin/google-chrome` on every `ubuntu-latest` runner, Chrome.app on a
Mac, or anything you point `CF_CHROME` at. A browser suite that quietly skips itself is green
everywhere and proves nothing, which is the defect class this estate keeps producing, so a missing
browser is a failure and names every path it looked in.

**A frontend test must never assert a business rule.** A game client once withheld four SKUs from
its UI while the payment routes stayed live and chargeable; a client-side test of the hidden
catalogue would have passed against that defect. So every scenario declares `asserts:
presentation | client-request | navigation`, and anything turning on a server-side rule must name
the server test that owns it in `ownedBy`. `checkCatalogue` fails the suite rather than reporting
green when one does not. Read the header of `scenario.ts` before adding a scenario.

**When you copy this repository:** rename `BJ-TEMPLATE-404` to your surface's key, keep every
other scenario — they are the floor, not examples — and add your surface's own group from doc 22
beneath them.

### What is still untested here because it needs the estate

Each of these is a tier-3 scenario and belongs to `micro-beacon`:

- **Rendering.** Every component in `src/components` and `src/pages`. The pure layer they call is
  tested; the markup they produce is not.
- **`ProtectedRoute` and `AuthProvider`.** The redirect on an anonymous session, the return-URL
  round trip through the Account portal, and the `cf:auth-expired` listener dropping the session.
  The functions they call are tested; the effects that call them are not.
- **The observability listeners.** `window.onerror`, `unhandledrejection`, the subresource-error
  path, `PerformanceNavigationTiming`, `sendBeacon` on `pagehide`, and the `visibilitychange`
  flush. `envelope` and the queue bound are tested; the listeners are not.
- **`localStorage` throwing.** The memory fallback is tested by removing storage; the Safari
  private-window and blocked-iframe cases, where access itself throws, are not reproducible here.
- **Everything visual.** Token application, the sub-nav docking under `var(--cf-bar-h)`, chart
  geometry as drawn, contrast, and focus order.
- **Anything crossing two surfaces.** A session established on one surface and used on another,
  the switcher's URLs resolving, one portfolio total agreeing with another. No single repository's
  PR can establish a property of a *set* of versions.
- **A sign-in page.** Nothing in the estate serves one (doc 22 §8.1), so every scenario downstream
  of a real session is specified and blocked rather than written. `BJ-ACC-01` in the catalogue is
  the record of that.

---

## The one temporary thing

`@cloudsforge/ui` is consumed as `link:../ui/packages/ui` because it is not published yet. Three
places carry that, and all three are marked:

- `package.json` — the `link:` specifier
- `Dockerfile` — the `uipkg` named build context, and the copy of the design system's
  `tsconfig.base.json` that esbuild needs to transform its sources
- `.github/workflows/ci.yml` — the second checkout, and the sibling directory layout

When the package is published, all three become a registry version and nothing else in this
repository changes.

The whole of `.github/workflows/ci.yml` is likewise temporary: it is replaced by a call to
`cloudsforge/.github/.github/workflows/web-ci.yml`, and the target for repositories with a
bespoke CI file is zero.

---

## Provenance

The code in this repository was written by **Claude Opus 5** and **Claude Fable 5**, assets
generated with **FLUX 2 Pro**, under human direction and review.
