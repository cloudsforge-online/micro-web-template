/**
 * Host resolution: the mechanism that lets ONE image serve every environment.
 *
 * If these assertions ever have to be relaxed, a build-time constant has crept back in.
 */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type { CloudsForgeHosts } from '@cloudsforge/ui'
import { hosts, resolveApiBase } from '../src/lib/hosts.ts'
import { installWindow, removeWindow } from './browser-stubs.ts'

afterEach(removeWindow)

describe('hosts()', () => {
  it('resolves to the local dev ports when served from localhost', () => {
    installWindow('http://localhost:5180/')
    const resolved = hosts()
    // `status`, not `trade`, for the bare-port assertion: it needs a surface that is still a
    // hostname of its own. `trade` gained a `basePath` in the apex consolidation, so its answer
    // is a port AND a mount — kept on the next line rather than dropped, because the mounted
    // spelling has to resolve correctly too and nothing here covered it.
    assert.equal(resolved.status, 'http://localhost:3013')
    assert.equal(resolved.trade, 'http://localhost:4006/trade')
    assert.equal(resolved.nimbus, 'http://localhost:4001')
    assert.equal(resolved.lantern, 'http://localhost:4010')
  })

  it('derives the apex from a product subdomain', () => {
    // `status.<apex>`, not `trade.<apex>`. The subdomain being STRIPPED has to be one the surface
    // registry still knows, and `trade` is not: the apex consolidation moved that surface to
    // `<apex>/trade` and nothing is served at the old hostname. Installed as the page's own
    // origin it falls to the "unrecognised prefix is its own apex" rule — which is correct, and
    // which made this case assert that a dead hostname still strips. True and worthless.
    installWindow('https://status.cloudsforge.online/settings')
    const resolved = hosts()
    assert.equal(resolved.status, 'https://status.cloudsforge.online')
    // And the consolidated surface resolves to the apex plus its mount, from the same page.
    assert.equal(resolved.trade, 'https://cloudsforge.online/trade')
    assert.equal(resolved.nimbus, 'https://nimbus.cloudsforge.online')
    assert.equal(resolved.account, 'https://account.cloudsforge.online')
    // The marketing site is the apex itself, with no subdomain.
    assert.equal(resolved.site, 'https://cloudsforge.online')
  })

  it('treats an unrecognised prefix as its own apex', () => {
    // A preview deployment is not a CloudsForge subdomain. Stripping `pr-42` would send the
    // sign-in redirect to a host that does not exist, and the user would never come back.
    installWindow('https://pr-42.example.dev/')
    assert.equal(hosts().nimbus, 'https://nimbus.pr-42.example.dev')
  })

  it('resolves a surface that is a path on another surface', () => {
    installWindow('https://hub.cloudsforge.online/')
    assert.equal(hosts().wallet, 'https://hub.cloudsforge.online/wallet')
  })
})

describe('resolveApiBase()', () => {
  // Only the two keys under test: the function reads one entry and never enumerates the record.
  const local = {
    trade: 'http://localhost:4006',
    hub: 'https://hub.x.dev/wallet',
  } as unknown as CloudsForgeHosts

  it('is relative when the page and the API share an origin', () => {
    assert.equal(resolveApiBase('http://localhost:4006', local, 'trade'), '')
  })

  it('is absolute when they do not — the dev server on another port', () => {
    assert.equal(resolveApiBase('http://localhost:5180', local, 'trade'), 'http://localhost:4006')
  })

  it('answers a path-mounted surface its OWN MOUNT, not the empty string', () => {
    // ── THE CASE THAT USED TO ASSERT THE DEFECT ─────────────────────────────────────────────
    //
    // This expected `''` — "a surface with a base path is still same-origin", which is true and
    // is not the question. Same-origin decides whether the base is RELATIVE; it does not decide
    // what it is relative TO. A relative `/v1/overview` from a page at `/wallet/anything`
    // resolves at the apex root, which belongs to micro-site — and micro-site answers its SPA
    // shell for an unknown path, so the call returns 200 with HTML where JSON was expected.
    //
    // The mount is the answer. For a root-mounted surface it is `''`, which is what the two
    // cases above still assert, so nothing changed for the surfaces that have not moved.
    assert.equal(resolveApiBase('https://hub.x.dev', local, 'hub'), '/wallet')
  })

  it('is absolute when there is no page origin to be relative to', () => {
    assert.equal(resolveApiBase('', local, 'trade'), 'http://localhost:4006')
  })
})
