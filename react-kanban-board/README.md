# React Kanban Board

A frontend-only Kanban board (To Do / Doing / Done). Every item has a title and a Rick and Morty character, picked from the [Rick and Morty GraphQL API](https://rickandmortyapi.com/graphql). Drag cards between columns or reorder them within a column. Moving a card into Done fires confetti.

Stack: Vite, React 19, TypeScript (strict), @dnd-kit, canvas-confetti, Vitest + React Testing Library.

## Prerequisites

- Node.js 22.12+ (22, 24 or 26+). Vite 8 needs 20.19+/22.12+ and Vitest 5 needs 22.12+/24+/26+, so the intersection is set in `package.json` `engines`. Developed on Node 26 / npm 11.
- npm

No backend is needed. The only network call is to the public Rick and Morty API.

## Running locally

```bash
cd react-kanban-board
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest in watch mode
npm run test:run   # single test run
npm run build      # type check (tsc) + production build
npm run lint       # oxlint
```

## How it works

- Add an item with the form: a non-blank title and a selected character are both required.
- The character picker searches the API (debounced 300ms) and has Prev/Next pagination.
- New items land at the bottom of To Do.
- Drag with the mouse, or with the keyboard: focus a card, press Space, use the arrow keys, press Space to drop (Esc cancels). Screen readers hear the card title and column name ("Picked up Build a rocket. ... is over Doing, position 2 of 3."), not internal ids.
- Pressing Enter in the character search does not submit the form. If the character list fails to load there is a "Try again" button.
- Moving a card from another column into Done fires confetti. Reordering inside Done does not. Confetti is skipped when the OS has `prefers-reduced-motion` on.

## Structure

```
src/
  api/characters.ts          GraphQL query, response types, fetchCharacters()
  hooks/useCharacters.ts     (search, page) -> { characters, pageInfo, loading, error }; aborts stale requests
  hooks/useDebouncedValue.ts generic debounce hook
  board/types.ts             ColumnId, Item, BoardState, column labels
  board/boardReducer.ts      pure reducer (addItem, moveItem) + resolveMove() + enteredDone()
  board/celebrate.ts         confetti, respects reduced motion
  components/
    NewItemForm.tsx          title + character, validation
    CharacterPicker.tsx      search, results grid, pagination
    Board.tsx                DndContext, sensors, drag handlers, drag overlay
    Column.tsx               droppable column + SortableContext
    Card.tsx                 sortable card
  App.tsx                    useReducer, layout
```

The logic worth testing lives in plain functions: `boardReducer`, `resolveMove` (drop target -> column + index) and `enteredDone` (should we celebrate?).

## Design choices and tradeoffs

**@dnd-kit vs alternatives.** `react-beautiful-dnd` is deprecated; its fork `@hello-pangea/dnd` is simpler for list-to-list boards but less flexible. HTML5 drag and drop needs no dependency but has poor touch and keyboard support. dnd-kit is more wiring (sensors, droppable columns, overlay) but is maintained, supports keyboard out of the box, and is easy to customise.

**useReducer vs a state library.** The state is one object with two operations, so `useReducer` is enough, and a pure reducer is trivial to unit test. Redux/Zustand would only pay off once state is shared across many distant components or needs middleware (persistence, undo).

**Plain fetch vs a GraphQL client.** One query, no caching needs. `fetch` plus typed response is about 60 lines and zero dependencies. Apollo/urql would add caching, retries and devtools, which this app doesn't need. The tradeoff is that error handling (HTTP, GraphQL `errors`, network, abort) is hand-written. The API's "no match" case is treated as an empty list.

**Debounced search + pagination.** Debouncing avoids a request per keystroke; `AbortController` ensures a slow old response can't overwrite a newer one. Pagination keeps payloads small (20 per page) at the cost of an extra control. Changing the search resets to page 1.

**Drop handling.** Moves are committed on drag end (a `DragOverlay` shows the card while dragging, and the target column is highlighted). The whole column is the drop target, so dropping in the empty space under the last card appends. Collision detection uses the pointer position (`pointerWithin`), falling back to `closestCorners` for keyboard drags. Dropping on the lower half of a card in another column inserts after it, otherwise before it (`resolveMove(..., placeAfter)`). Live cross-column preview during drag would need handling in `onDragOver` and is a possible refinement.

## Known gaps and next steps

- Board filtering (by character, title text, or column). Intentionally not built.
- Persistence (localStorage, or a backend). Intentionally not built; the reducer is the natural place to hook in.
- Edit and delete items.
- Live cross-column reordering preview while dragging.
- Cache character search results; remember the last search in the picker.
- Touch: dragging and scrolling on cards isn't tuned. Cards set `touch-action: none`, so a touch on a card can't scroll the page. A `TouchSensor` with a press delay (or a drag handle) would fix it.
