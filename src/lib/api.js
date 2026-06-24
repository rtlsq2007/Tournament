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

// 라켓단 멤버 (동아리 공용)
export async function getMembers() {
  const r = await fetch('/api/members')
  if (!r.ok) throw new Error('멤버 불러오기 실패')
  return (await r.json()).members || []
}
export async function putMembers(members) {
  const r = await fetch('/api/members', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ members }),
  })
  if (!r.ok) throw new Error('멤버 저장 실패')
  return r.json()
}

// 경기 기록 보관함 (클럽 공용 — 모든 대회 결과 누적)
export async function getRecords() {
  const r = await fetch('/api/records')
  if (!r.ok) throw new Error('기록 불러오기 실패')
  return (await r.json()).records || []
}
export async function putRecords(records) {
  const r = await fetch('/api/records', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ records }),
  })
  if (!r.ok) throw new Error('기록 저장 실패')
  return r.json()
}

// AI 밸런싱: players [{name,tier,strengths,weaknesses}] → [[선수인덱스,...], ...]
export async function aiBalance(players, teamSize) {
  const r = await fetch('/api/balance', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ players, teamSize }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'AI 밸런스 실패')
  return d.teams || []
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
