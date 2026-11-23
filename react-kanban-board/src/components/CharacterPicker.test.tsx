import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPicker } from './CharacterPicker'
import {
  MORTY,
  RICK,
  allVariables,
  graphqlPage,
  jsonResponse,
  makeCharacter,
  stubFetch,
} from '../test/fixtures'

// Fake timers so the 300ms search debounce is advanced by hand instead of waited for.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setupUser() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
}

/** Types into the search box, then skips past the debounce. */
async function typeSearch(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(searchBox(), text)
  await act(() => vi.advanceTimersByTimeAsync(300))
}

/** Three pages of results, two characters each, so Prev/Next both have a role to play. */
function threePages(vars: { page: number }) {
  const info = {
    1: { count: 6, pages: 3, next: 2, prev: null },
    2: { count: 6, pages: 3, next: 3, prev: 1 },
    3: { count: 6, pages: 3, next: null, prev: 2 },
  }[vars.page] ?? { count: 6, pages: 3, next: null, prev: null }
  return jsonResponse(
    graphqlPage(
      [makeCharacter({ id: `p${vars.page}-a`, name: `Page ${vars.page} A` }), makeCharacter({ id: `p${vars.page}-b`, name: `Page ${vars.page} B` })],
      info,
    ),
  )
}

function searchBox() {
  return screen.getByRole('searchbox', { name: 'Search characters' })
}

describe('CharacterPicker: loading and results', () => {
  it('shows a loading message, then the results', async () => {
    stubFetch(() => jsonResponse(graphqlPage([RICK, MORTY])))

    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')

    expect(await screen.findByRole('button', { name: 'Rick Sanchez' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Morty Smith' })).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('loads the first page with no search on mount', async () => {
    const fetchMock = stubFetch(() => jsonResponse(graphqlPage([RICK])))

    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    await screen.findByRole('button', { name: 'Rick Sanchez' })
    expect(allVariables(fetchMock)).toEqual([{ name: null, page: 1 }])
  })

  it('marks the grid as busy while loading', async () => {
    stubFetch(() => new Promise(() => {}))

    const { container } = render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    expect(container.querySelector('.picker-results')).toHaveAttribute('aria-busy', 'true')
  })
})

describe('CharacterPicker: search', () => {
  it('sends a debounced request with the typed name, and only the final value', async () => {
    const fetchMock = stubFetch((vars) =>
      jsonResponse(graphqlPage([makeCharacter({ name: `Result for ${vars.name ?? 'all'}` })])),
    )
    const user = setupUser()
    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)
    await screen.findByText('Result for all')

    await typeSearch(user, 'morty')

    await waitFor(() => expect(allVariables(fetchMock).at(-1)).toEqual({ name: 'morty', page: 1 }))
    expect(allVariables(fetchMock).map((v) => v.name)).toEqual([null, 'morty'])
  })

  it('resets to page 1 when the search changes while on another page', async () => {
    const fetchMock = stubFetch(threePages)
    const user = setupUser()
    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)
    await screen.findByRole('button', { name: 'Page 1 A' })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('button', { name: 'Page 2 A' })

    await typeSearch(user, 'morty')

    await waitFor(() => expect(allVariables(fetchMock).at(-1)).toEqual({ name: 'morty', page: 1 }))
  })

  it('resets to page 1 when returning to an earlier search (not the page it was left on)', async () => {
    const fetchMock = stubFetch(threePages)
    const user = setupUser()
    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)
    await screen.findByRole('button', { name: 'Page 1 A' })

    await typeSearch(user, 'rick')
    await waitFor(() => expect(allVariables(fetchMock).at(-1)).toEqual({ name: 'rick', page: 1 }))
    await screen.findByRole('button', { name: 'Page 1 A' })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(allVariables(fetchMock).at(-1)).toEqual({ name: 'rick', page: 2 }))
    await screen.findByRole('button', { name: 'Page 2 A' })

    await user.clear(searchBox())
    await typeSearch(user, 'morty')
    await waitFor(() => expect(allVariables(fetchMock).at(-1)).toEqual({ name: 'morty', page: 1 }))
    await screen.findByRole('button', { name: 'Page 1 A' })

    await user.clear(searchBox())
    await typeSearch(user, 'rick')
    await waitFor(() => expect(allVariables(fetchMock).at(-1)).toEqual({ name: 'rick', page: 1 }))
  })

  it('shows no-match text when a search returns nothing', async () => {
    stubFetch(() => jsonResponse(graphqlPage([])))
    const user = setupUser()
    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)
    await screen.findByText('No characters found')

    await typeSearch(user, 'zzzz')

    await waitFor(() => expect(screen.getByText('No characters found')).toBeInTheDocument())
  })

  it('shows no-match text for the API "404" error', async () => {
    stubFetch(() => jsonResponse({ data: null, errors: [{ message: '404: Not Found' }] }))

    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    expect(await screen.findByText('No characters found')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('CharacterPicker: pagination', () => {
  it('shows Prev disabled and Next enabled on the first page', async () => {
    stubFetch(threePages)

    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    await screen.findByRole('button', { name: 'Page 1 A' })
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
  })

  it('moves forward and backward through pages', async () => {
    const fetchMock = stubFetch(threePages)
    const user = setupUser()
    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)
    await screen.findByRole('button', { name: 'Page 1 A' })

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('button', { name: 'Page 2 A' })
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    expect(allVariables(fetchMock).at(-1)).toEqual({ name: null, page: 2 })

    await user.click(screen.getByRole('button', { name: 'Prev' }))
    await screen.findByRole('button', { name: 'Page 1 A' })
    expect(allVariables(fetchMock).at(-1)).toEqual({ name: null, page: 1 })
  })

  it('disables Next on the last page', async () => {
    stubFetch(threePages)
    const user = setupUser()
    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)
    await screen.findByRole('button', { name: 'Page 1 A' })

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('button', { name: 'Page 2 A' })
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByRole('button', { name: 'Page 3 A' })

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Prev' })).toBeEnabled()
  })

  it('disables Prev and Next while a page is loading', async () => {
    const pending: Array<() => void> = []
    stubFetch(
      (vars) =>
        new Promise((resolve) => {
          pending.push(() => resolve(threePages(vars)))
        }),
    )
    const user = setupUser()
    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)
    await waitFor(() => expect(pending).toHaveLength(1))
    pending[0]()
    await screen.findByRole('button', { name: 'Page 1 A' })

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled()
  })

  it('hides the pager when there is only one page', async () => {
    stubFetch(() => jsonResponse(graphqlPage([RICK], { count: 1, pages: 1, next: null, prev: null })))

    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    await screen.findByRole('button', { name: 'Rick Sanchez' })
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Prev' })).not.toBeInTheDocument()
  })
})

