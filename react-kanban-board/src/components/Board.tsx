import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { enteredDone, findItem, isColumnId, resolveMove, type BoardAction } from '../board/boardReducer'
import { celebrate } from '../board/celebrate'
import { COLUMN_IDS, COLUMN_LABELS, type BoardState, type ColumnId, type Item } from '../board/types'
import { CardContent } from './Card'
import { Column } from './Column'

// Pointer position decides the target when there is one (so the empty space under the
// last card counts as the column). Keyboard drags have no pointer, so they fall back
// to closestCorners.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length > 0 ? hits : closestCorners(args)
}

interface Props {
  board: BoardState
  dispatch: React.Dispatch<BoardAction>
}

export function Board({ board, dispatch }: Props) {
  const [activeItem, setActiveItem] = useState<Item | null>(null)
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null)

  const sensors = useSensors(
    // Small distance so clicks on a card aren't treated as drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function columnOf(id: string): ColumnId | null {
    return isColumnId(id) ? id : (findItem(board, id)?.column ?? null)
  }

  // Screen reader text uses item titles and column names instead of the raw ids.
  function describe(id: string): string {
    const found = findItem(board, id)
    return found ? board[found.column][found.index].title : id
  }

  function describeTarget(id: string): string {
    if (isColumnId(id)) return COLUMN_LABELS[id]
    const found = findItem(board, id)
    if (!found) return 'an unknown spot'
    return `${COLUMN_LABELS[found.column]}, position ${found.index + 1} of ${board[found.column].length}`
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${describe(String(active.id))} is over ${describeTarget(String(over.id))}.`
        : `${describe(String(active.id))} is not over a column.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${describe(String(active.id))} on ${describeTarget(String(over.id))}.`
        : `Dropped ${describe(String(active.id))}. It was not moved.`,
    onDragCancel: ({ active }) => `Cancelled. ${describe(String(active.id))} was not moved.`,
  }

  function handleDragStart(event: DragStartEvent) {
    const found = findItem(board, String(event.active.id))
    setActiveItem(found ? board[found.column][found.index] : null)
  }

  function handleDragOver(event: DragOverEvent) {
    setOverColumn(event.over ? columnOf(String(event.over.id)) : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null)
    setOverColumn(null)
    if (!event.over) return

    const activeId = String(event.active.id)
    const from = findItem(board, activeId)
    // Dropped on the lower half of a card: insert after it, not before.
    const translated = event.active.rect.current.translated
    const placeAfter =
      !!translated && translated.top + translated.height / 2 > event.over.rect.top + event.over.rect.height / 2
    const move = resolveMove(board, activeId, String(event.over.id), placeAfter)
    if (!from || !move) return

    dispatch({ type: 'moveItem', itemId: activeId, ...move })
    if (enteredDone(from.column, move.toColumn)) celebrate()
  }

  function handleDragCancel() {
    setActiveItem(null)
    setOverColumn(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="board">
        {COLUMN_IDS.map((id) => (
          <Column key={id} id={id} items={board[id]} highlighted={overColumn === id} />
        ))}
      </div>
      <DragOverlay>
        {activeItem ? (
          <div className="card card-overlay">
            <CardContent item={activeItem} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
