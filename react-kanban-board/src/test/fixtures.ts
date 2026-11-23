import { vi } from 'vitest'
import type { Character, PageInfo } from '../api/characters'
import type { BoardState, Item } from '../board/types'

export function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: '1',
    name: 'Rick Sanchez',
    image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
    species: 'Human',
    ...overrides,
  }
}

export const RICK = makeCharacter()
export const MORTY = makeCharacter({
  id: '2',
  name: 'Morty Smith',
  image: 'https://rickandmortyapi.com/api/character/avatar/2.jpeg',
  species: 'Human',
})

export function makeItem(id: string, overrides: Partial<Omit<Item, 'id'>> = {}): Item {
  return { id, title: `Task ${id}`, character: makeCharacter(), ...overrides }
}

export function makeBoard(overrides: Partial<BoardState> = {}): BoardState {
  return { todo: [], doing: [], done: [], ...overrides }
}

/** Body of a successful `characters` GraphQL response. */
export function graphqlPage(results: Character[], info: Partial<PageInfo> = {}) {
  return {
    data: {
      characters: {
        info: { count: results.length, pages: 1, next: null, prev: null, ...info },
        results,
      },
    },
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

export interface SentVariables {
  name: string | null
  page: number
}

/** Variables the app sent in the nth fetch call. */
export function variablesAt(fetchMock: { mock: { calls: unknown[][] } }, index: number): SentVariables {
  const [, init] = fetchMock.mock.calls[index] as [string, RequestInit]
  return JSON.parse(init.body as string).variables as SentVariables
}

/** Variables for every fetch call so far, in order. */
export function allVariables(fetchMock: { mock: { calls: unknown[][] } }): SentVariables[] {
  return fetchMock.mock.calls.map((_, i) => variablesAt(fetchMock, i))
}

/** Replaces global fetch with a mock that answers each call using `handler`. */
export function stubFetch(
  handler: (vars: SentVariables, init: RequestInit) => Response | Promise<Response>,
) {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const vars = (JSON.parse(init.body as string) as { variables: SentVariables }).variables
    return handler(vars, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Replaces window.matchMedia. Pass `matches` to control the reduced-motion query. */
export function stubMatchMedia(matches: boolean) {
  const matchMedia = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia })
  return matchMedia
}

export function removeMatchMedia() {
  Reflect.deleteProperty(window, 'matchMedia')
}
