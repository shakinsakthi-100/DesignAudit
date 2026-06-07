import { useState, useRef } from 'react'
import { analyzeRegression } from '../api'

export default function Level2Panel() {
  const [baseline, setBaseline] = useState<File | null>(null)
  const [current, setCurrent] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)

  const baselineRef = useRef<HTMLInputElement>(null)
  const currentRef = useRef<HTMLInputElement>(null)

  async function handleCompare() {
    if (!baseline || !current) return setError('Please select both baseline and current images')
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('baseline', baseline)
      fd.append('current', current)
      fd.append('diffThreshold', '15')
      fd.append('minArea', '80')
      const res = await analyzeRegression(fd)
      setResult(res)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const downloadJson = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aivar_regression_report.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="panel">
      <h2>🔄 Level 2: Visual Regression comparison</h2>
      <p className="subtitle">Upload baseline and current screenshots to automatically highlight, classify, and detail visual differences.</p>

      <div className="upload-grid dual">
        {/* Baseline Dropzone */}
        <div 
          className={`file-dropzone ${baseline ? 'has-file' : ''}`}
          onClick={() => baselineRef.current?.click()}
        >
          <input
            type="file"
            accept="image/*"
            ref={baselineRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setBaseline(e.target.files[0])
                setError(null)
              }
            }}
            style={{ display: 'none' }}
          />
          <div className="dropzone-icon">{baseline ? '📄' : '📁'}</div>
          <div className="dropzone-text">
            {baseline ? (
              <>
                <h4>Baseline: {baseline.name}</h4>
                <p>{formatBytes(baseline.size)}</p>
              </>
            ) : (
              <>
                <h4>Baseline Image (Before)</h4>
                <p>Drag or select baseline screenshot</p>
              </>
            )}
          </div>
        </div>

        {/* Current Dropzone */}
        <div 
          className={`file-dropzone ${current ? 'has-file' : ''}`}
          onClick={() => currentRef.current?.click()}
        >
          <input
            type="file"
            accept="image/*"
            ref={currentRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setCurrent(e.target.files[0])
                setError(null)
              }
            }}
            style={{ display: 'none' }}
          />
          <div className="dropzone-icon">{current ? '📄' : '📁'}</div>
          <div className="dropzone-text">
            {current ? (
              <>
                <h4>Current: {current.name}</h4>
                <p>{formatBytes(current.size)}</p>
              </>
            ) : (
              <>
                <h4>Current Image (After)</h4>
                <p>Drag or select current screenshot</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <button 
          className="btn btn-primary btn-full" 
          onClick={handleCompare} 
          disabled={loading || !baseline || !current}
        >
          {loading ? 'Comparing screenshots...' : '🚀 Run Visual Regression Analysis'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="loader-container">
          <div className="spinner"></div>
          <p>AIVAR is matching layout elements, running edge contour comparisons, and calling Vision AI logic...</p>
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

          {/* Metrics Displays */}
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

          {/* Side by Side Image display */}
          <h3 style={{ marginTop: 32, fontSize: 18 }}>Comparative Visuals</h3>
          <div className="comparative-columns">
            <div className="image-container">
              <p>Baseline (Before)</p>
              {baseline && <img src={URL.createObjectURL(baseline)} alt="baseline" />}
            </div>
            <div className="image-container">
              <p>Current (After) with highlights</p>
              {(result.annotatedImageUrl || result.annotated_image_url || result.annotated_image) && (
                <img 
                  src={result.annotatedImageUrl || result.annotated_image_url || result.annotated_image} 
                  alt="annotated diff" 
                />
              )}
            </div>
          </div>

          {/* Detailed Differences List */}
          <h3 style={{ marginTop: 32, fontSize: 18 }}>Detailed regression details</h3>
          <div className="findings-container">
            {(!result.differences || result.differences.length === 0) ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No differences found! The screenshots are identical.</p>
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

          {/* Action button bar */}
          <div className="actions-bar">
            <button className="btn btn-primary" onClick={downloadJson}>
              📥 Download JSON Report
            </button>
            {(result.annotatedImageUrl || result.annotated_image_url || result.annotated_image) && (
              <a 
                href={result.annotatedImageUrl || result.annotated_image_url || result.annotated_image} 
                download="aivar_annotated_diff.png" 
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
