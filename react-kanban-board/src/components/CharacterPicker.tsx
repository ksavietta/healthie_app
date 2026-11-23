import { useState } from 'react'
import type { Character } from '../api/characters'
import { useCharacters } from '../hooks/useCharacters'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

interface Props {
  selected: Character | null
  onSelect: (character: Character) => void
}

export function CharacterPicker({ selected, onSelect }: Props) {
  const [search, setSearch] = useState('')
  // Trimmed first, so "rick" -> "rick " doesn't refetch or reset the page.
  const debouncedSearch = useDebouncedValue(search.trim(), 300)
  const [pageState, setPageState] = useState({ search: '', page: 1 })

  // A new search always starts at page 1. Adjusting state during render (instead of
  // an effect) means useCharacters is never called with a stale page, and returning
  // to an earlier search also starts at page 1.
  if (pageState.search !== debouncedSearch) {
    setPageState({ search: debouncedSearch, page: 1 })
  }
  const page = pageState.page
  const goToPage = (next: number) => setPageState({ search: debouncedSearch, page: next })

  const { characters, pageInfo, loading, error, retry } = useCharacters(debouncedSearch, page)

  return (
    <fieldset className="picker">
      <legend>Character</legend>

      {selected && (
        <div className="selected" aria-live="polite">
          <img className="avatar" src={selected.image} alt="" width={32} height={32} />
          <span>Selected: <strong>{selected.name}</strong></span>
        </div>
      )}

      <input
        type="search"
        placeholder="Search characters…"
        aria-label="Search characters"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        // Enter would otherwise submit the surrounding item form.
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault()
        }}
      />

      <div className="picker-results" aria-busy={loading}>
        {error && (
          <div role="alert" className="error">
            <p>Couldn’t load characters: {error}</p>
            <button type="button" onClick={retry}>Try again</button>
          </div>
        )}
        {!error && loading && characters.length === 0 && <p role="status" className="muted">Loading…</p>}
        {!error && !loading && characters.length === 0 && <p role="status" className="muted">No characters found</p>}

        <ul className={`character-grid${loading ? ' is-loading' : ''}`}>
          {characters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`character${selected?.id === c.id ? ' character-selected' : ''}`}
                aria-pressed={selected?.id === c.id}
                onClick={() => onSelect(c)}
              >
                <img src={c.image} alt="" width={48} height={48} loading="lazy" />
                <span>{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {pageInfo && pageInfo.pages > 1 && (
        <div className="pager">
          <button type="button" disabled={!pageInfo.prev || loading} onClick={() => pageInfo.prev && goToPage(pageInfo.prev)}>
            Prev
          </button>
          <span className="muted">Page {page} of {pageInfo.pages}</span>
          <button type="button" disabled={!pageInfo.next || loading} onClick={() => pageInfo.next && goToPage(pageInfo.next)}>
            Next
          </button>
        </div>
      )}
    </fieldset>
  )
}
