import { useState, useRef } from 'react'
import { analyzeImage } from '../api'

export default function Level1Panel() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showJson, setShowJson] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) return setError('Please select an image first')
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('screenshot', file)
      const res = await analyzeImage(fd)
      setResult(res)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setError(null)
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
    a.download = `aivar_design_audit_report.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <section className="panel">
      <h2>🌐 Level 1: Single Page Design Audit</h2>
      <p className="subtitle">Upload a screenshot or mockup to evaluate visual hierarchy, contrast, spacing, alignment, and guidelines compliance.</p>

      <div className="upload-grid">
        <div 
          className={`file-dropzone ${file ? 'has-file' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0])
                setError(null)
              }
            }}
            style={{ display: 'none' }}
          />
          <div className="dropzone-icon">
            {file ? '📄' : '📤'}
          </div>
          <div className="dropzone-text">
            {file ? (
              <>
                <h4>{file.name}</h4>
                <p>{formatBytes(file.size)} • Click or drag another file to replace</p>
              </>
            ) : (
              <>
                <h4>Drag & drop page screenshot here</h4>
                <p>Supports PNG, JPG, JPEG, or WEBP (Max 10MB)</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <button 
          className="btn btn-primary btn-full" 
          onClick={handleUpload} 
          disabled={loading || !file}
        >
          {loading ? 'Analyzing layouts...' : '🚀 Run Design Audit'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="loader-container">
          <div className="spinner"></div>
          <p>AIVAR is evaluating contrast, checking visual grids, and cataloging spacing anomalies...</p>
        </div>
      )}

      {result && (
        <div className="result" style={{ animation: 'fadeIn 0.5s ease' }}>
          
          {/* Verdict Scorecard Header */}
          <div className="verdict-banner neutral">
            DESIGN SCORE: {result.summary?.overallScore || 0}/100 ({result.summary?.gradeLabel || 'N/A'} {result.summary?.gradeEmoji || ''})
          </div>

          {/* Metric Breakdown */}
          <div className="metric-grid">
            <div className="metric-card glow-danger">
              <h4 style={{ color: 'var(--danger)' }}>Critical 🚨</h4>
              <h2 style={{ color: 'var(--danger)' }}>{result.summary?.critical || 0}</h2>
            </div>
            <div className="metric-card glow-warning">
              <h4 style={{ color: '#ff9f0a' }}>High 🔴</h4>
              <h2 style={{ color: '#ff9f0a' }}>{result.summary?.high || 0}</h2>
            </div>
            <div className="metric-card glow-info">
              <h4 style={{ color: 'var(--warning)' }}>Medium 🟡</h4>
              <h2 style={{ color: 'var(--warning)' }}>{result.summary?.medium || 0}</h2>
            </div>
            <div className="metric-card glow-primary">
              <h4 style={{ color: 'var(--info)' }}>Low/Info 🔵</h4>
              <h2 style={{ color: 'var(--info)' }}>{(result.summary?.low || 0) + (result.summary?.info || 0)}</h2>
            </div>
          </div>

          <h3 style={{ marginTop: 32, fontSize: 18 }}>Detailed Findings</h3>
          
          <div className="findings-container">
            {(!result.findings || result.findings.length === 0) ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No issues found! Your design complies perfectly with guidelines.</p>
            ) : (
              result.findings.map((finding: any, idx: number) => {
                const sev = (finding.severity || 'medium').toLowerCase();
                return (
                  <div key={finding.id || idx} className={`finding-card ${sev}`}>
                    <div className="finding-header">
                      <span className="finding-title">{finding.principle || 'Design Consistency'}</span>
                      <span className="severity-badge">{finding.severity || 'medium'}</span>
                    </div>
                    <div className="finding-body">
                      <div>
                        <strong>Description:</strong> {finding.description}
                      </div>
                      {finding.userImpact && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
                          <strong>User Impact:</strong> {finding.userImpact}
                        </div>
                      )}
                      {finding.recommendation && (
                        <div className="finding-recommendation">
                          <strong>Recommendation:</strong> {finding.recommendation}
                        </div>
                      )}
                    </div>
                    <div className="finding-footer">
                      <span>📍 Location: {finding.location || 'Full Page'}</span>
                      <span>🎯 Confidence: {finding.confidence || 80}%</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Action Export Row */}
          <div className="actions-bar">
            <button className="btn btn-primary" onClick={downloadJson}>
              📥 Download JSON Report
            </button>
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
