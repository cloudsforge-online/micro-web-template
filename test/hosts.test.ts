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
    assert.equal(resolved.trade, 'http://localhost:4006')
    assert.equal(resolved.nimbus, 'http://localhost:4001')
    assert.equal(resolved.lantern, 'http://localhost:4010')
  })

  it('derives the apex from a product subdomain', () => {
    installWindow('https://trade.cloudsforge.online/settings')
    const resolved = hosts()
    assert.equal(resolved.trade, 'https://trade.cloudsforge.online')
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

  it('compares origins, not whole URLs, so a surface with a base path is still same-origin', () => {
    assert.equal(resolveApiBase('https://hub.x.dev', local, 'hub'), '')
  })

  it('is absolute when there is no page origin to be relative to', () => {
    assert.equal(resolveApiBase('', local, 'trade'), 'http://localhost:4006')
  })
})
