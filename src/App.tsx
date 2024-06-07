import './App.css'
import { Header } from './components/header'
import { SearchList } from './components/search-list'

function App() {
  return (
    <>
      <Header/>
      <main className="mx-auto pt-4">
        <SearchList/>
      </main>
    </>
  )
}

export default App
