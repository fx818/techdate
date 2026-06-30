'use client'

import { useState } from 'react'

type MaskedConfig = {
  enabled: boolean
  base_url: string
  model: string
  criteria: string
  pass_threshold: number
  key_set: boolean
  key_last4: string | null
}

export function JudgeConfigForm({ initial }: { initial: MaskedConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [baseUrl, setBaseUrl] = useState(initial.base_url)
  const [model, setModel] = useState(initial.model)
  const [criteria, setCriteria] = useState(initial.criteria)
  const [threshold, setThreshold] = useState(initial.pass_threshold)
  const [apiKey, setApiKey] = useState('')
  const [keySet, setKeySet] = useState(initial.key_set)
  const [keyLast4, setKeyLast4] = useState(initial.key_last4)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled, base_url: baseUrl, model, criteria,
          pass_threshold: threshold, api_key: apiKey,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Save failed'); return }
      const c = json.config as MaskedConfig
      setEnabled(c.enabled); setBaseUrl(c.base_url); setModel(c.model)
      setCriteria(c.criteria); setThreshold(c.pass_threshold)
      setKeySet(c.key_set); setKeyLast4(c.key_last4)
      setApiKey('')
      setMsg('Saved.')
    } catch {
      setMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <label className="card p-4 flex items-center justify-between">
        <span className="text-ink font-medium">Judge enabled</span>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
      </label>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">API key</label>
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
          placeholder={keySet ? `•••• ${keyLast4 ?? ''} — set (blank keeps it)` : 'not set'}
          className="w-full bg-transparent border border-line rounded px-3 py-2 text-ink" />
      </div>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">Base URL</label>
        <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
          className="w-full bg-transparent border border-line rounded px-3 py-2 text-ink" />
      </div>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">Model</label>
        <input value={model} onChange={e => setModel(e.target.value)}
          className="w-full bg-transparent border border-line rounded px-3 py-2 text-ink" />
      </div>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">
          Pass threshold ({threshold}/10)
        </label>
        <input type="range" min={0} max={10} value={threshold}
          onChange={e => setThreshold(Number(e.target.value))} className="w-full" />
      </div>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">Criteria</label>
        <textarea value={criteria} onChange={e => setCriteria(e.target.value)} rows={6}
          className="w-full bg-transparent border border-line rounded px-3 py-2 text-ink text-sm" />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? 'Saving…' : 'Save'}
        </button>
        {msg && <span className="text-ink-faint text-sm">{msg}</span>}
      </div>
    </div>
  )
}
