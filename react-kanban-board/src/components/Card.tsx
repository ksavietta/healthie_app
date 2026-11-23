import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Item } from '../board/types'

export function CardContent({ item }: { item: Item }) {
  return (
    <>
      <span className="card-grip" aria-hidden="true">⠿</span>
      <img className="avatar" src={item.character.image} alt="" width={40} height={40} />
      <div className="card-text">
        <div className="card-title">{item.title}</div>
        <div className="card-character">
          {item.character.name}
          <span className="card-species"> · {item.character.species}</span>
        </div>
      </div>
    </>
  )
}

export function Card({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  return (
    <li
      ref={setNodeRef}
      className={`card${isDragging ? ' card-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {/* The drag attributes (role="button", tabIndex) live on an inner element so the <li> keeps its list semantics. */}
      <div ref={setActivatorNodeRef} className="card-body" {...attributes} {...listeners}>
        <CardContent item={item} />
      </div>
    </li>
  )
}
