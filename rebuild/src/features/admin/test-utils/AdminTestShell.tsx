/**
 * Provider shell used by the admin test router (kept in its own module so the
 * router harness only exports non-component helpers).
 */
import { Outlet } from '@tanstack/react-router'
import { AccessibilityProvider } from '@/app/shell/AccessibilityProvider'
import { ThemeProvider } from '@/app/shell/ThemeProvider'

export function AdminTestShell() {
  return (
    <AccessibilityProvider>
      <ThemeProvider>
        <Outlet />
      </ThemeProvider>
    </AccessibilityProvider>
  )
}
