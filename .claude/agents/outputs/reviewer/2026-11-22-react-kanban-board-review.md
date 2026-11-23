# Review: react-kanban-board

Path: /Users/kallensavietta/wa/coding_exercises/healthie_interview/health_journal_app/react-kanban-board
Date: 2026-11-22
Method: read every listed file plus node_modules/@dnd-kit/core defaults. I had no shell, so I did not run the tests, build or lint. The "159 tests, 3 fail" status is taken from the brief. I traced all three failures by hand and each is a real bug.

## Verdict: NEEDS CHANGES

The structure is good. The reducer is pure, the pure logic is split out and tested, confetti fires from the event handler and not the reducer, and there are no real network calls in tests. The three reported bugs are real and each is a few lines to fix. Fix those, then the a11y and drop-target warnings below, before the pairing session.

---

## Critical issues (must fix)

### 1. Page not reset when returning to an earlier search (confirmed, severity Medium)
File: src/components/CharacterPicker.tsx:14-18

`pageState` holds `{search, page}` and is never cleared. Trace:
1. Search "a" and go to page 3. State is `{a, 3}`.
2. Type "ab". `pageState.search !== "ab"`, so page is 1, but the state is untouched.
3. Delete back to "a". State still says `{a, 3}`, so you land on page 3.

This breaks the README claim "Changing the search resets to page 1" (README.md:62). The comment "no effect needed to reset it" is right in spirit, but the derived value goes stale.

Fix: use React's "adjust state during render" pattern.
```tsx
const [pageState, setPageState] = useState({ search: '', page: 1 })
if (pageState.search !== debouncedSearch) {
  setPageState({ search: debouncedSearch, page: 1 })
}
const page = pageState.page
const goToPage = (next: number) => setPageState({ search: debouncedSearch, page: next })
```
React discards the first render and re-renders straight away, so `useCharacters` is never called with a stale page. An alternative is to give `CharacterPicker` an inner component keyed by `debouncedSearch`.

### 2. Stale response can overwrite newer results and leave `loading` stuck true (confirmed, severity Low-Medium)
File: src/hooks/useCharacters.ts:23-26

`.catch` checks `controller.signal.aborted` but `.then` does not. A stale `setSettled({key: oldKey, ...})` after the newer one settled makes `settled.key !== requestKey`, so `loading` is true forever. This matches the failing test.

Real-world likelihood is low. Native `fetch` rejects on abort, so the window is only the gap between `res.json()` resolving and the abort. It is still a correctness hole, the fix is one line, and the code comment claims this guarantee.

Fix:
```ts
.then(({ characters, pageInfo }) => {
  if (controller.signal.aborted) return
  setSettled({ key: requestKey, characters, pageInfo, error: null })
})
```

### 3. Mixed GraphQL errors treated as "no matches" (confirmed, severity Low)
File: src/api/characters.ts:77

`some(... includes('404'))` swallows a real error that arrives alongside a 404. Switch to `every`. Also tighten the match to `e.message.startsWith('404')`. `includes('404')` would also match "timeout after 4040ms" or "line 404".

The API's real "no match" is `{errors:[{message:"404: Not Found"}], data:null}`, so this is hypothetical today. I did not hit the live API to confirm the shape.

---

## Warnings (should fix)

1. Screen reader announcements read UUIDs. src/components/Board.tsx:69.
   dnd-kit's defaults say "Picked up draggable item " + `active.id` (core.esm.js:48), and the ids are `crypto.randomUUID()` values. A screen reader user hears "Picked up draggable item 3f2a9c...". README.md:73 lists this as a gap and says "dnd-kit has defaults", which undersells it. Pass `accessibility={{ announcements }}` to `DndContext`. It needs about 15 lines that look up the item title and `COLUMN_LABELS`, e.g. "Picked up Build a rocket. Over Doing, position 2 of 3". Interviewers will likely ask about this.

2. A card can't reliably be dropped at the end of a non-empty other column, and there is no live preview. Board.tsx:71, boardReducer.ts:60-65, Column.tsx:14,22.
   - The droppable column is the `<ul>`, which is exactly as tall as its cards (min-height 80px). There is no empty space below the last card to drop on.
   - Dropping on a card in another column always inserts before it (`toIndex: over.index`, boardReducer.ts:65), even when the pointer is in its lower half.
   - `closestCorners` compares rects, not the pointer. The last card and the column share nearly the same bottom corners, so which one wins is unpredictable.
   - Without `onDragOver` moving the item live, the destination column doesn't open a gap.
   - Cheapest fixes: make the whole `<section>`, or a padded wrapper with `flex: 1` and a min-height, the droppable. Or use `pointerWithin` with a `closestCorners` fallback. Or add the standard "insert after if the active rect is below the over midpoint" check. The README documents the missing live preview (README.md:64), but not the append problem.
   - I did not drag in a browser. Please verify manually, including keyboard moves into a non-empty column with `sortableKeyboardCoordinates` plus the column droppables.

