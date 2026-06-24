import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePolling } from '../lib/api.js'
import { getFormat } from '../formats/index.js'
import Bracket from '../components/Bracket.jsx'
import Podium from '../components/Podium.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'

export default function PublicView() {
  const { id } = useParams()
  const { state, error } = usePolling(id)
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const bracketBoxRef = useRef(null)

  // Ctrl+휠: 페이지 전체가 아니라 대진표만 확대/축소
  useEffect(() => {
    const el = bracketBoxRef.current
    if (!el) return
    const onWheel = e => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoom(z => Math.min(1.5, Math.max(0.4, +(z * (e.deltaY < 0 ? 1.08 : 0.92)).toFixed(3))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [state])

  const highlightTeamIds = useMemo(() => {
    if (!state || !query.trim()) return []
    const q = query.trim()
    const ps = state.data.participants || []
    const has = pid => (ps.find(p => p.id === pid)?.name || '').includes(q)
    return (state.data.teams || []).filter(t => t.playerIds.some(has)).map(t => t.id)
  }, [state, query])

  if (error) return <div className="app"><div className="card"><h2 className="h2">⚠️ {error}</h2></div><ThemeToggle bottom /></div>
  if (!state) return <div className="app"><div className="muted">불러오는 중…</div></div>

  const data = state.data
  const fmt = getFormat(data.format)
  const work = { structure: data.structure, matches: data.matches }
  const hasBracket = data.matches?.length > 0
  const teamMode = data.matchType !== 'singles'
  const teamLabel = t => t.label?.trim() || (t.playerIds.length > 1 ? `${t.no}팀`
    : (data.participants.find(p => p.id === t.playerIds[0])?.name || '?'))
  const finalStandings = hasBracket && fmt.isComplete(work) ? fmt.standings(work) : null
  const labelOf = id => { const t = data.teams.find(x => x.id === id); return t ? teamLabel(t) : '?' }

  return (
    <div className="public">
      <div className="public-top">
        <div className="brand">
          <div className="brand-mark" style={{ width: 36, height: 36, fontSize: 19 }}>🏸</div>
          <div>
            <div className="brand-title" style={{ fontSize: 17 }}>{state.name || '대회'}</div>
            <div className="brand-sub">실시간 관전 · 4초마다 자동 갱신</div>
          </div>
        </div>
      </div>

      {finalStandings && <Podium standings={finalStandings} labelOf={labelOf} />}

      <div className="public-controls">
        <input className="input" placeholder="내 이름 검색 → 내 경기 하이라이트"
          value={query} onChange={e => setQuery(e.target.value)} />
        <div className="row" style={{ gap: 8, flex: 'none' }}>
          <span className="muted small">크기</span>
          <input type="range" className="zoom-range" min="0.4" max="1.5" step="0.05"
            value={zoom} onChange={e => setZoom(Number(e.target.value))} />
        </div>
      </div>

      <div className="public-bracket" ref={bracketBoxRef}>
        {hasBracket
          ? <Bracket state={work} teams={data.teams} participants={data.participants}
              teamMode={teamMode} highlightTeamIds={highlightTeamIds} zoom={zoom} />
          : <div className="card muted">아직 대진표가 준비되지 않았습니다. 운영자가 준비 중이에요.</div>}
      </div>

      <ThemeToggle bottom />
    </div>
  )
}
