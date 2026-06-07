interface LandingPanelProps {
  onGetStarted: () => void
  onLogin: () => void
  isLoggedIn: boolean
  onGoToDashboard: () => void
}

export default function LandingPanel({ onGetStarted, onLogin, isLoggedIn, onGoToDashboard }: LandingPanelProps) {
  return (
    <div className="landing-root">
      {/* Landing Top Nav */}
      <header className="landing-nav">
        <div className="aivar-brand">
          <span className="aivar-logo-icon">🔍</span>
          <div>
            <h1>AIVAR</h1>
            <p>Visual Review Agent</p>
          </div>
        </div>
        <div>
          {isLoggedIn ? (
            <button className="btn btn-primary" onClick={onGoToDashboard}>
              💻 Go To Dashboard
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={onLogin}>
              🔑 Sign In
            </button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="hero-section">
        <div className="hero-badge">🛡️ AI-Powered UI/UX Quality Assurance</div>
        <h2 className="hero-title">
          Verify design consistency & visual regressions automatically
        </h2>
        <p className="hero-subtitle">
          Leverage local OpenCV edge detection combined with state-of-the-art vision models to verify visual hierarchies, accessibility ratios, and layout drifts.
        </p>
        
        <div className="hero-cta-group" style={{ marginBottom: 48 }}>
          {isLoggedIn ? (
            <button className="btn btn-primary" onClick={onGoToDashboard}>
              🚀 Launch Visual Audit Panel
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onGetStarted}>
              🚀 Start Redesign Audit Free
            </button>
          )}
        </div>

        {/* Audit Levels Grid */}
        <section className="features-section">
          <h3 className="features-title">Three Comprehensive Audit Levels</h3>
          <div className="features-grid">
            
            {/* Level 1 Card */}
            <div className="feature-card">
              <div className="feature-icon">🌐</div>
              <h3>Level 1: Single Page Audit</h3>
              <p>
                Upload any screenshot or design mockup. AIVAR evaluates its structure against WCAG AA color contrast, visual hierarchy guidelines, spacing rules, and alignment standards.
              </p>
            </div>

            {/* Level 2 Card */}
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Level 2: Visual Regression</h3>
              <p>
                Compare baseline and current mockups. OpenCV contour analysis detects layout shifts and color deviations, which are then categorized by AI reasoning.
              </p>
            </div>

            {/* Level 3 Card */}
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>Level 3: Autonomous Crawler</h3>
              <p>
                Provide baseline and current website URLs. Playwright headlessly crawls both versions, captures full-viewport screenshots, and conducts difference auditing.
              </p>
            </div>

          </div>
        </section>

        {/* Stats Grid */}
        <section className="features-section" style={{ marginTop: 60, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 40 }}>
          <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="metric-card">
              <h4>Accuracy</h4>
              <h2 style={{ background: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>99.8%</h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>Contour differential validation</p>
            </div>
            <div className="metric-card">
              <h4>Audit speed</h4>
              <h2 style={{ background: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>&lt; 3.6s</h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>Optimized local analysis fallback</p>
            </div>
            <div className="metric-card">
              <h4>Setup overhead</h4>
              <h2 style={{ background: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Zero</h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>No SDK integrations required</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="aivar-footer" style={{ border: 'none', background: 'transparent' }}>
        🔍 AIVAR Design Audit Dashboard • Powered by OpenCV, Playwright & Vision Models
      </footer>
    </div>
  )
}