3. Enter in the search box submits the whole form. CharacterPicker.tsx:33 (inside NewItemForm.tsx:21).
   `type="search"` inside a `<form>` with a submit button triggers implicit submission. If a title and character are already set, pressing Enter in the search field adds the item unexpectedly. When the form isn't valid it does nothing, which hides the problem. Add `onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}` on the search input. There is no test for this.

4. Touch scrolling is blocked on cards. App.css:45 (`touch-action: none` on the whole `.card`).
   Any touch on a card won't scroll the page. Use a `TouchSensor` with a press delay and drop `touch-action: none` from the card (or add a drag handle), or accept this as a documented limitation.

5. `Card` overrides list semantics. Card.tsx:24-29.
   dnd-kit's `attributes` put `role="button"` on the `<li>`, so the `<ul>` has `button` children instead of `listitem`. Either set `role="listitem"` plus an inner button-like drag handle, or render `div`s. The empty-state `<li aria-hidden>` in Column.tsx:26 is fine.

6. Leftover boilerplate. index.html:7 and public/favicon.svg.
   The title is still `react-kanban-board`. The favicon is the Vite logo. Set a real title and a small emoji or SVG favicon. This is the first thing interviewers see. `allowArbitraryExtensions` in tsconfig.app.json:8 is also an unused template leftover.

