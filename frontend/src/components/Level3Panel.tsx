import { useState } from 'react'
import { auditSite } from '../api'

export default function Level3Panel() {
  const [baselineUrl, setBaselineUrl] = useState('')
  const [currentUrl, setCurrentUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  async function handleAudit() {
    if (!baselineUrl || !currentUrl) return setError('Please enter both baseline and current URLs')
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await auditSite({
        baselineUrl,
        currentUrl,
        diffThreshold: 15,
        minArea: 80
      })
      setResult(res)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const downloadJson = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aivar_site_audit_report.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="panel">
      <h2>🤖 Level 3: Autonomous Site Audit</h2>
      <p className="subtitle">Enter two URLs to launch Playwright headless crawlers, capture screenshots, and perform visual audit differences automatically.</p>

      <div className="input-grid">
        <div className="input-group">
          <label>Baseline URL (Before)</label>
          <input 
            type="text"
            placeholder="e.g. https://shakinsakthi-100.github.io/demo-v1" 
            value={baselineUrl} 
            onChange={(e) => setBaselineUrl(e.target.value)} 
          />
        </div>
        <div className="input-group">
          <label>Current URL (After)</label>
          <input 
            type="text"
            placeholder="e.g. https://shakinsakthi-100.github.io/demo-v2" 
            value={currentUrl} 
            onChange={(e) => setCurrentUrl(e.target.value)} 
          />
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <button 
          className="btn btn-primary btn-full" 
          onClick={handleAudit} 
          disabled={loading || !baselineUrl || !currentUrl}
        >
          {loading ? 'Initializing Web Crawlers...' : '🚀 Run Autonomous Site Audit'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="loader-container">
          <div className="spinner"></div>
          <p>AIVAR is spawning Playwright processes, loading targets, matching viewport configurations, and conducting design difference logic...</p>
        </div>
      )}

      {result && (
        <div className="result" style={{ animation: 'fadeIn 0.5s ease' }}>
          
          {/* Verdict Banner */}
          {result.overall_verdict && (
            <div className={`verdict-banner ${result.overall_verdict.toLowerCase()}`}>
              OVERALL VERDICT: {result.overall_verdict.toUpperCase()}
            </div>
          )}

          {/* Metrics Card Grid */}
          <div className="metric-grid">
            <div className="metric-card glow-danger">
              <h4 style={{ color: 'var(--danger)' }}>Regressions 🔴</h4>
              <h2 style={{ color: 'var(--danger)' }}>{result.summary?.regressions || 0}</h2>
            </div>
            <div className="metric-card glow-success">
              <h4 style={{ color: 'var(--success)' }}>Improvements 🟢</h4>
              <h2 style={{ color: 'var(--success)' }}>{result.summary?.improvements || 0}</h2>
            </div>
            <div className="metric-card glow-warning">
              <h4 style={{ color: 'var(--text-secondary)' }}>Neutral 🟡</h4>
              <h2 style={{ color: 'var(--text-secondary)' }}>{result.summary?.neutral || 0}</h2>
            </div>
            <div className="metric-card glow-primary">
              <h4 style={{ color: 'var(--primary)' }}>Differences</h4>
              <h2 style={{ color: 'var(--primary)' }}>{result.differences?.length || 0}</h2>
            </div>
          </div>

          {/* Visual Diff Display */}
          <h3 style={{ marginTop: 32, fontSize: 18 }}>Annotated Site differences</h3>
          <div className="comparative-columns" style={{ gridTemplateColumns: '1fr' }}>
            <div className="image-container">
              <p>Current version with highlight boundaries</p>
              {(result.annotatedImageUrl || result.annotated_image_url || result.annotated_image) && (
                <img 
                  src={result.annotatedImageUrl || result.annotated_image_url || result.annotated_image} 
                  alt="crawled difference details" 
                  style={{ maxHeight: '600px', objectFit: 'contain' }}
                />
              )}
            </div>
          </div>

          {/* Detailed Differences List */}
          <h3 style={{ marginTop: 32, fontSize: 18 }}>Detailed regression details</h3>
          <div className="findings-container">
            {(!result.differences || result.differences.length === 0) ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No differences found between crawled site pages!</p>
            ) : (
              result.differences.map((diff: any, idx: number) => {
                const classif = (diff.classification || 'neutral').toLowerCase();
                const loc = diff.location || {};
                const locStr = `x: ${loc.x}px, y: ${loc.y}px, size: ${loc.width}x${loc.height}px`;
                return (
                  <div key={idx} className={`finding-card ${classif}`}>
                    <div className="finding-header">
                      <span className="finding-title">Difference #{idx + 1}</span>
                      <span className="severity-badge">{diff.classification || 'neutral'}</span>
                    </div>
                    <div className="finding-body">
                      <div>
                        <strong>What Changed:</strong> {diff.what_changed}
                      </div>
                      {diff.user_impact && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                          <strong>User Impact:</strong> {diff.user_impact}
                        </div>
                      )}
                    </div>
                    <div className="finding-footer">
                      <span>📍 Location Bounds: {locStr}</span>
                      <span>🎯 Confidence: {Math.round((diff.confidence_score || 0.8) * 100)}%</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Action Download Buttons */}
          <div className="actions-bar">
            <button className="btn btn-primary" onClick={downloadJson}>
              📥 Download JSON Report
            </button>
            {(result.annotatedImageUrl || result.annotated_image_url || result.annotated_image) && (
              <a 
                href={result.annotatedImageUrl || result.annotated_image_url || result.annotated_image} 
                download="aivar_crawler_diff.png" 
                className="btn btn-secondary"
                target="_blank"
                rel="noreferrer"
              >
                📥 Download Annotated Diff Image
              </a>
            )}
          </div>

          {/* Dev JSON toggler */}
          <div className="json-toggle-container">
            <div className="json-header" onClick={() => setShowJson(!showJson)}>
              <h4>Developer JSON Spec</h4>
              <span className={`json-arrow ${showJson ? 'open' : ''}`}>▶</span>
            </div>
            {showJson && (
              <pre className="json">{JSON.stringify(result, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
