import { useReducer } from 'react'
import { boardReducer, initialBoard } from './board/boardReducer'
import { Board } from './components/Board'
import { NewItemForm } from './components/NewItemForm'
import './App.css'

export default function App() {
  const [board, dispatch] = useReducer(boardReducer, initialBoard)

  return (
    <div className="app">
      <header>
        <h1>Rick &amp; Morty Kanban</h1>
      </header>
      <main className="layout">
        <aside>
          <NewItemForm onAdd={(item) => dispatch({ type: 'addItem', item })} />
        </aside>
        <Board board={board} dispatch={dispatch} />
      </main>
    </div>
  )
}
