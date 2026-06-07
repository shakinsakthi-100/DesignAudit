import { useState } from 'react'
import './App.css'
import Level1Panel from './components/Level1Panel'
import Level2Panel from './components/Level2Panel'
import Level3Panel from './components/Level3Panel'
import LandingPanel from './components/LandingPanel'
import AuthPanel from './components/AuthPanel'
import ChatbotSymbol from './components/ChatbotSymbol'

type PageState = 'landing' | 'auth' | 'dashboard'

function App() {
  const [page, setPage] = useState<PageState>('landing')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [tab, setTab] = useState<'level1' | 'level2' | 'level3'>('level1')

  const handleAuthSuccess = (email: string) => {
    setIsAuthenticated(true)
    setUserEmail(email)
    setPage('dashboard')
  }

  const handleSignOut = () => {
    setIsAuthenticated(false)
    setUserEmail(null)
    setPage('landing')
  }

  const handleChatbotClick = () => {
    if (isAuthenticated) {
      setPage('dashboard')
    } else {
      setAuthMode('login')
      setPage('auth')
    }
  }

  return (
    <>
      {page === 'landing' && (
        <LandingPanel 
          isLoggedIn={isAuthenticated}
          onGetStarted={() => {
            setAuthMode('signup')
            setPage('auth')
          }}
          onLogin={() => {
            setAuthMode('login')
            setPage('auth')
          }}
          onGoToDashboard={() => setPage('dashboard')}
        />
      )}

      {page === 'auth' && (
        <AuthPanel 
          defaultMode={authMode}
          onAuthSuccess={handleAuthSuccess}
          onBackToLanding={() => setPage('landing')}
        />
      )}

      {page === 'dashboard' && (
        <div className="aivar-root" style={{ animation: 'fadeIn 0.4s ease' }}>
          <header className="aivar-header">
            <div className="aivar-brand" style={{ cursor: 'pointer' }} onClick={() => setPage('landing')}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                👤 {userEmail}
              </span>
              <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={handleSignOut}>
                🚪 Sign Out
              </button>
            </div>
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
      )}

      {/* Floating chatbot symbol visible on Landing & Auth views */}
      {page !== 'dashboard' && (
        <ChatbotSymbol 
          onClick={handleChatbotClick} 
          tooltipText={
            isAuthenticated 
              ? "💻 Go to visual design audit dashboard!" 
              : "🔑 Sign in to start design audits!"
          }
        />
      )}
    </>
  )
}

export default App
