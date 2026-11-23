import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { MORTY, RICK, graphqlPage, jsonResponse, stubFetch, stubMatchMedia, removeMatchMedia } from './test/fixtures'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

beforeEach(() => {
  stubFetch(() => jsonResponse(graphqlPage([RICK, MORTY])))
  stubMatchMedia(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  removeMatchMedia()
})

function column(name: 'To Do' | 'Doing' | 'Done') {
  return screen.getByRole('region', { name })
}

async function addItem(user: ReturnType<typeof userEvent.setup>, title: string, character: string) {
  await user.type(screen.getByRole('textbox', { name: 'Title' }), title)
  await user.click(await screen.findByRole('button', { name: character }))
  await user.click(screen.getByRole('button', { name: 'Add to To Do' }))
}

describe('App: initial state', () => {
  it('shows the three columns, all empty', () => {
    render(<App />)

    for (const name of ['To Do', 'Doing', 'Done'] as const) {
      const region = column(name)
      expect(within(region).getByRole('heading')).toHaveTextContent(new RegExp(`^${name}\\s*0$`))
      expect(within(region).getByText('Drop items here')).toBeInTheDocument()
    }
  })

  it('starts with the submit button disabled', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: 'Add to To Do' })).toBeDisabled()
  })
})

describe('App: creating an item', () => {
  it('puts a new item in To Do with its title and character', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addItem(user, 'Build a rocket', 'Rick Sanchez')

    const todo = column('To Do')
    expect(within(todo).getByText('Build a rocket')).toBeInTheDocument()
    expect(within(todo).getByText('Rick Sanchez', { selector: '.card-character' })).toBeInTheDocument()
    expect(within(todo).getByRole('heading')).toHaveTextContent(/To Do\s*1/)
    expect(within(todo).queryByText('Drop items here')).not.toBeInTheDocument()
  })

  it('leaves Doing and Done empty after adding', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addItem(user, 'Build a rocket', 'Rick Sanchez')

    expect(within(column('Doing')).getByText('Drop items here')).toBeInTheDocument()
    expect(within(column('Done')).getByText('Drop items here')).toBeInTheDocument()
  })

  it('appends each new item to the bottom of To Do', async () => {
    const user = userEvent.setup()
    render(<App />)

    await addItem(user, 'First', 'Rick Sanchez')
    await addItem(user, 'Second', 'Morty Smith')
    await addItem(user, 'Third', 'Rick Sanchez')

    const titles = within(column('To Do'))
      .getAllByText(/^(First|Second|Third)$/)
      .map((el) => el.textContent)
    expect(titles).toEqual(['First', 'Second', 'Third'])
    expect(within(column('To Do')).getByRole('heading')).toHaveTextContent(/To Do\s*3/)
  })

  it('does not add anything when the title is only spaces', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox', { name: 'Title' }), '   ')
    await user.click(await screen.findByRole('button', { name: 'Rick Sanchez' }))

    expect(screen.getByRole('button', { name: 'Add to To Do' })).toBeDisabled()
    expect(within(column('To Do')).getByRole('heading')).toHaveTextContent(/To Do\s*0/)
  })

  it('resets the form after adding so the next item starts clean', async () => {
    const user = userEvent.setup()
    render(<App />)
    await addItem(user, 'First', 'Rick Sanchez')

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add to To Do' })).toBeDisabled()
  })
})
