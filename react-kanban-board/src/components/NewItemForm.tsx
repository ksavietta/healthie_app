import { useState, type FormEvent } from 'react'
import type { Character } from '../api/characters'
import type { Item } from '../board/types'
import { CharacterPicker } from './CharacterPicker'

export function NewItemForm({ onAdd }: { onAdd: (item: Item) => void }) {
  const [title, setTitle] = useState('')
  const [character, setCharacter] = useState<Character | null>(null)

  const canSubmit = title.trim() !== '' && character !== null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onAdd({ id: crypto.randomUUID(), title: title.trim(), character })
    setTitle('')
    setCharacter(null)
  }

  return (
    <form className="new-item" onSubmit={handleSubmit}>
      <h2>New item</h2>
      <label>
        Title
        <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
      </label>
      <CharacterPicker selected={character} onSelect={setCharacter} />
      <button type="submit" className="primary" disabled={!canSubmit}>
        Add to To Do
      </button>
    </form>
  )
}
