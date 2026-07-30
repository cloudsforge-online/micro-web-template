/**
 * The route table.
 *
 * Two facts about it are enforced elsewhere and must stay in agreement with it: `NAV` in
 * components/shell.tsx lists the same top-level paths, and nginx.conf enumerates them so that an
 * address which is NOT here answers 404 rather than 200.
 */
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/shell.tsx'
import { AuthProvider, ProtectedRoute } from './lib/auth.tsx'
import { NotFoundPage } from './pages/not-found.tsx'
import { OverviewPage } from './pages/overview.tsx'
import { SettingsPage } from './pages/settings.tsx'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            {/* Both pages are behind the gate. A route that is genuinely public is added here
                WITHOUT the wrapper — the wrapper is per route, not per app, because a marketing
                page inside a product app must not bounce a reader to sign in. */}
            <Route
              index
              element={
                <ProtectedRoute>
                  <OverviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            {/* Unknown paths render inside the shell, so the reader keeps the bar and the
                navigation they need to get back out. */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
