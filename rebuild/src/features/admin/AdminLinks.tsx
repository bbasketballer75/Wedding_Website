/**
 * Router link components for the admin shell.
 *
 * Split from `routing.ts` so the pure path helpers stay importable without JSX
 * and react-refresh sees one export kind per module.
 */
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { AdminSection } from './data'
import { adminSectionFromPathname } from './routing'

export interface AdminSectionLinkProps {
  section: AdminSection
  className?: string
  children: ReactNode
  ariaCurrent?: 'page' | undefined
  dataTestId?: string
}

/** Router link to an admin section (dashboard route vs splat route). */
export function AdminSectionLink({
  section,
  className,
  children,
  ariaCurrent,
  dataTestId,
}: AdminSectionLinkProps) {
  if (section === 'dashboard') {
    return (
      <Link to='/admin' className={className} aria-current={ariaCurrent} data-testid={dataTestId}>
        {children}
      </Link>
    )
  }
  return (
    <Link
      to='/admin/$'
      params={{ _splat: section }}
      className={className}
      aria-current={ariaCurrent}
      data-testid={dataTestId}
    >
      {children}
    </Link>
  )
}

export interface AdminDestinationLinkProps {
  destination: string
  className?: string
  children: ReactNode
}

/** Router link to a validated admin destination path (`/admin*` only). */
export function AdminDestinationLink({
  destination,
  className,
  children,
}: AdminDestinationLinkProps) {
  return (
    <AdminSectionLink section={adminSectionFromPathname(destination)} className={className}>
      {children}
    </AdminSectionLink>
  )
}
