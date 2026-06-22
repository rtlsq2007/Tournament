import { useEffect, useRef, useState } from 'react'

export async function createTournament(payload) {
  const r = await fetch('/api/tournament', { method: 'POST', body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('생성 실패')
  return r.json()
}

export async function getTournament(id, since = 0) {
  const r = await fetch(`/api/tournament/${id}?since=${since}`)
  if (r.status === 304) return null
  if (r.status === 404) throw new Error('대회를 찾을 수 없습니다')
  return r.json()
}

export async function putTournament(id, token, data, name, baseUpdatedAt) {
  const r = await fetch(`/api/tournament/${id}`, {
    method: 'PUT',
    headers: { 'x-admin-token': token },
    body: JSON.stringify({ data, name, baseUpdatedAt }),
  })
  if (r.status === 409) { const c = await r.json(); const e = new Error('conflict'); e.conflict = c; throw e }
  if (!r.ok) throw new Error('저장 실패')
  return r.json()
}

export function usePolling(id, intervalMs = 4000) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const sinceRef = useRef(0)

  useEffect(() => {
    let alive = true
    let timer
    const tick = async () => {
      try {
        const res = await getTournament(id, sinceRef.current)
        if (alive && res) { sinceRef.current = res.updatedAt; setState(res); setError(null) }
      } catch (e) { if (alive) setError(e.message) }
      timer = setTimeout(tick, intervalMs)
    }
    tick()
    return () => { alive = false; clearTimeout(timer) }
  }, [id, intervalMs])

  return { state, error, setState, sinceRef }
}
