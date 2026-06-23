import { useLayoutEffect, useRef, useState } from 'react'
import { useSwap } from './admin/useSwap.jsx'

// 우측 라이브 대진표. SVG 연결선 + 우승 자리 + 확대/축소. editable이면 선수 드래그 스왑.
export default function Bracket({ state, teams, participants = [], highlightTeamIds = [], editable = false, swapPlayers, zoom = 1 }) {
  const wrapRef = useRef(null)
  const champRef = useRef(null)
  const matchRefs = useRef(new Map())
  const [paths, setPaths] = useState([])
  const swap = useSwap({
    attr: 'data-pid',
    onSwap: swapPlayers || (() => {}),
    labelOf: id => participants.find(p => p.id === id)?.name || '?',
  })

  const rounds = state?.structure?.rounds || []
  const labels = state?.structure?.labels || []
  const finalId = rounds.at(-1)?.[0]

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !state?.matches?.length) { setPaths([]); return }
    const wr = wrap.getBoundingClientRect()
    const rel = el => { const r = el.getBoundingClientRect(); return { l: r.left - wr.left, r: r.right - wr.left, m: r.top - wr.top + r.height / 2 } }
    const segs = []
    const elbow = (f, c) => `M ${f.r} ${f.m} H ${f.r + (c.l - f.r) / 2} V ${c.m} H ${c.l}`
    for (const m of state.matches) {
      const childEl = matchRefs.current.get(m.id)
      if (!childEl) continue
      const c = rel(childEl)
      for (const src of [m.srcA, m.srcB]) {
        const fEl = src?.match && matchRefs.current.get(src.match)
        if (fEl) segs.push(elbow(rel(fEl), c))
      }
    }
    // 결승 → 우승 연결
    if (champRef.current && finalId && matchRefs.current.get(finalId)) {
      segs.push(elbow(rel(matchRefs.current.get(finalId)), rel(champRef.current)))
    }
    setPaths(segs)
  }, [state, teams, participants, zoom])

  if (!rounds.length) {
    return <div className="muted">참가자를 추가하면 대진표가 생성됩니다.</div>
  }

  const byId = id => state.matches.find(m => m.id === id)
  const teamById = id => teams.find(t => t.id === id)
  const teamName = team => team.label?.trim() || `${team.no}팀`
  const pName = pid => participants.find(p => p.id === pid)?.name || '?'
  const pTier = pid => participants.find(p => p.id === pid)?.tier
  const playerNames = team => team.playerIds.map(pName)
  const scoreOf = (m, side) => {
    if (!m.games?.length) return ''
    const other = side === 'a' ? 'b' : 'a'
    if (m.games.length === 1) return m.games[0][side]
    return m.games.reduce((s, g) => s + (g[side] > g[other] ? 1 : 0), 0)
  }

  const dragProps = pid => editable ? { 'data-pid': pid, onPointerDown: e => swap.begin(e, pid) } : {}
  const playerCls = pid => `${editable ? 'bdrag' : ''} ${swap.dragId === pid ? 'dragging' : ''} ${swap.targetId === pid ? 'swap-target' : ''}`

  const Slot = ({ teamId, src, isWin, score }) => {
    const team = teamId ? teamById(teamId) : null
    const waiting = !teamId && src?.match
    const hi = highlightTeamIds.includes(teamId)
    if (!team) return <div className={`bteam empty ${isWin ? 'win' : ''}`}><span className="bteam-player muted">{waiting ? '승자 진출 대기' : ''}</span></div>
    const names = playerNames(team)
    const ids = team.playerIds
    if (names.length > 1) {
      return (
        <div className={`bteam doubles ${isWin ? 'win' : ''} ${hi ? 'win' : ''}`}>
          <div className="bteam-head-row">
            <span className="bteam-head">{teamName(team)}</span>
            {score !== '' && score != null && <span className="bscore">{score}</span>}
          </div>
          {names.map((n, i) => (
            <div key={i} className={`bplayer ${playerCls(ids[i])}`} {...dragProps(ids[i])}>
              <span className="bp-name">{n}</span>
              {pTier(ids[i]) ? <span className="bp-tier">★{pTier(ids[i])}</span> : null}
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className={`bteam ${isWin ? 'win' : ''} ${hi ? 'win' : ''} ${playerCls(ids[0])}`} {...dragProps(ids[0])}>
        <span className="bteam-player">{names[0]}</span>
        {score !== '' && score != null && <span className="bscore">{score}</span>}
      </div>
    )
  }

  const champTeam = finalId ? teamById(byId(finalId).winner) : null

  return (
    <div className="bracket-wrap" ref={wrapRef}>
      <svg className="bracket-svg">
        {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--border-strong)" strokeWidth="2" />)}
      </svg>
      <div className="bracket" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
        {rounds.map((round, ri) => (
          <div className="bracket-round" key={ri}>
            <div className="round-label">{labels[ri] || `${round.length * 2}강`}</div>
            <div className="matches">
              {round.map(mid => {
                const m = byId(mid)
                return (
                  <div className="bmatch" key={mid} ref={el => { el ? matchRefs.current.set(mid, el) : matchRefs.current.delete(mid) }}>
                    <Slot teamId={m.teamA} src={m.srcA} isWin={m.winner === m.teamA} score={scoreOf(m, 'a')} />
                    <Slot teamId={m.teamB} src={m.srcB} isWin={m.winner === m.teamB} score={scoreOf(m, 'b')} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {/* 우승 자리 */}
        <div className="bracket-round">
          <div className="round-label">🏆 우승</div>
          <div className="matches">
            <div className="bmatch" ref={champRef}>
              <div className={`champ-box ${champTeam ? '' : 'waiting'}`}>
                {champTeam ? (champTeam.playerIds.length > 1 ? teamName(champTeam) : playerNames(champTeam)[0]) : '대기'}
              </div>
            </div>
          </div>
        </div>
      </div>
      {editable && swap.ghostEl}
    </div>
  )
}
