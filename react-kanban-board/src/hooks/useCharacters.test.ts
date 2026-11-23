import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useCharacters } from './useCharacters'
import {
  allVariables,
  graphqlPage,
  jsonResponse,
  makeCharacter,
  stubFetch,
} from '../test/fixtures'

afterEach(() => {
  vi.unstubAllGlobals()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('useCharacters: loading and results', () => {
  it('starts in the loading state with no characters', () => {
    stubFetch(() => new Promise(() => {})) // never settles

    const { result } = renderHook(() => useCharacters('', 1))

    expect(result.current.loading).toBe(true)
    expect(result.current.characters).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('resolves to characters and pageInfo', async () => {
    const rick = makeCharacter({ id: '1', name: 'Rick Sanchez' })
    stubFetch(() => jsonResponse(graphqlPage([rick], { count: 1, pages: 1, next: null, prev: null })))

    const { result } = renderHook(() => useCharacters('rick', 1))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.characters).toEqual([rick])
    expect(result.current.pageInfo).toEqual({ count: 1, pages: 1, next: null, prev: null })
    expect(result.current.error).toBeNull()
  })

  it('requests the given search and page', async () => {
    const fetchMock = stubFetch(() => jsonResponse(graphqlPage([])))

    const { result } = renderHook(() => useCharacters('morty', 3))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(allVariables(fetchMock)).toEqual([{ name: 'morty', page: 3 }])
  })

  it('sends name null for an empty search', async () => {
    const fetchMock = stubFetch(() => jsonResponse(graphqlPage([])))

    const { result } = renderHook(() => useCharacters('', 1))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(allVariables(fetchMock)).toEqual([{ name: null, page: 1 }])
  })

  it('makes a new request and goes back to loading when the page changes', async () => {
    const fetchMock = stubFetch((vars) =>
      jsonResponse(graphqlPage([makeCharacter({ id: String(vars.page), name: `Page ${vars.page}` })])),
    )

    const { result, rerender } = renderHook(({ page }) => useCharacters('', page), {
      initialProps: { page: 1 },
    })
    await waitFor(() => expect(result.current.characters[0]?.name).toBe('Page 1'))

    rerender({ page: 2 })

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.characters[0]?.name).toBe('Page 2'))
    expect(allVariables(fetchMock)).toEqual([
      { name: null, page: 1 },
      { name: null, page: 2 },
    ])
  })
})

describe('useCharacters: errors', () => {
  it('reports an HTTP failure as an error with no characters', async () => {
    stubFetch(() => jsonResponse({}, 500))

    const { result } = renderHook(() => useCharacters('rick', 1))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Request failed (500)')
    expect(result.current.characters).toEqual([])
    expect(result.current.pageInfo).toBeNull()
  })

  it('reports a network failure with its message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))

    const { result } = renderHook(() => useCharacters('rick', 1))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Failed to fetch')
  })

  it('falls back to a generic message for a non-Error rejection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject('boom')))

    const { result } = renderHook(() => useCharacters('rick', 1))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Something went wrong')
  })

  it('reports a GraphQL error message', async () => {
    stubFetch(() => jsonResponse({ errors: [{ message: 'Service unavailable' }] }))

    const { result } = renderHook(() => useCharacters('rick', 1))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Service unavailable')
  })

  it('treats a no-match 404 as an empty result, not an error', async () => {
    stubFetch(() => jsonResponse({ data: null, errors: [{ message: '404: Not Found' }] }))

    const { result } = renderHook(() => useCharacters('zzzz', 1))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.characters).toEqual([])
  })
})

describe('useCharacters: stale requests', () => {
  it('aborts the request for the old search when the search changes', async () => {
    const signals: AbortSignal[] = []
    stubFetch(
      (vars, init) =>
        new Promise((resolve, reject) => {
          signals.push(init.signal!)
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
          if (vars.name === 'ab') resolve(jsonResponse(graphqlPage([makeCharacter({ name: 'Abe' })])))
        }),
    )

    const { result, rerender } = renderHook(({ search }) => useCharacters(search, 1), {
      initialProps: { search: 'a' },
    })
    expect(signals[0].aborted).toBe(false)

    rerender({ search: 'ab' })

    expect(signals[0].aborted).toBe(true)
    await waitFor(() => expect(result.current.characters.map((c) => c.name)).toEqual(['Abe']))
    expect(result.current.error).toBeNull()
  })

  it('never shows an abort as an error', async () => {
    const fetchMock = stubFetch(
      (_vars, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )

    const { result, rerender } = renderHook(({ page }) => useCharacters('rick', page), {
      initialProps: { page: 1 },
    })
    rerender({ page: 2 })

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1))
    expect(result.current.error).toBeNull()
  })

  it('ignores a late response for an old search that arrives after the new one', async () => {
    const first = deferred<Response>()
    const second = deferred<Response>()
    const responses = [first, second]
    stubFetch(() => responses.shift()!.promise) // ignores the abort signal on purpose

    const { result, rerender } = renderHook(({ search }) => useCharacters(search, 1), {
      initialProps: { search: 'old' },
    })
    rerender({ search: 'new' })

    await act(async () => second.resolve(jsonResponse(graphqlPage([makeCharacter({ name: 'New result' })]))))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.characters.map((c) => c.name)).toEqual(['New result'])

    await act(async () => first.resolve(jsonResponse(graphqlPage([makeCharacter({ name: 'Old result' })]))))

    expect(result.current.characters.map((c) => c.name)).toEqual(['New result'])
    expect(result.current.loading).toBe(false)
  })
})
