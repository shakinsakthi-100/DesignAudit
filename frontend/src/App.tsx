import { useState } from 'react'
import './App.css'
import Level1Panel from './components/Level1Panel'
import Level2Panel from './components/Level2Panel'
import Level3Panel from './components/Level3Panel'

function App() {
  const [tab, setTab] = useState<'level1'|'level2'|'level3'>('level1')

  return (
    <div className="aivar-root">
      <header className="aivar-header">
        <h1>AIVAR — Visual Audit</h1>
        <nav className="tabs">
          <button className={tab==='level1'? 'active':''} onClick={()=>setTab('level1')}>Level 1</button>
          <button className={tab==='level2'? 'active':''} onClick={()=>setTab('level2')}>Level 2</button>
          <button className={tab==='level3'? 'active':''} onClick={()=>setTab('level3')}>Level 3</button>
        </nav>
      </header>

      <main className="aivar-main">
        {tab === 'level1' && <Level1Panel />}
        {tab === 'level2' && <Level2Panel />}
        {tab === 'level3' && <Level3Panel />}
      </main>

      <footer className="aivar-footer">Powered by AIVAR</footer>
    </div>
  )
}

export default App
