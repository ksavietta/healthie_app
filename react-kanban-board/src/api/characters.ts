const ENDPOINT = 'https://rickandmortyapi.com/graphql'

export interface Character {
  id: string
  name: string
  image: string
  species: string
}

export interface PageInfo {
  count: number
  pages: number
  next: number | null
  prev: number | null
}

export interface CharactersPage {
  characters: Character[]
  pageInfo: PageInfo
}

const CHARACTERS_QUERY = /* GraphQL */ `
  query Characters($page: Int, $name: String) {
    characters(page: $page, filter: { name: $name }) {
      info {
        count
        pages
        next
        prev
      }
      results {
        id
        name
        image
        species
      }
    }
  }
`

interface GraphQLResponse {
  data?: {
    characters: {
      info: { count: number | null; pages: number | null; next: number | null; prev: number | null }
      results: Character[] | null
    } | null
  } | null
  errors?: { message: string }[]
}

const EMPTY_PAGE: CharactersPage = {
  characters: [],
  pageInfo: { count: 0, pages: 0, next: null, prev: null },
}

export async function fetchCharacters(
  search: string,
  page: number,
  signal?: AbortSignal,
): Promise<CharactersPage> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: CHARACTERS_QUERY,
      variables: { page, name: search.trim() || null },
    }),
    signal,
  })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)

  const json = (await res.json()) as GraphQLResponse

  // The API reports "no matches" as a "404: Not Found" error in some cases.
  // Treat that as an empty list, not a failure.
  if (json.errors?.length) {
    // Only when every error is a 404; a real error alongside one must still surface.
    if (json.errors.every((e) => e.message.startsWith('404'))) return EMPTY_PAGE
    throw new Error(json.errors[0].message)
  }

  const result = json.data?.characters
  if (!result?.results) return EMPTY_PAGE

  return {
    characters: result.results,
    pageInfo: {
      count: result.info.count ?? 0,
      pages: result.info.pages ?? 0,
      next: result.info.next,
      prev: result.info.prev,
    },
  }
}
