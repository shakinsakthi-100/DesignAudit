export async function analyzeImage(formData: FormData) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function analyzeRegression(formData: FormData) {
  const res = await fetch('/api/analyze-regression', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export interface AuditSitePayload {
  baselineUrl: string
  currentUrl: string
  diffThreshold?: number
  minArea?: number
}

export async function auditSite(body: AuditSitePayload) {
  const res = await fetch('/api/audit-site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