describe('CharacterPicker: errors', () => {
  it('shows an alert with the HTTP error', async () => {
    stubFetch(() => jsonResponse({}, 500))

    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Couldn.t load characters: Request failed \(500\)/)
    expect(screen.queryByText('No characters found')).not.toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('retries the same request when "Try again" is clicked', async () => {
    let calls = 0
    const fetchMock = stubFetch(() =>
      ++calls === 1 ? jsonResponse({}, 500) : jsonResponse(graphqlPage([RICK])),
    )
    const user = setupUser()
    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('button', { name: 'Rick Sanchez' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(allVariables(fetchMock)).toEqual([{ name: null, page: 1 }, { name: null, page: 1 }])
  })

  it('shows an alert with a GraphQL error message', async () => {
    stubFetch(() => jsonResponse({ errors: [{ message: 'Service unavailable' }] }))

    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable')
  })

  it('shows an alert on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))

    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch')
  })
})

describe('CharacterPicker: selection', () => {
  it('calls onSelect with the character that was clicked', async () => {
    stubFetch(() => jsonResponse(graphqlPage([RICK, MORTY])))
    const onSelect = vi.fn()
    const user = setupUser()
    render(<CharacterPicker selected={null} onSelect={onSelect} />)

    await user.click(await screen.findByRole('button', { name: 'Morty Smith' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(MORTY)
  })

  it('shows the selected character and marks it as pressed', async () => {
    stubFetch(() => jsonResponse(graphqlPage([RICK, MORTY])))

    render(<CharacterPicker selected={MORTY} onSelect={vi.fn()} />)

    await screen.findByRole('button', { name: 'Morty Smith' })
    expect(screen.getByText(/Selected:/)).toHaveTextContent('Selected: Morty Smith')
    expect(screen.getByRole('button', { name: 'Morty Smith' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Rick Sanchez' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows no selection message when nothing is selected', async () => {
    stubFetch(() => jsonResponse(graphqlPage([RICK])))

    render(<CharacterPicker selected={null} onSelect={vi.fn()} />)

    await screen.findByRole('button', { name: 'Rick Sanchez' })
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()
  })
})
