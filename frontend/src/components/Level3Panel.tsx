import { useState } from 'react'
import { auditSite } from '../api'

export default function Level3Panel(){
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAudit(){
    if(!url) return setError('Enter a site URL')
    setLoading(true); setError(null); setResult(null)
    try{
      const res = await auditSite({ url })
      setResult(res)
    }catch(e:any){
      setError(e?.message || String(e))
    }finally{ setLoading(false) }
  }

  return (
    <section className="panel">
      <h2>Level 3 — Site Audit</h2>
      <p>Enter a site URL to run an autonomous crawl and audit.</p>
      <input placeholder="https://example.com" value={url} onChange={(e)=>setUrl(e.target.value)} />
      <div style={{ marginTop: 8 }}>
        <button onClick={handleAudit} disabled={loading}>{loading? 'Running audit…': 'Run Site Audit'}</button>
      </div>

      {error && <div className="error">{error}</div>}

      {result && (
        <div className="result">
          <h3>Audit Report</h3>
          <pre className="json">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </section>
  )
}
