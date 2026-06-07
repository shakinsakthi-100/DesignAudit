import { useState } from 'react'

interface AuthPanelProps {
  onAuthSuccess: (email: string) => void
  onBackToLanding: () => void
  defaultMode?: 'login' | 'signup'
}

export default function AuthPanel({ onAuthSuccess, onBackToLanding, defaultMode = 'login' }: AuthPanelProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      return setError('Please fill in all required fields')
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return setError('Please enter a valid email address')
    }

    if (password.length < 6) {
      return setError('Password must be at least 6 characters long')
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        return setError('Passwords do not match')
      }
      // Simulate successful registration and automatically log them in
      onAuthSuccess(email)
    } else {
      // Simulate successful login
      onAuthSuccess(email)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-card" style={{ animation: 'fadeIn 0.3s ease' }}>
        
        {/* Auth Brand Header */}
        <div className="auth-header">
          <div className="aivar-brand" style={{ justifyContent: 'center', marginBottom: 16 }}>
            <span className="aivar-logo-icon">🔍</span>
            <h1 style={{ fontSize: 20 }}>AIVAR</h1>
          </div>
          <h2>{mode === 'login' ? 'Sign in to AIVAR' : 'Create your account'}</h2>
          <p>{mode === 'login' ? 'Enter your credentials to access the audit panel' : 'Get started with automated visual audits'}</p>
        </div>

        {/* Auth Toggle Tabs */}
        <div className="auth-toggle-group">
          <button 
            className={mode === 'login' ? 'active' : ''} 
            onClick={() => { setMode('login'); setError(null); }}
          >
            Sign In
          </button>
          <button 
            className={mode === 'signup' ? 'active' : ''} 
            onClick={() => { setMode('signup'); setError(null); }}
          >
            Sign Up
          </button>
        </div>

        {/* Auth Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          
          <div className="input-group">
            <label htmlFor="email">Email Address</label>
            <input 
              id="email"
              type="email" 
              placeholder="name@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === 'signup' && (
              <p className="form-help-text">Must be at least 6 characters long</p>
            )}
          </div>

          {mode === 'signup' && (
            <div className="input-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input 
                id="confirmPassword"
                type="password" 
                placeholder="••••••••" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          {error && <div className="error-banner" style={{ marginTop: 8 }}>{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: 8 }}>
            {mode === 'login' ? 'Sign In 🔑' : 'Create Account 🚀'}
          </button>

          <button 
            type="button" 
            className="btn btn-secondary btn-full" 
            onClick={onBackToLanding}
          >
            🏠 Back to Home
          </button>

        </form>
      </div>
    </div>
  )
}
