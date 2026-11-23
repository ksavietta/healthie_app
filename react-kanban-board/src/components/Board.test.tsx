import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useReducer } from 'react'
import { Board } from './Board'
import { boardReducer } from '../board/boardReducer'
import { celebrate } from '../board/celebrate'
import { makeBoard, makeItem } from '../test/fixtures'
import type { BoardState } from '../board/types'

vi.mock('../board/celebrate', () => ({ celebrate: vi.fn() }))

const celebrateMock = vi.mocked(celebrate)

/** Renders Board with real reducer state seeded from `seed`. */
function Harness({ seed }: { seed: BoardState }) {
  const [board, dispatch] = useReducer(boardReducer, seed)
  return <Board board={board} dispatch={dispatch} />
}

/**
 * jsdom has no layout, so every rect is 0x0 and dnd-kit cannot tell which
 * direction a keyboard move should go. This gives the columns and cards a
 * simple fake layout: columns side by side, cards stacked inside each column.
 * The keyboard tests below depend on this layout, so keep them in step with it.
 */
function fakeLayout() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON() {} }) as DOMRect

    const columns = Array.from(document.querySelectorAll('section.column'))
    const column = this.closest('section.column')
    const colIndex = column ? columns.indexOf(column) : -1
    if (colIndex === -1) return rect(0, 0, 0, 0)

    const left = colIndex * 300
    if (this.matches('section.column')) return rect(left, 0, 280, 600)
    if (this.matches('li.card')) {
      const cards = Array.from(this.parentElement!.children).filter((el) => el.matches('li.card'))
      const index = cards.indexOf(this as HTMLElement)
      return rect(left, 50 + index * 80, 280, 70)
    }
    return rect(0, 0, 0, 0)
  })
}

let layoutSpy: ReturnType<typeof fakeLayout> | undefined

beforeEach(() => {
  celebrateMock.mockClear()
  layoutSpy = fakeLayout()
})

afterEach(() => {
  layoutSpy?.mockRestore()
})

function column(name: 'To Do' | 'Doing' | 'Done') {
  return screen.getByRole('region', { name })
}

function cardTitles(name: 'To Do' | 'Doing' | 'Done'): string[] {
  return within(column(name))
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('.card-title')?.textContent ?? '')
}

/** Focuses a card by its title and starts a keyboard drag on it. */
async function pickUpCard(user: ReturnType<typeof userEvent.setup>, title: string) {
  const card = within(document.body).getByText(title).closest('[role="button"]') as HTMLElement
  act(() => card.focus())
  await user.keyboard(' ')
}

describe('Board: rendering', () => {
  it('renders the three columns with their items in order', () => {
    render(
      <Harness
        seed={makeBoard({
          todo: [makeItem('a', { title: 'Alpha' }), makeItem('b', { title: 'Beta' })],
          done: [makeItem('c', { title: 'Gamma' })],
        })}
      />,
    )

    expect(cardTitles('To Do')).toEqual(['Alpha', 'Beta'])
    expect(cardTitles('Done')).toEqual(['Gamma'])
    expect(within(column('Doing')).getByText('Drop items here')).toBeInTheDocument()
  })
})

describe('Board: keyboard drag', () => {
  it('moves a card into Done and celebrates', async () => {
    const user = userEvent.setup()
    render(<Harness seed={makeBoard({ todo: [makeItem('a', { title: 'Alpha' })] })} />)

    await pickUpCard(user, 'Alpha')
    await user.keyboard('{ArrowRight}{ArrowRight}')
    await user.keyboard(' ')

    expect(cardTitles('Done')).toEqual(['Alpha'])
    expect(cardTitles('To Do')).toEqual([])
    expect(celebrateMock).toHaveBeenCalledTimes(1)
  })

  it('reorders a card within To Do and does not celebrate', async () => {
    const user = userEvent.setup()
    render(
      <Harness
        seed={makeBoard({
          todo: [makeItem('a', { title: 'Alpha' }), makeItem('b', { title: 'Beta' })],
        })}
      />,
    )

    await pickUpCard(user, 'Alpha')
    await user.keyboard('{ArrowDown}')
    await user.keyboard(' ')

    expect(cardTitles('To Do')).toEqual(['Beta', 'Alpha'])
    expect(celebrateMock).not.toHaveBeenCalled()
  })

  it('leaves the card where it was when the drag is cancelled with Escape', async () => {
    const user = userEvent.setup()
    render(<Harness seed={makeBoard({ todo: [makeItem('a', { title: 'Alpha' })] })} />)

    await pickUpCard(user, 'Alpha')
    await user.keyboard('{ArrowRight}{ArrowRight}')
    await user.keyboard('{Escape}')

    expect(cardTitles('To Do')).toEqual(['Alpha'])
    expect(cardTitles('Done')).toEqual([])
    expect(celebrateMock).not.toHaveBeenCalled()
  })
})
