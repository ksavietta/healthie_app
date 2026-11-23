import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchCharacters } from './characters'
import { graphqlPage, jsonResponse, makeCharacter, stubFetch, variablesAt } from '../test/fixtures'

const ENDPOINT = 'https://rickandmortyapi.com/graphql'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchCharacters: request', () => {
  it('POSTs JSON to the Rick and Morty GraphQL endpoint', async () => {
    const fetchMock = stubFetch(() => jsonResponse(graphqlPage([])))

    await fetchCharacters('rick', 2)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(ENDPOINT)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('sends a query with the characters field and the page and name variables', async () => {
    const fetchMock = stubFetch(() => jsonResponse(graphqlPage([])))

    await fetchCharacters('rick', 2)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { query: string; variables: unknown }
    expect(body.query).toContain('characters(page: $page, filter: { name: $name })')
    expect(body.query).toContain('info')
    expect(body.query).toContain('results')
    expect(body.variables).toEqual({ page: 2, name: 'rick' })
  })

  it('trims the search before sending it', async () => {
    const fetchMock = stubFetch(() => jsonResponse(graphqlPage([])))

    await fetchCharacters('  morty smith  ', 1)

    expect(variablesAt(fetchMock, 0)).toEqual({ page: 1, name: 'morty smith' })
  })

  it.each(['', '   ', '\t'])('sends name null for a blank search (%j)', async (search) => {
    const fetchMock = stubFetch(() => jsonResponse(graphqlPage([])))

    await fetchCharacters(search, 1)

    expect(variablesAt(fetchMock, 0)).toEqual({ page: 1, name: null })
  })

  it('passes the abort signal through to fetch', async () => {
    const fetchMock = stubFetch(() => jsonResponse(graphqlPage([])))
    const controller = new AbortController()

    await fetchCharacters('rick', 1, controller.signal)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.signal).toBe(controller.signal)
  })
})

describe('fetchCharacters: success', () => {
  it('returns the characters from results', async () => {
    const rick = makeCharacter({ id: '1', name: 'Rick Sanchez' })
    const morty = makeCharacter({ id: '2', name: 'Morty Smith' })
    stubFetch(() => jsonResponse(graphqlPage([rick, morty])))

    const page = await fetchCharacters('', 1)

    expect(page.characters).toEqual([rick, morty])
  })

  it('maps info into pageInfo', async () => {
    stubFetch(() =>
      jsonResponse(graphqlPage([makeCharacter()], { count: 41, pages: 3, next: 2, prev: null })),
    )

    const page = await fetchCharacters('', 1)

    expect(page.pageInfo).toEqual({ count: 41, pages: 3, next: 2, prev: null })
  })

  it('keeps prev when there is a previous page', async () => {
    stubFetch(() => jsonResponse(graphqlPage([makeCharacter()], { count: 41, pages: 3, next: 3, prev: 1 })))

    const page = await fetchCharacters('', 2)

    expect(page.pageInfo.prev).toBe(1)
    expect(page.pageInfo.next).toBe(3)
  })

  it('defaults count and pages to 0 when the API sends null', async () => {
    stubFetch(() =>
      jsonResponse({
        data: { characters: { info: { count: null, pages: null, next: null, prev: null }, results: [] } },
      }),
    )

    const page = await fetchCharacters('', 1)

    expect(page.pageInfo).toEqual({ count: 0, pages: 0, next: null, prev: null })
  })
})

describe('fetchCharacters: no matches', () => {
  it('returns an empty list when results is an empty array', async () => {
    stubFetch(() => jsonResponse(graphqlPage([], { count: 0, pages: 0, next: null, prev: null })))

    const page = await fetchCharacters('zzzz', 1)

    expect(page.characters).toEqual([])
    expect(page.pageInfo).toEqual({ count: 0, pages: 0, next: null, prev: null })
  })

  it('returns an empty list when the API says 404 in a GraphQL error', async () => {
    stubFetch(() => jsonResponse({ data: null, errors: [{ message: '404: Not Found' }] }))

    const page = await fetchCharacters('zzzz', 1)

    expect(page.characters).toEqual([])
    expect(page.pageInfo.pages).toBe(0)
  })

  it('returns an empty list when characters is null', async () => {
    stubFetch(() => jsonResponse({ data: { characters: null } }))

    const page = await fetchCharacters('zzzz', 1)

    expect(page.characters).toEqual([])
  })

  it('returns an empty list when results is null', async () => {
    stubFetch(() =>
      jsonResponse({ data: { characters: { info: { count: 0, pages: 0, next: null, prev: null }, results: null } } }),
    )

    const page = await fetchCharacters('zzzz', 1)

    expect(page.characters).toEqual([])
  })

  it('returns an empty list when data is missing entirely', async () => {
    stubFetch(() => jsonResponse({}))

    const page = await fetchCharacters('zzzz', 1)

    expect(page.characters).toEqual([])
  })
})

describe('fetchCharacters: errors', () => {
  it('throws with the status code on an HTTP error', async () => {
    stubFetch(() => jsonResponse({}, 500))

    await expect(fetchCharacters('rick', 1)).rejects.toThrow('Request failed (500)')
  })

  it('throws on a 429 rate limit response', async () => {
    stubFetch(() => jsonResponse({}, 429))

    await expect(fetchCharacters('rick', 1)).rejects.toThrow('Request failed (429)')
  })

  it('throws the first GraphQL error message for a non-404 error', async () => {
    stubFetch(() => jsonResponse({ errors: [{ message: 'Cannot query field "foo"' }] }))

    await expect(fetchCharacters('rick', 1)).rejects.toThrow('Cannot query field "foo"')
  })

  it('throws when a real error comes back alongside a 404 (only an all-404 list is "no matches")', async () => {
    stubFetch(() =>
      jsonResponse({ errors: [{ message: 'Internal failure' }, { message: '404: Not Found' }] }),
    )

    await expect(fetchCharacters('rick', 1)).rejects.toThrow('Internal failure')
  })

  it('rejects when the network request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))

    await expect(fetchCharacters('rick', 1)).rejects.toThrow('Failed to fetch')
  })

  it('rejects when the response body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON')
        },
      })),
    )

    await expect(fetchCharacters('rick', 1)).rejects.toThrow(SyntaxError)
  })
})

describe('fetchCharacters: abort', () => {
  it('rejects with AbortError when the signal aborts while the request is in flight', async () => {
    stubFetch(
      (_vars, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          )
        }),
    )
    const controller = new AbortController()

    const pending = fetchCharacters('rick', 1, controller.signal)
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('does not swallow the abort; the caller decides what to do with it', async () => {
    stubFetch(() => Promise.reject(new DOMException('aborted', 'AbortError')))

    await expect(fetchCharacters('rick', 1)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
