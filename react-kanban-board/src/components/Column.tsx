import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { COLUMN_LABELS, type ColumnId, type Item } from '../board/types'
import { Card } from './Card'

interface Props {
  id: ColumnId
  items: Item[]
  highlighted: boolean
}

export function Column({ id, items, highlighted }: Props) {
  // The whole column is the drop target (not just the list), so you can drop into
  // an empty column or in the free space below the last card to append.
  const { setNodeRef } = useDroppable({ id })

  return (
    <section ref={setNodeRef} className={`column${highlighted ? ' column-over' : ''}`} aria-label={COLUMN_LABELS[id]}>
      <h2>
        {COLUMN_LABELS[id]} <span className="count">{items.length}</span>
      </h2>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="card-list">
          {items.map((item) => (
            <Card key={item.id} item={item} />
          ))}
          {items.length === 0 && <li className="empty" aria-hidden="true">Drop items here</li>}
        </ul>
      </SortableContext>
    </section>
  )
}
