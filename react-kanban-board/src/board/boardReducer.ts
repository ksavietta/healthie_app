import { COLUMN_IDS, type BoardState, type ColumnId, type Item } from './types'

export type BoardAction =
  | { type: 'addItem'; item: Item }
  // toIndex is the position in the destination column once the item has been removed from its source.
  | { type: 'moveItem'; itemId: string; toColumn: ColumnId; toIndex: number }

export const initialBoard: BoardState = { todo: [], doing: [], done: [] }

export function isColumnId(id: unknown): id is ColumnId {
  return COLUMN_IDS.includes(id as ColumnId)
}

export function findItem(board: BoardState, itemId: string) {
  for (const column of COLUMN_IDS) {
    const index = board[column].findIndex((item) => item.id === itemId)
    if (index !== -1) return { column, index }
  }
  return null
}

export function boardReducer(board: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'addItem':
      return { ...board, todo: [...board.todo, action.item] }

    case 'moveItem': {
      const from = findItem(board, action.itemId)
      if (!from) return board

      const item = board[from.column][from.index]
      const source = board[from.column].filter((i) => i.id !== action.itemId)
      const target = from.column === action.toColumn ? source : [...board[action.toColumn]]
      const toIndex = Math.max(0, Math.min(action.toIndex, target.length))
      const nextTarget = [...target.slice(0, toIndex), item, ...target.slice(toIndex)]

      if (from.column === action.toColumn && toIndex === from.index) return board

      return { ...board, [from.column]: source, [action.toColumn]: nextTarget }
    }
  }
}

/**
 * Turns a drag-end event (dragged item id + the id it was dropped on) into a move.
 * `overId` is either a column id (dropped on a column body) or another item's id.
 * `placeAfter` (only used when dropping on a card in a different column) inserts below
 * that card instead of above it, so the bottom half of a card means "after".
 */
export function resolveMove(
  board: BoardState,
  activeId: string,
  overId: string,
  placeAfter = false,
): { toColumn: ColumnId; toIndex: number } | null {
  if (activeId === overId) return null
  const from = findItem(board, activeId)
  if (!from) return null

  if (isColumnId(overId)) {
    const length = board[overId].length
    // Dropping on your own column's empty space sends the card to the end.
    return { toColumn: overId, toIndex: from.column === overId ? length - 1 : length }
  }

  const over = findItem(board, overId)
  if (!over) return null
  const after = placeAfter && over.column !== from.column
  return { toColumn: over.column, toIndex: over.index + (after ? 1 : 0) }
}

/** True only when an item crosses into Done from another column. */
export function enteredDone(from: ColumnId, to: ColumnId): boolean {
  return to === 'done' && from !== 'done'
}