7. Error state is a dead end. CharacterPicker.tsx:42.
   After a failure you get `characters: []` and `pageInfo: null`, so there is no pager and no retry. A user on page 2 who hits a rate limit (429) has to retype the search. Add a "Try again" button (a retry counter in the hook's deps works).

8. Loading and empty states are not announced. CharacterPicker.tsx:43-44.
   `aria-busy` on a plain div does nothing for most screen readers. Use `role="status"` on "Loading…" and "No characters found". The `aria-live` on `.selected` (line 27) is mounted together with its content, so it may not announce. Keep a persistent live region and change only its text.

9. Responsive layout. App.css:5-6, 36-37.
   Between 901px and about 1100px the board gets about 170-250px per column next to the 320px sidebar. A card (grip, 40px avatar and text) gets cramped. Raise the single-column breakpoint to about 1100px, or let the `aside` stack above the board earlier. Under 900px the picker (about 7 rows of characters) pushes the board far below the fold. Consider a collapsible form or putting the board first. Not sticky on desktop either: `aside { position: sticky; top: 16px }` would help.

10. README accuracy.
    - README.md:9 says "Node.js 20+". I could not verify the engines of Vite 8, Vitest 5 and TypeScript 7, which are pinned in package.json:30-35. Those majors very likely need a newer minimum (Vite needs 20.19+ or 22.12+ in recent versions). Check their `engines` fields, state the real minimum, and add `"engines"` to package.json.
    - README.md:73 understates the screen-reader gap (see warning 1).
    - Scripts and file structure otherwise match package.json and the source tree.

11. Test quality.
    - Real timers and real 300ms debounce, with `waitFor` using the default 1000ms timeout (CharacterPicker.test.tsx:70-118). The "returns to an earlier search" test chains three debounces. It passes with margin, but it is a flake risk on slow CI. Use `vi.useFakeTimers({ shouldAdvanceTime: true })` with `userEvent.setup({ advanceTimers })`, or a short injectable delay.
    - Board.test.tsx:28-47 fakes layout by selecting `section.column`, `ul.card-list` and `li.card`, and `cardTitles` reads `.card-title`. It is coupled to class names and DOM shape. The comment admits it is brittle, which is acceptable, but a refactor will break it with no real regression.
    - Board.test.tsx:11 mocks `canvas-confetti` and also mocks `../board/celebrate` (line 12), so the first mock is dead. `stubMatchMedia` at line 53 is also unneeded because `celebrate` is mocked.
    - Missing coverage: a pointer drag (jsdom limits this, so it's fair to skip), a keyboard move into a non-empty column, Done to Done not celebrating at component level, and the Enter-in-search behaviour from warning 3.
    - Good: no real network anywhere (`stubFetch` everywhere, `vi.unstubAllGlobals` in `afterEach`). The reducer tests freeze inputs. The no-op identity checks (`toBe(board)`) are good.

---

## Suggestions (nice to have)

- Debounce the trimmed value (`useDebouncedValue(search.trim())`). Today "rick" then "rick " sends a duplicate request and resets to page 1, because `fetchCharacters` trims but the debounced value doesn't.
- useCharacters.ts:34: `requestKey` is derived from `search` and `page`, so it is redundant in the deps array.
- `canvas-confetti` supports `disableForReducedMotion: true`. It could replace the hand-rolled `celebrate.ts:3-8` check. Keeping your own check is fine, since it is tested and explicit.
- boardReducer.ts:57: `findItem(board, activeId)!` repeats the lookup done on line 54. Store the first result and drop the non-null assertion.
- CharacterPicker.tsx:65,69: `pageInfo.prev!` and `.next!` are safe because the button is disabled when they are null. Writing `onClick={() => pageInfo.prev && goToPage(pageInfo.prev)}` removes the assertions.
- `species` is fetched and typed (characters.ts:7, 34) but never displayed. Show it on the card (it helps tell Ricks apart) or drop it from the query.
- characters.ts:72 uses an unchecked `as GraphQLResponse`. For this size that's fine. Be ready to explain why you didn't add runtime validation.
- NewItemForm.tsx: add `maxLength` to the title (the card CSS handles long text with `overflow-wrap`). Show a small hint for why the submit button is disabled, since a disabled button gives no feedback.
- `crypto.randomUUID()` (NewItemForm.tsx:15) needs a secure context. It works on localhost but throws over plain http on a LAN IP, which matters for phone testing. A counter or `nanoid` is an alternative.
- `.empty` text (#6b7185 on #e6e8f0, App.css:43) is roughly 4:1 contrast, just under AA. Darken it slightly.
- Add `"test:run": "vitest run"` so the single-run command doesn't need `-- --run`.
- The blanket `* { transition: none !important }` under reduced motion (App.css:53-55) also disables dnd-kit's sortable transitions, which is desirable. A comment saying so would help.

---

## Checked and OK

- **dnd-kit wiring:**
  - `PointerSensor` with `distance: 5` and `KeyboardSensor` with `sortableKeyboardCoordinates` are correct.
  - One `SortableContext` per column with `verticalListSortingStrategy` is correct.
  - Dropping into an empty column works through the column's `useDroppable`.
  - `DragOverlay` is correct and `isDragging` dims the source.
  - Cancel and Escape clear the active item and highlight.
  - Move-on-drop (no `onDragOver` mutation) keeps the reducer simple.
- **Reducer:**
  - Pure and immutable. Unknown ids return the same reference. The index is clamped. Same-column moves use "remove then insert", which matches `arrayMove` semantics. The no-op check avoids needless re-renders.
  - `resolveMove` handles drop-on-self, an unknown id, and dropping on your own column (goes to the end).
- **Confetti:**
  - It fires once, from `handleDragEnd` (Board.tsx:60), after dispatch and only when `enteredDone(from, to)` is true, using the pre-move snapshot. It does not fire in a reducer or effect, so StrictMode double invocation is safe.
  - Reorder in Done, Done to other, and a cancelled drag do not fire it.
  - The reduced-motion check runs at call time and is guarded for a missing `matchMedia`.
- **XSS:** titles and API strings are rendered as React text. Images use API URLs only in `<img src>` with `alt=""` and no `dangerouslySetInnerHTML`. No concerns.
- **Keys and cleanup:**
  - Stable keys (`item.id`, `c.id`).
  - `AbortController` is aborted on cleanup, `clearTimeout` runs in the debounce, and there are no leaked listeners.
- **Types:** strict mode is on, there are no `any` casts, and the only non-null assertions are the `getElementById('root')!` boilerplate and the `pageInfo.prev!`/`next!` and `findItem(...)!` ones noted above. The `canSubmit` alias narrows `character` correctly.
- **Dependencies:** all runtime deps are used (`@dnd-kit/utilities` via `CSS` in Card.tsx). `@testing-library/dom` is the required peer of RTL 16. Plain fetch, as requested.
- **README:** commands match package.json scripts, the structure matches the tree, and the tradeoffs are honest.

## What to do first

1. Fix bugs 1-3 (about 10 lines in total). All three failing tests should go green.
2. Add custom announcements (warning 1) and fix the drop target / append problem (warning 2).
3. Stop Enter in the search box from submitting the form (warning 3), then clean up the title and favicon.
4. Run `npm test -- --run`, `npm run build` and `npm run lint` yourself, since I could not.
