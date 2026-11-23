import { describe, it, expect } from 'vitest'
import {
  boardReducer,
  enteredDone,
  findItem,
  initialBoard,
  isColumnId,
  resolveMove,
} from './boardReducer'
import { makeBoard, makeCharacter, makeItem } from '../test/fixtures'
import type { BoardState, Item } from './types'

/** Recursively freezes a value so any accidental mutation throws in strict mode. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

const a = makeItem('a')
const b = makeItem('b')
const c = makeItem('c')

describe('initialBoard', () => {
  it('starts with three empty columns', () => {
    expect(initialBoard).toEqual({ todo: [], doing: [], done: [] })
  })
})

describe('boardReducer: addItem', () => {
  it('appends the new item to the end of To Do', () => {
    const d = makeItem('d')
    const board = makeBoard({ todo: [a, b] })

    const next = boardReducer(board, { type: 'addItem', item: d })

    expect(next.todo).toEqual([a, b, d])
  })

  it('leaves Doing and Done untouched', () => {
    const board = makeBoard({ todo: [a], doing: [b], done: [c] })

    const next = boardReducer(board, { type: 'addItem', item: makeItem('d') })

    expect(next.doing).toEqual([b])
    expect(next.done).toEqual([c])
  })

  it('adds to an empty board', () => {
    const next = boardReducer(initialBoard, { type: 'addItem', item: a })

    expect(next.todo).toEqual([a])
    expect(next.doing).toEqual([])
    expect(next.done).toEqual([])
  })

  it('keeps the title and character it was given', () => {
    const character = makeCharacter({ id: '42', name: 'Mr. Meeseeks', species: 'Creature' })
    const item: Item = { id: 'x', title: 'Fix the garage', character }

    const next = boardReducer(initialBoard, { type: 'addItem', item })

    expect(next.todo[0]).toEqual({ id: 'x', title: 'Fix the garage', character })
  })

  it('does not mutate the previous board', () => {
    const board = makeBoard({ todo: [a] })
    const snapshot = structuredClone(board)

    boardReducer(board, { type: 'addItem', item: b })

    expect(board).toEqual(snapshot)
  })
})

describe('boardReducer: moveItem across columns', () => {
  it('moves the first item of To Do to the start of Doing', () => {
    const board = makeBoard({ todo: [a, b, c], doing: [] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'doing', toIndex: 0 })

    expect(next.todo).toEqual([b, c])
    expect(next.doing).toEqual([a])
  })

  it('moves an item into the middle of a non-empty column', () => {
    const x = makeItem('x')
    const y = makeItem('y')
    const board = makeBoard({ todo: [a], doing: [x, y] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'doing', toIndex: 1 })

    expect(next.todo).toEqual([])
    expect(next.doing.map((i) => i.id)).toEqual(['x', 'a', 'y'])
  })

  it('moves an item to the end of a column', () => {
    const x = makeItem('x')
    const y = makeItem('y')
    const board = makeBoard({ todo: [a], doing: [x, y] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'doing', toIndex: 2 })

    expect(next.doing.map((i) => i.id)).toEqual(['x', 'y', 'a'])
  })

  it('moves an item into an empty column', () => {
    const board = makeBoard({ todo: [a, b], doing: [], done: [] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'b', toColumn: 'done', toIndex: 0 })

    expect(next.todo).toEqual([a])
    expect(next.done).toEqual([b])
  })

  it('moves an item backwards from Done to To Do', () => {
    const board = makeBoard({ done: [a, b] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'b', toColumn: 'todo', toIndex: 0 })

    expect(next.todo).toEqual([b])
    expect(next.done).toEqual([a])
  })

  it('keeps the same item object when it moves', () => {
    const board = makeBoard({ todo: [a] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'done', toIndex: 0 })

    expect(next.done[0]).toBe(a)
  })

  it('does not touch the column the item did not come from or go to', () => {
    const x = makeItem('x')
    const board = makeBoard({ todo: [a], doing: [x], done: [b] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'done', toIndex: 1 })

    expect(next.doing).toEqual([x])
  })
})

describe('boardReducer: moveItem within a column', () => {
  it('moves an item down (first to last)', () => {
    const board = makeBoard({ todo: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'todo', toIndex: 2 })

    expect(next.todo.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('moves an item down by one', () => {
    const board = makeBoard({ todo: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'todo', toIndex: 1 })

    expect(next.todo.map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('moves an item up (last to first)', () => {
    const board = makeBoard({ todo: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'c', toColumn: 'todo', toIndex: 0 })

    expect(next.todo.map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })

  it('moves an item up by one', () => {
    const board = makeBoard({ todo: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'c', toColumn: 'todo', toIndex: 1 })

    expect(next.todo.map((i) => i.id)).toEqual(['a', 'c', 'b'])
  })

  it('reorders within Done the same way as any other column', () => {
    const board = makeBoard({ done: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'b', toColumn: 'done', toIndex: 0 })

    expect(next.done.map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('does not change the count of items in the column', () => {
    const board = makeBoard({ todo: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'todo', toIndex: 2 })

    expect(next.todo).toHaveLength(3)
  })

  it('clamps a toIndex past the end to the end', () => {
    const board = makeBoard({ todo: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'todo', toIndex: 99 })

    expect(next.todo.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('clamps a negative toIndex to the start', () => {
    const board = makeBoard({ todo: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'c', toColumn: 'todo', toIndex: -5 })

    expect(next.todo.map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('boardReducer: moveItem no-op cases', () => {
  it('returns the same board when an item is dropped where it already is', () => {
    const board = makeBoard({ todo: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'b', toColumn: 'todo', toIndex: 1 })

    expect(next).toBe(board)
  })

  it('returns the same board for the first item dropped at index 0', () => {
    const board = makeBoard({ todo: [a, b, c] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'todo', toIndex: 0 })

    expect(next).toBe(board)
  })

  it('returns the same board for the only item in a column dropped back into it', () => {
    const board = makeBoard({ doing: [a] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'doing', toIndex: 0 })

    expect(next).toBe(board)
  })

  it('returns the same board when the item id does not exist', () => {
    const board = makeBoard({ todo: [a], doing: [b] })

    const next = boardReducer(board, { type: 'moveItem', itemId: 'missing', toColumn: 'done', toIndex: 0 })

    expect(next).toBe(board)
  })

  it('does not throw for an unknown id on an empty board', () => {
    expect(() =>
      boardReducer(initialBoard, { type: 'moveItem', itemId: 'nope', toColumn: 'todo', toIndex: 0 }),
    ).not.toThrow()
    expect(boardReducer(initialBoard, { type: 'moveItem', itemId: 'nope', toColumn: 'todo', toIndex: 0 })).toBe(
      initialBoard,
    )
  })
})

describe('boardReducer: immutability', () => {
  it('does not mutate a frozen board when moving across columns', () => {
    const board = deepFreeze(makeBoard({ todo: [a, b], doing: [c] }))
    const snapshot = structuredClone(board)

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'doing', toIndex: 0 })

    expect(board).toEqual(snapshot)
    expect(next.doing.map((i) => i.id)).toEqual(['a', 'c'])
  })

  it('does not mutate a frozen board when reordering within a column', () => {
    const board = deepFreeze(makeBoard({ todo: [a, b, c] }))
    const snapshot = structuredClone(board)

    const next = boardReducer(board, { type: 'moveItem', itemId: 'a', toColumn: 'todo', toIndex: 2 })

    expect(board).toEqual(snapshot)
    expect(next.todo.map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate a frozen board when adding an item', () => {
    const board = deepFreeze(makeBoard({ todo: [a] }))
    const snapshot = structuredClone(board)

    const next = boardReducer(board, { type: 'addItem', item: b })

    expect(board).toEqual(snapshot)
    expect(next.todo.map((i) => i.id)).toEqual(['a', 'b'])
  })
})

describe('findItem', () => {
  const board: BoardState = makeBoard({ todo: [a], doing: [b, c] })

  it('returns the column and index of an item', () => {
    expect(findItem(board, 'a')).toEqual({ column: 'todo', index: 0 })
    expect(findItem(board, 'c')).toEqual({ column: 'doing', index: 1 })
  })

  it('returns null for an unknown id', () => {
    expect(findItem(board, 'zzz')).toBeNull()
  })

  it('returns null on an empty board', () => {
    expect(findItem(initialBoard, 'a')).toBeNull()
  })
})

describe('isColumnId', () => {
  it.each(['todo', 'doing', 'done'])('accepts %s', (id) => {
    expect(isColumnId(id)).toBe(true)
  })

  it.each(['', 'TODO', 'todo ', 'archive', 'a', undefined, null, 42])('rejects %s', (id) => {
    expect(isColumnId(id)).toBe(false)
  })

  it('rejects item ids', () => {
    expect(isColumnId(makeItem('item-1').id)).toBe(false)
  })
})

describe('resolveMove', () => {
  // todo: [a, b, c]   doing: [x, y]   done: []
  const x = makeItem('x')
  const y = makeItem('y')
  const board = makeBoard({ todo: [a, b, c], doing: [x, y] })

  describe('invalid drops', () => {
    it('returns null when the card is dropped on itself', () => {
      expect(resolveMove(board, 'a', 'a')).toBeNull()
    })

    it('returns null when the dragged id is unknown', () => {
      expect(resolveMove(board, 'missing', 'x')).toBeNull()
    })

    it('returns null when dropped over an unknown id', () => {
      expect(resolveMove(board, 'a', 'missing')).toBeNull()
    })
  })

  describe('dropping on a column', () => {
    it('sends a card to the end of another column', () => {
      expect(resolveMove(board, 'a', 'doing')).toEqual({ toColumn: 'doing', toIndex: 2 })
    })

    it('sends a card to index 0 of an empty column', () => {
      expect(resolveMove(board, 'a', 'done')).toEqual({ toColumn: 'done', toIndex: 0 })
    })

    it('sends a card to the end of its own column', () => {
      expect(resolveMove(board, 'a', 'todo')).toEqual({ toColumn: 'todo', toIndex: 2 })
    })

    it('puts a card dropped on its own column at the end when applied', () => {
      const move = resolveMove(board, 'a', 'todo')!
      const next = boardReducer(board, { type: 'moveItem', itemId: 'a', ...move })

      expect(next.todo.map((i) => i.id)).toEqual(['b', 'c', 'a'])
    })

    it('a card dropped on an empty column lands in it when applied', () => {
      const move = resolveMove(board, 'x', 'done')!
      const next = boardReducer(board, { type: 'moveItem', itemId: 'x', ...move })

      expect(next.done.map((i) => i.id)).toEqual(['x'])
      expect(next.doing.map((i) => i.id)).toEqual(['y'])
    })
  })

  describe('dropping on another card', () => {
    it('targets the column and index of a card in another column', () => {
      expect(resolveMove(board, 'a', 'y')).toEqual({ toColumn: 'doing', toIndex: 1 })
    })

    it('targets the index of a card in the same column', () => {
      expect(resolveMove(board, 'a', 'c')).toEqual({ toColumn: 'todo', toIndex: 2 })
    })

    it('inserts after a card in another column when dropped on its lower half', () => {
      expect(resolveMove(board, 'a', 'y', true)).toEqual({ toColumn: 'doing', toIndex: 2 })

      const move = resolveMove(board, 'a', 'y', true)!
      const next = boardReducer(board, { type: 'moveItem', itemId: 'a', ...move })
      expect(next.doing.map((i) => i.id)).toEqual(['x', 'y', 'a'])
    })

    it('ignores placeAfter for reordering inside one column', () => {
      expect(resolveMove(board, 'a', 'c', true)).toEqual({ toColumn: 'todo', toIndex: 2 })
    })

    it('inserting before the target card when applied', () => {
      const move = resolveMove(board, 'a', 'y')!
      const next = boardReducer(board, { type: 'moveItem', itemId: 'a', ...move })

      expect(next.doing.map((i) => i.id)).toEqual(['x', 'a', 'y'])
      expect(next.todo.map((i) => i.id)).toEqual(['b', 'c'])
    })

    it('reordering within a column when applied', () => {
      const move = resolveMove(board, 'c', 'a')!
      const next = boardReducer(board, { type: 'moveItem', itemId: 'c', ...move })

      expect(next.todo.map((i) => i.id)).toEqual(['c', 'a', 'b'])
    })
  })
})

describe('enteredDone', () => {
  it.each([
    ['todo', 'done'],
    ['doing', 'done'],
  ] as const)('is true when moving from %s to %s', (from, to) => {
    expect(enteredDone(from, to)).toBe(true)
  })

  it.each([
    ['done', 'done'],
    ['done', 'doing'],
    ['done', 'todo'],
    ['todo', 'doing'],
    ['doing', 'todo'],
    ['todo', 'todo'],
    ['doing', 'doing'],
  ] as const)('is false when moving from %s to %s', (from, to) => {
    expect(enteredDone(from, to)).toBe(false)
  })
})
