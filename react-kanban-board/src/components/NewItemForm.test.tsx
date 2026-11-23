import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewItemForm } from './NewItemForm'
import { MORTY, RICK, graphqlPage, jsonResponse, stubFetch } from '../test/fixtures'

beforeEach(() => {
  stubFetch(() => jsonResponse(graphqlPage([RICK, MORTY])))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function titleInput() {
  return screen.getByRole('textbox', { name: 'Title' })
}

function submitButton() {
  return screen.getByRole('button', { name: 'Add to To Do' })
}

async function pickCharacter(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name }))
}

describe('NewItemForm: validation', () => {
  it('starts with the submit button disabled', () => {
    render(<NewItemForm onAdd={vi.fn()} />)

    expect(submitButton()).toBeDisabled()
  })

  it('keeps submit disabled when there is a title but no character', async () => {
    const user = userEvent.setup()
    render(<NewItemForm onAdd={vi.fn()} />)

    await user.type(titleInput(), 'Clean the garage')

    expect(submitButton()).toBeDisabled()
  })

  it('keeps submit disabled when there is a character but no title', async () => {
    const user = userEvent.setup()
    render(<NewItemForm onAdd={vi.fn()} />)

    await pickCharacter(user, 'Rick Sanchez')

    expect(screen.getByText(/Selected:/)).toBeInTheDocument()
    expect(submitButton()).toBeDisabled()
  })

  it('keeps submit disabled for a whitespace-only title, even with a character', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)

    await user.type(titleInput(), '     ')
    await pickCharacter(user, 'Rick Sanchez')

    expect(submitButton()).toBeDisabled()
  })

  it('does not call onAdd when the form is submitted directly with a whitespace-only title', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)
    await user.type(titleInput(), '   ')
    await pickCharacter(user, 'Rick Sanchez')

    fireEvent.submit(submitButton().closest('form')!)

    expect(onAdd).not.toHaveBeenCalled()
  })

  it('does not call onAdd when submitted with no title and no character', () => {
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)

    fireEvent.submit(submitButton().closest('form')!)

    expect(onAdd).not.toHaveBeenCalled()
  })

  it('does not call onAdd when Enter is pressed in the title without a character', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)

    await user.type(titleInput(), 'Lonely title{Enter}')

    expect(onAdd).not.toHaveBeenCalled()
  })
})

describe('NewItemForm: adding an item', () => {
  it('enables submit once both a title and a character are set', async () => {
    const user = userEvent.setup()
    render(<NewItemForm onAdd={vi.fn()} />)

    await user.type(titleInput(), 'Find the portal gun')
    await pickCharacter(user, 'Morty Smith')

    expect(submitButton()).toBeEnabled()
  })

  it('calls onAdd with the trimmed title and the selected character', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)

    await user.type(titleInput(), '  Get schwifty  ')
    await pickCharacter(user, 'Morty Smith')
    await user.click(submitButton())

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith({
      id: expect.any(String),
      title: 'Get schwifty',
      character: MORTY,
    })
  })

  it('gives each item a unique id', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)

    for (const title of ['First', 'Second']) {
      await user.type(titleInput(), title)
      await pickCharacter(user, 'Rick Sanchez')
      await user.click(submitButton())
    }

    const [first, second] = onAdd.mock.calls.map(([item]) => item.id as string)
    expect(first).toBeTruthy()
    expect(second).toBeTruthy()
    expect(first).not.toBe(second)
  })

  it('submits when Enter is pressed in the title', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)
    await pickCharacter(user, 'Rick Sanchez')

    await user.type(titleInput(), 'Wubba lubba dub dub{Enter}')

    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'Wubba lubba dub dub', character: RICK }))
  })

  it('clears the title and the selected character after adding', async () => {
    const user = userEvent.setup()
    render(<NewItemForm onAdd={vi.fn()} />)
    await user.type(titleInput(), 'Something')
    await pickCharacter(user, 'Rick Sanchez')

    await user.click(submitButton())

    expect(titleInput()).toHaveValue('')
    expect(submitButton()).toBeDisabled()
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument()
  })

  it('needs a fresh character choice for the next item', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)
    await user.type(titleInput(), 'One')
    await pickCharacter(user, 'Rick Sanchez')
    await user.click(submitButton())

    await user.type(titleInput(), 'Two')

    expect(submitButton()).toBeDisabled()
    await user.click(submitButton())
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('does not call onAdd twice on a single click', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)
    await user.type(titleInput(), 'Once')
    await pickCharacter(user, 'Rick Sanchez')

    await user.click(submitButton())
    await waitFor(() => expect(titleInput()).toHaveValue(''))

    expect(onAdd).toHaveBeenCalledTimes(1)
  })
})

describe('NewItemForm: search box', () => {
  it('does not submit the form when Enter is pressed in the character search', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<NewItemForm onAdd={onAdd} />)
    await user.type(titleInput(), 'Clean the garage')
    await pickCharacter(user, 'Rick Sanchez')
    expect(submitButton()).toBeEnabled()

    await user.type(screen.getByRole('searchbox', { name: 'Search characters' }), 'morty{Enter}')

    expect(onAdd).not.toHaveBeenCalled()
  })
})
