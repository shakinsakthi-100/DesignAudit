import { useState } from 'react'
import './App.css'
import Level1Panel from './components/Level1Panel'
import Level2Panel from './components/Level2Panel'
import Level3Panel from './components/Level3Panel'

function App() {
  const [tab, setTab] = useState<'level1' | 'level2' | 'level3'>('level1')

  return (
    <div className="aivar-root">
      <header className="aivar-header">
        <div className="aivar-brand">
          <span className="aivar-logo-icon">🔍</span>
          <div>
            <h1>AIVAR Design Audit</h1>
            <p>UI/UX Design Review & Visual Audit Agent</p>
          </div>
        </div>
        <nav className="tabs">
          <button 
            className={tab === 'level1' ? 'active' : ''} 
            onClick={() => setTab('level1')}
          >
            🌐 Level 1: Single Page Audit
          </button>
          <button 
            className={tab === 'level2' ? 'active' : ''} 
            onClick={() => setTab('level2')}
          >
            🔄 Level 2: Visual Regression
          </button>
          <button 
            className={tab === 'level3' ? 'active' : ''} 
            onClick={() => setTab('level3')}
          >
            🤖 Level 3: Autonomous Site Audit
          </button>
        </nav>
      </header>

      <main className="aivar-main">
        {tab === 'level1' && <Level1Panel />}
        {tab === 'level2' && <Level2Panel />}
        {tab === 'level3' && <Level3Panel />}
      </main>

      <footer className="aivar-footer">
        🔍 AIVAR Design Audit Dashboard • Powered by OpenCV, Playwright & Vision Models
      </footer>
    </div>
  )
}

export default App
