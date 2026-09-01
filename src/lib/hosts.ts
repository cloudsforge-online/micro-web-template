/**
 * Where this app talks to, resolved at runtime.
 *
 * `cloudsforgeHosts()` reads `window.location.hostname` on every call, so the same bundle
 * addresses `http://localhost:4006` when served from localhost and `https://trade.<apex>` when
 * served from the apex. Nothing here reads a build-time constant; see the note in vite.config.ts.
 */
import { apiBaseFor, cloudsforgeHosts, type CloudsForgeHosts, type SurfaceKey } from '@cloudsforge/ui'

/**
 * The surface this application IS.
 *
 * Changed once on instantiation, together with `data-cf-product` in index.html and the title.
 * It selects the switcher entry that is marked current, and it names this app's own API host.
 */
export const PRODUCT: SurfaceKey = 'trade'

/** The name reported to the observability ingest and shown in error copy. */
export const APP_NAME = 'trade'

/**
 * The base URL for this app's OWN API — the shared derivation, not a copy of it.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **THIS FILE HELD THE SIXTEENTH COPY OF A REGISTRY DERIVATION, AND IT IS THE ONE EVERY NEW
 * SURFACE IS SCAFFOLDED FROM.**
 *
 * What stood here compared origins and answered `''` for same-origin, `hosts[key]` otherwise.
 * That was right while every surface was its own hostname and wrong in both branches once a
 * surface could be mounted at a PATH, which the apex consolidation made true of six of them:
 *
 *   * same origin → `''` sends a relative `/v1/overview` from a page at `/trade/anything` to the
 *     APEX ROOT, which is micro-site's. micro-site answers its SPA shell for an unknown path, so
 *     the call returns 200 with an HTML body where JSON was expected: every panel in a failure
 *     state with a completely healthy network tab.
 *   * cross origin → `hosts[key]` is the surface's PUBLIC address, mount included. Under
 *     `pnpm dev` there is no Traefik to strip that mount, so the request goes to
 *     `http://localhost:4006/trade/v1/overview` and the service — which serves `/v1/…` at its
 *     root — 404s every call a developer makes.
 *
 * The second one is how this was found: `BJ-TEMPLATE-BOOT` and six other journeys failed on an
 * unstubbed `http://localhost:4006/trade/v1/overview`, and the template's CI had not run in the
 * fortnight the consolidation landed in.
 *
 * `apiBaseFor` in `@cloudsforge/ui` answers both correctly and is property-tested over the whole
 * registry. Its own header says why it exists: this estate has been bitten three times by a
 * SECOND copy of a registry derivation. This was the copy.
 *
 * Re-exported rather than deleted because the tests and `lib/api.ts` both name it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export const resolveApiBase = apiBaseFor

/** Every CloudsForge base URL, for the current environment. */
export function hosts(): CloudsForgeHosts {
  return cloudsforgeHosts()
}

/** This app's API base, resolved now. Call it per request; never cache it in a module constant. */
export function apiBase(): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return resolveApiBase(origin, cloudsforgeHosts(), PRODUCT)
}

/** The page origin, or a stable placeholder when there is no document (tests, prerender). */
export function pageOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin
}
