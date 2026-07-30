/**
 * The second route, which exists so the sub-nav has something to navigate BETWEEN and so the
 * protected-route path is exercised by the template rather than only by its first instantiation.
 */
import { useSession } from '../lib/auth.tsx'
import { hosts, APP_NAME, PRODUCT } from '../lib/hosts.ts'

export function SettingsPage() {
  const { account } = useSession()
  const resolved = hosts()

  return (
    <>
      <header className="wt-page__head">
        <h1 className="wt-page__title">Settings</h1>
      </header>

      <section className="wt-panel">
        <h2 className="wt-panel__title">Account</h2>
        <dl className="wt-facts">
          <dt>Signed in as</dt>
          <dd>{account.handle ?? 'nobody'}</dd>
          <dt>Roles</dt>
          <dd>{account.roles?.length ? account.roles.join(', ') : 'none'}</dd>
          <dt>Application</dt>
          <dd>{APP_NAME}</dd>
        </dl>
        <p className="wt-note">
          Your profile, password and sessions are held once, at the CloudsForge Account portal —
          this app has no copy of them to edit.{' '}
          <a className="wt-link" href={resolved.account}>
            Open account settings
          </a>
        </p>
      </section>

      {/*
        Resolved hosts, on screen. It is the fastest way to answer "which environment am I talking
        to" without a console, and it is only ever a list of public base URLs.
      */}
      <section className="wt-panel">
        <h2 className="wt-panel__title">Resolved hosts</h2>
        <p className="wt-note">
          Derived from <code>{window.location.hostname}</code> at runtime. This build contains no
          environment of its own.
        </p>
        <dl className="wt-facts wt-facts--mono">
          <dt>This surface ({PRODUCT})</dt>
          <dd>{resolved[PRODUCT]}</dd>
          <dt>Nimbus</dt>
          <dd>{resolved.nimbus}</dd>
          <dt>Account</dt>
          <dd>{resolved.account}</dd>
          <dt>Lantern</dt>
          <dd>{resolved.lantern}</dd>
        </dl>
      </section>
    </>
  )
}
