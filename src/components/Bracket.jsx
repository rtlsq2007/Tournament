import { useLayoutEffect, useRef, useState } from 'react'
import { useSwap } from './admin/useSwap.jsx'

// 우측 라이브 대진표. SVG 연결선(소스 기반). editable일 때 선수 드래그 스왑.
export default function Bracket({ state, teams, participants = [], highlightTeamIds = [], editable = false, swapPlayers }) {
  const wrapRef = useRef(null)
  const matchRefs = useRef(new Map())
  const [paths, setPaths] = useState([])
  const swap = useSwap({
    attr: 'data-pid',
    onSwap: swapPlayers || (() => {}),
    labelOf: id => participants.find(p => p.id === id)?.name || '?',
  })

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
  const teamNo = id => teams.findIndex(t => t.id === id) + 1
  const playerNames = team => team.playerIds.map(pid => participants.find(p => p.id === pid)?.name || '?')
  const scoreOf = (m, side) => {
    if (!m.games?.length) return ''
    const other = side === 'a' ? 'b' : 'a'
    if (m.games.length === 1) return m.games[0][side]
    return m.games.reduce((s, g) => s + (g[side] > g[other] ? 1 : 0), 0)
  }

  const Name = ({ pid, n }) => (
    <span className={`bteam-player ${editable ? 'bteam-drag' : ''} ${swap.dragId === pid ? 'dragging' : ''} ${swap.targetId === pid ? 'swap-target' : ''}`}
      {...(editable ? { 'data-pid': pid, onPointerDown: e => swap.begin(e, pid) } : {})}>{n}</span>
  )

  const Slot = ({ teamId, src, isWin, score }) => {
    const team = teamId ? teamById(teamId) : null
    const waiting = !teamId && src?.match
    const cls = `bteam ${team ? '' : 'empty'} ${isWin ? 'win' : ''} ${highlightTeamIds.includes(teamId) ? 'win' : ''}`
    if (!team) return <div className={cls}><span className="bteam-player muted">{waiting ? '승자 진출 대기' : ''}</span></div>
    const names = playerNames(team)
    return (
      <div className={cls}>
        {names.length > 1 ? (
          <div className="bteam-team">
            <div className="bteam-head">{team.label?.trim() || `${teamNo(teamId)}팀`}</div>
            <div className="bteam-names">{names.map((n, i) => <Name key={i} pid={team.playerIds[i]} n={n} />)}</div>
          </div>
        ) : (
          <span className="bteam-names"><Name pid={team.playerIds[0]} n={names[0]} /></span>
        )}
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
      {editable && swap.ghostEl}
    </div>
  )
}
