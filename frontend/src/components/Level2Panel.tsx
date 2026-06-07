import { useState } from 'react'
import { analyzeRegression } from '../api'

export default function Level2Panel() {
  const [baseline, setBaseline] = useState<File | null>(null)
  const [current, setCurrent] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCompare() {
    if (!baseline || !current) return setError('Select baseline and current images')
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('baseline', baseline)
      fd.append('current', current)
      const res = await analyzeRegression(fd)
      setResult(res)
    } catch (e: any) {
      setError(e?.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">
      <h2>Level 2 — Visual Regression</h2>
      <p>Upload baseline and current screenshots to detect visual regressions.</p>
      <div>
        <label>Baseline image</label>
        <input type="file" accept="image/*" onChange={(e)=>setBaseline(e.target.files?e.target.files[0]:null)} />
      </div>
      <div>
        <label>Current image</label>
        <input type="file" accept="image/*" onChange={(e)=>setCurrent(e.target.files?e.target.files[0]:null)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={handleCompare} disabled={loading}>{loading ? 'Comparing…' : 'Run Regression'}</button>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="result">
          <h3>Regression Report</h3>
          { (result.annotated_image_url || result.annotatedImageUrl || result.annotated_image) && (
            <div className="annotated">
              <img src={result.annotated_image_url || result.annotatedImageUrl || result.annotated_image} alt="annotated" />
            </div>
          )}
          <pre className="json">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </section>
  )
}
