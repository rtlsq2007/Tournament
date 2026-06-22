const ROUND_NAME = (idx, total) => {
  const fromEnd = total - idx
  if (fromEnd === 1) return '결승전'
  if (fromEnd === 2) return '준결승'
  if (fromEnd === 3) return '8강'
  if (fromEnd === 4) return '16강'
  return `${idx + 1}라운드`
}

// 우측 라이브 대진표 (싱글 엘리미네이션). 읽기 전용 시각화.
export default function Bracket({ state, teams, highlightTeamIds = [] }) {
  if (!state?.structure?.rounds?.length) {
    return <div className="muted">참가자를 추가하면 대진표가 생성됩니다.</div>
  }
  const rounds = state.structure.rounds
  const byId = id => state.matches.find(m => m.id === id)
  const label = id => teams.find(t => t.id === id)?.label

  // 단판이면 점수, 다세트면 이긴 세트 수
  const scoreOf = (m, side) => {
    if (!m.games?.length) return ''
    const other = side === 'a' ? 'b' : 'a'
    if (m.games.length === 1) return m.games[0][side]
    return m.games.reduce((s, g) => s + (g[side] > g[other] ? 1 : 0), 0)
  }

  const Team = ({ id, isWin, score }) => (
    <div className={`bteam ${id ? '' : 'empty'} ${isWin ? 'win' : ''} ${highlightTeamIds.includes(id) ? 'win' : ''}`}>
      <span>{id ? label(id) : '–'}</span>
      {score !== '' && score != null && <span className="bscore">{score}</span>}
    </div>
  )

  return (
    <div className="bracket">
      {rounds.map((round, ri) => (
        <div className="bracket-round" key={ri}>
          <div className="round-label">{ROUND_NAME(ri, rounds.length)}</div>
          <div className="matches">
            {round.map(mid => {
              const m = byId(mid)
              return (
                <div className="bmatch" key={mid}>
                  <Team id={m.teamA} isWin={m.winner === m.teamA} score={scoreOf(m, 'a')} />
                  <Team id={m.teamB} isWin={m.winner === m.teamB} score={scoreOf(m, 'b')} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
