import type { Character } from '../api/characters'

export const COLUMN_IDS = ['todo', 'doing', 'done'] as const
export type ColumnId = (typeof COLUMN_IDS)[number]

export const COLUMN_LABELS: Record<ColumnId, string> = {
  todo: 'To Do',
  doing: 'Doing',
  done: 'Done',
}

export interface Item {
  id: string
  title: string
  character: Character
}

export type BoardState = Record<ColumnId, Item[]>
