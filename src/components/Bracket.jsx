import { useLayoutEffect, useRef, useState } from 'react'

// 라운드 라벨: 그 라운드에 입장하는 팀 수 기준 (8강/준결승/결승 ...)
const roundName = teamsInRound => {
  if (teamsInRound === 2) return '결승'
  if (teamsInRound === 4) return '준결승'
  return `${teamsInRound}강`
}

// 우측 라이브 대진표 (싱글 엘리미네이션). 읽기 전용 + SVG 연결선.
export default function Bracket({ state, teams, highlightTeamIds = [] }) {
  const wrapRef = useRef(null)
  const matchRefs = useRef(new Map())
  const [paths, setPaths] = useState([])

  const rounds = state?.structure?.rounds || []

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || rounds.length < 2) { setPaths([]); return }
    const wr = wrap.getBoundingClientRect()
    const segs = []
    for (let r = 1; r < rounds.length; r++) {
      rounds[r].forEach((mid, i) => {
        const childEl = matchRefs.current.get(mid)
        if (!childEl) return
        const cr = childEl.getBoundingClientRect()
        const cx = cr.left - wr.left
        const cy = cr.top - wr.top + cr.height / 2
        ;[rounds[r - 1][i * 2], rounds[r - 1][i * 2 + 1]].forEach(fid => {
          const fEl = matchRefs.current.get(fid)
          if (!fEl) return
          const fr = fEl.getBoundingClientRect()
          const fx = fr.right - wr.left
          const fy = fr.top - wr.top + fr.height / 2
          const midX = fx + (cx - fx) / 2
          segs.push(`M ${fx} ${fy} H ${midX} V ${cy} H ${cx}`)
        })
      })
    }
    setPaths(segs)
  }, [state, teams])

  if (!rounds.length) {
    return <div className="muted">참가자를 추가하면 대진표가 생성됩니다.</div>
  }

  const byId = id => state.matches.find(m => m.id === id)
  const label = id => teams.find(t => t.id === id)?.label
  const scoreOf = (m, side) => {
    if (!m.games?.length) return ''
    const other = side === 'a' ? 'b' : 'a'
    if (m.games.length === 1) return m.games[0][side]
    return m.games.reduce((s, g) => s + (g[side] > g[other] ? 1 : 0), 0)
  }

  const Team = ({ id, isWin, score, isBye }) => (
    <div className={`bteam ${id ? '' : 'empty'} ${isWin ? 'win' : ''} ${isBye ? 'bye' : ''} ${highlightTeamIds.includes(id) ? 'win' : ''}`}>
      <span>{id ? label(id) : (isBye ? '부전승' : '–')}</span>
      {score !== '' && score != null && <span className="bscore">{score}</span>}
    </div>
  )

  return (
    <div className="bracket-wrap" ref={wrapRef}>
      <svg className="bracket-svg">
        {paths.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--border-strong)" strokeWidth="2" />
        ))}
      </svg>
      <div className="bracket">
        {rounds.map((round, ri) => (
          <div className="bracket-round" key={ri}>
            <div className="round-label">{roundName(round.length * 2)}</div>
            <div className="matches">
              {round.map(mid => {
                const m = byId(mid)
                const oneSide = (!!m.teamA) !== (!!m.teamB)
                return (
                  <div className="bmatch" key={mid} ref={el => { el ? matchRefs.current.set(mid, el) : matchRefs.current.delete(mid) }}>
                    <Team id={m.teamA} isWin={m.winner === m.teamA} score={scoreOf(m, 'a')} isBye={oneSide && !m.teamA} />
                    <Team id={m.teamB} isWin={m.winner === m.teamB} score={scoreOf(m, 'b')} isBye={oneSide && !m.teamB} />
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
