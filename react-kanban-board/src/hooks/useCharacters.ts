import { useEffect, useState } from 'react'
import { fetchCharacters, type Character, type PageInfo } from '../api/characters'

interface Result {
  characters: Character[]
  pageInfo: PageInfo | null
  loading: boolean
  error: string | null
  /** Re-runs the current (search, page) request, e.g. after an error. */
  retry: () => void
}

// What we last finished loading, tagged with the request it belongs to.
type Settled = Omit<Result, 'loading' | 'retry'> & { key: string }

const makeKey = (search: string, page: number, attempt: number) => `${page}:${search}:${attempt}`

export function useCharacters(search: string, page: number): Result {
  const [attempt, setAttempt] = useState(0)
  const requestKey = makeKey(search, page, attempt)
  const [settled, setSettled] = useState<Settled | null>(null)

  useEffect(() => {
    const requestKey = makeKey(search, page, attempt)
    // Aborting on cleanup means a slow response for an old search can never
    // overwrite the results of a newer one.
    const controller = new AbortController()

    fetchCharacters(search, page, controller.signal)
      .then(({ characters, pageInfo }) => {
        if (controller.signal.aborted) return
        setSettled({ key: requestKey, characters, pageInfo, error: null })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const error = err instanceof Error ? err.message : 'Something went wrong'
        setSettled({ key: requestKey, characters: [], pageInfo: null, error })
      })

    return () => controller.abort()
  }, [search, page, attempt])

  // Loading is derived: we're loading until the stored result matches the current request.
  const loading = settled?.key !== requestKey
  return {
    characters: settled?.characters ?? [],
    pageInfo: settled?.pageInfo ?? null,
    loading,
    error: loading ? null : (settled?.error ?? null),
    retry: () => setAttempt((n) => n + 1),
  }
}
