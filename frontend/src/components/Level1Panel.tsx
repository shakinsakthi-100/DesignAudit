import { useState } from 'react'
import { analyzeImage } from '../api'

export default function Level1Panel() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload() {
    if (!file) return setError('Select an image to analyze')
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

  return (
    <section className="panel">
      <h2>Level 1 — Single Image Audit</h2>
      <p>Upload a screenshot or image for a single-page visual audit.</p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
      />
      <div style={{ marginTop: 8 }}>
        <button onClick={handleUpload} disabled={loading}>
          {loading ? 'Analyzing…' : 'Analyze Image'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="result">
          <h3>Result</h3>
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
