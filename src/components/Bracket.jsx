import { useLayoutEffect, useRef, useState } from 'react'

// 팀 표시: 커스텀 이름이 있으면 이름, 없으면 소속 선수명들(쌓아서)
function teamLines(team, participants) {
  if (!team) return null
  if (team.label && team.label.trim()) return [team.label.trim()]
  return team.playerIds.map(pid => participants.find(p => p.id === pid)?.name || '?')
}

// 우측 라이브 대진표. 읽기 전용 + SVG 연결선(소스 기반).
export default function Bracket({ state, teams, participants = [], highlightTeamIds = [] }) {
  const wrapRef = useRef(null)
  const matchRefs = useRef(new Map())
  const [paths, setPaths] = useState([])

  const rounds = state?.structure?.rounds || []
  const labels = state?.structure?.labels || []

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !state?.matches?.length) { setPaths([]); return }
    const wr = wrap.getBoundingClientRect()
    const segs = []
    for (const m of state.matches) {
      const childEl = matchRefs.current.get(m.id)
      if (!childEl) continue
      const cr = childEl.getBoundingClientRect()
      const cx = cr.left - wr.left
      const cy = cr.top - wr.top + cr.height / 2
      for (const src of [m.srcA, m.srcB]) {
        if (!src?.match) continue
        const fEl = matchRefs.current.get(src.match)
        if (!fEl) continue
        const fr = fEl.getBoundingClientRect()
        const fx = fr.right - wr.left
        const fy = fr.top - wr.top + fr.height / 2
        const midX = fx + (cx - fx) / 2
        segs.push(`M ${fx} ${fy} H ${midX} V ${cy} H ${cx}`)
      }
    }
    setPaths(segs)
  }, [state, teams, participants])

  if (!rounds.length) {
    return <div className="muted">참가자를 추가하면 대진표가 생성됩니다.</div>
  }

  const byId = id => state.matches.find(m => m.id === id)
  const teamById = id => teams.find(t => t.id === id)
  const scoreOf = (m, side) => {
    if (!m.games?.length) return ''
    const other = side === 'a' ? 'b' : 'a'
    if (m.games.length === 1) return m.games[0][side]
    return m.games.reduce((s, g) => s + (g[side] > g[other] ? 1 : 0), 0)
  }

  const Slot = ({ teamId, src, isWin, score }) => {
    const team = teamId ? teamById(teamId) : null
    const lines = teamLines(team, participants)
    const waiting = !teamId && src?.match
    return (
      <div className={`bteam ${team ? '' : 'empty'} ${isWin ? 'win' : ''} ${highlightTeamIds.includes(teamId) ? 'win' : ''}`}>
        <span className="bteam-names">
          {lines ? lines.map((n, i) => <span key={i} className="bteam-player">{n}</span>)
            : <span className="bteam-player muted">{waiting ? '승자 진출 대기' : '–'}</span>}
        </span>
        {score !== '' && score != null && <span className="bscore">{score}</span>}
      </div>
    )
  }

  return (
    <div className="bracket-wrap" ref={wrapRef}>
      <svg className="bracket-svg">
        {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--border-strong)" strokeWidth="2" />)}
      </svg>
      <div className="bracket">
        {rounds.map((round, ri) => (
          <div className="bracket-round" key={ri}>
            <div className="round-label">{labels[ri] || `${round.length * 2}강`}</div>
            <div className="matches">
              {round.map(mid => {
                const m = byId(mid)
                return (
                  <div className="bmatch" key={mid}
                    ref={el => { el ? matchRefs.current.set(mid, el) : matchRefs.current.delete(mid) }}>
                    <Slot teamId={m.teamA} src={m.srcA} isWin={m.winner === m.teamA} score={scoreOf(m, 'a')} />
                    <Slot teamId={m.teamB} src={m.srcB} isWin={m.winner === m.teamB} score={scoreOf(m, 'b')} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
