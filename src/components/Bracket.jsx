import { useLayoutEffect, useRef, useState } from 'react'
import { useSwap } from './admin/useSwap.jsx'

// 우측 라이브 대진표. SVG 연결선 + 우승 자리 + 확대/축소. editable이면 선수 드래그 스왑.
// 16강 이상(라운드 4개+)이면 좌우 양방향(가운데 결승) 레이아웃.
export default function Bracket({ state, teams, participants = [], highlightTeamIds = [], editable = false, swapPlayers, deletePlayer, zoom = 1, teamMode = false }) {
  const wrapRef = useRef(null)
  const champRef = useRef(null)
  const matchRefs = useRef(new Map())
  const [paths, setPaths] = useState([])
  const swap = useSwap({
    attr: 'data-pid',
    onSwap: swapPlayers || (() => {}),
    onDelete: deletePlayer,
    labelOf: id => participants.find(p => p.id === id)?.name || '?',
  })

  const rounds = state?.structure?.rounds || []
  const labels = state?.structure?.labels || []
  const R = rounds.length
  const twoSided = R >= 4
  const finalId = rounds.at(-1)?.[0]

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || !state?.matches?.length) { setPaths([]); return }
    const wr = wrap.getBoundingClientRect()
    const rel = el => {
      const r = el.getBoundingClientRect()
      return { l: r.left - wr.left, r: r.right - wr.left, m: r.top - wr.top + r.height / 2, cx: (r.left + r.right) / 2 - wr.left, t: r.top - wr.top, b: r.bottom - wr.top }
    }
    // 자식이 오른쪽이면 오른쪽 엘보, 왼쪽이면 왼쪽 엘보 (양방향 대응)
    const connect = (f, c) => {
      if (c.l >= f.r - 1) { const mid = f.r + (c.l - f.r) / 2; return `M ${f.r} ${f.m} H ${mid} V ${c.m} H ${c.l}` }
      if (c.r <= f.l + 1) { const mid = c.r + (f.l - c.r) / 2; return `M ${f.l} ${f.m} H ${mid} V ${c.m} H ${c.r}` }
      return `M ${f.r} ${f.m} L ${c.l} ${c.m}`
    }
    const segs = []
    for (const m of state.matches) {
      const childEl = matchRefs.current.get(m.id)
      if (!childEl) continue
      const c = rel(childEl)
      for (const src of [m.srcA, m.srcB]) {
        const fEl = src?.match && matchRefs.current.get(src.match)
        if (fEl) segs.push(connect(rel(fEl), c))
      }
    }
    // 결승 → 우승 연결
    const fId = rounds.at(-1)?.[0]
    if (champRef.current && fId && matchRefs.current.get(fId)) {
      const f = rel(matchRefs.current.get(fId)), c = rel(champRef.current)
      segs.push(twoSided
        ? `M ${f.cx} ${f.b} V ${f.b + (c.t - f.b) / 2} H ${c.cx} V ${c.t}` // 가운데: 결승 아래로
        : connect(f, c))
    }
    setPaths(segs)
  }, [state, teams, participants, zoom, twoSided])

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
    const waiting = !teamId && (src?.match || src?.loserOf) // 3·4위전은 loserOf로 진출
    const hi = highlightTeamIds.includes(teamId)
    if (!team) {
      if (!waiting) return null // 상대 없는 빈 자리는 표시하지 않음
      return <div className={`bteam empty ${isWin ? 'win' : ''}`}><span className="bteam-player muted">승자 진출 대기</span></div>
    }
    const names = playerNames(team)
    const ids = team.playerIds
    if (teamMode) {
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
          {names.length < 2 && <div className="bplayer empty-slot">빈 자리</div>}
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

  const refFn = mid => el => { el ? matchRefs.current.set(mid, el) : matchRefs.current.delete(mid) }
  const matchBox = (mid, label) => {
    const m = byId(mid)
    return (
      <div className="bmatch" key={mid} ref={refFn(mid)}>
        {label && <div className="round-label round-label-float">{label}</div>}
        <Slot teamId={m.teamA} src={m.srcA} isWin={m.winner === m.teamA} score={scoreOf(m, 'a')} />
        <Slot teamId={m.teamB} src={m.srcB} isWin={m.winner === m.teamB} score={scoreOf(m, 'b')} />
      </div>
    )
  }
  const column = (label, ids, key) => (
    <div className="bracket-round" key={key}>
      <div className="matches">{ids.map((mid, mi) => matchBox(mid, mi === 0 ? label : null))}</div>
    </div>
  )

  // 3·4위전(동메달 결정전) — 있으면 우승 자리 옆/아래에 함께 표시
  const thirdId = state?.structure?.thirdPlace
  const thirdBox = thirdId && byId(thirdId) ? matchBox(thirdId, '🥉 3·4위전') : null

  const champTeam = finalId ? teamById(byId(finalId).winner) : null
  const champBox = (
    <div className="bmatch" key="champ" ref={champRef}>
      <div className="round-label round-label-float">🏆 우승</div>
      <div className={`champ-box ${champTeam ? '' : 'waiting'}`}>
        {champTeam ? (teamMode ? teamName(champTeam) : playerNames(champTeam)[0]) : '대기'}
      </div>
    </div>
  )

  let body
  if (!twoSided) {
    body = (
      <>
        {rounds.map((round, ri) => column(labels[ri] || `${round.length * 2}강`, round, 'r' + ri))}
        <div className="bracket-round" key="champcol"><div className="matches">{champBox}{thirdBox}</div></div>
      </>
    )
  } else {
    // 각 라운드를 좌/우 절반으로 분할 (결승의 두 피더 기준). 결승+우승은 가운데.
    const isLeft = (r, i) => (i >> (R - 2 - r)) === 0
    const leftCols = [], rightCols = []
    for (let r = 0; r <= R - 2; r++) {
      leftCols.push([labels[r], rounds[r].filter((_, i) => isLeft(r, i))])
      rightCols.push([labels[r], rounds[r].filter((_, i) => !isLeft(r, i))])
    }
    body = (
      <>
        {leftCols.map(([lab, ids], i) => column(lab, ids, 'L' + i))}
        <div className="bracket-round center-col" key="center">
          <div className="matches">
            {matchBox(finalId, labels[R - 1])}
            {champBox}
            {thirdBox}
          </div>
        </div>
        {rightCols.slice().reverse().map(([lab, ids], i) => column(lab, ids, 'R' + i))}
      </>
    )
  }

  return (
    <div className="bracket-wrap" ref={wrapRef}>
      <svg className="bracket-svg">
        {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--border-strong)" strokeWidth="2" />)}
      </svg>
      <div className="bracket" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
        {body}
      </div>
      {editable && swap.ghostEl}
      {editable && swap.trashEl}
    </div>
  )
}
