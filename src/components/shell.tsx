/**
 * The app shell: the company bar, this product's sub-navigation, and the page.
 *
 * The bar is `CloudsForgeBar` from @cloudsforge/ui and is never reimplemented — it is the thing
 * that makes moving between seven surfaces feel like one application. Everything this app adds
 * goes BELOW it.
 */
import { CloudsForgeBar, CloudsForgeFooter } from '@cloudsforge/ui'
import { NavLink, Outlet } from 'react-router-dom'
import { PRODUCT } from '../lib/hosts.ts'
import { useSession } from '../lib/auth.tsx'

/** The sub-navigation. One entry per top-level route; nginx.conf enumerates the same paths. */
const NAV: ReadonlyArray<{ to: string; label: string }> = [
  { to: '/', label: 'Overview' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell() {
  const { account, signIn, signOut } = useSession()

  return (
    <>
      {/*
        The skip link is the first focusable thing in the document, and it is visually hidden until
        it TAKES FOCUS, at which point it must become visible. A skip link that stays hidden when
        focused is worse than none: a keyboard reader activates it and cannot tell whether anything
        happened. `site` and `network-site` already ship one; this shell did not, so every keyboard
        user tabbed through the whole shared bar and the sub-navigation to reach the page, on every
        navigation.
      */}
      <a className="wt-skip" href="#main">
        Skip to the page
      </a>
      <CloudsForgeBar current={PRODUCT} account={account} onSignIn={() => signIn()} onSignOut={signOut} />
      {/*
        The sub-nav is sticky at exactly `var(--cf-bar-h)` — the bar's own height token, not a
        number copied out of it. When the bar's height changes, this moves with it; a hard-coded
        46px would leave a seam that only appears on the surfaces nobody rechecked.
      */}
      <nav className="wt-subnav" aria-label="Sections">
        <div className="wt-subnav__inner">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `wt-subnav__link${isActive ? ' is-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="wt-main" id="main">
        <Outlet />
      </main>

      {/*
        The company footer, from @cloudsforge/ui. Not written here, and deliberately not
        `<footer>` markup of this app's own: the estate had four hand-rolled footers and nine
        surfaces with none, and the registry's `developers` row has been claiming all along that
        the developer console is "reached from the footer" — a navigation path that existed
        nowhere. Every link in it is derived from SURFACES, so a new product appears here without
        this file changing.

        `account` is passed for one reason: it decides whether the operator surfaces are offered.
        Omitting it would hide them, which is safe, but this app already knows and a signed-in
        operator should be able to reach Admin from any page.
      */}
      <CloudsForgeFooter current={PRODUCT} account={account} />
    </>
  )
}
