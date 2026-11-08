/**
 * Router binding for the film deep links (`?moment=`, `?clip=`, `?resume=`).
 *
 * Reads the current search string from TanStack Router state and cleans a param
 * with a `replace` navigation, mirroring the frozen page's
 * `setSearchParams(prev => delete param, { replace: true })` behaviour.
 */
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import {
  parseFilmSearch,
  removeSearchParam,
  toSearchObject,
  type FilmSearch,
  type FilmSearchParam,
} from './filmDeepLinks'

export interface FilmDeepLinks extends FilmSearch {
  /** removeParam('clip') rewrites `/film?clip=mom` to `/film` without a history entry. */
  removeParam: (name: FilmSearchParam) => void
}

export function useFilmDeepLinks(): FilmDeepLinks {
  const searchStr = useRouterState({ select: state => state.location.searchStr })
  const navigate = useNavigate()

  const removeParam = useCallback(
    (name: FilmSearchParam) => {
      void navigate({
        to: '/film',
        search: toSearchObject(removeSearchParam(searchStr, name)),
        replace: true,
      })
    },
    [navigate, searchStr]
  )

  return useMemo(() => ({ ...parseFilmSearch(searchStr), removeParam }), [removeParam, searchStr])
}
