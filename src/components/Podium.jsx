// 경기 종료 시 최종 순위를 올림픽 시상대 형태로 보여줌(은-금-동, 가운데가 우승).
// standings: { champion, runnerUp, third, fourth, semiLosers } / labelOf(teamId) → 표시명
export default function Podium({ standings, labelOf, compact = false }) {
  if (!standings?.champion) return null
  const { champion, runnerUp, third, fourth, semiLosers, thirdPlaceEnabled } = standings

  const thirdTeams = third ? [third] : (semiLosers || [])
  const joint = !third && thirdTeams.length > 1 // 3·4위전 미진행 → 공동 3위
  // 패자전(3·4위전) 미체크 시 우승만 표시. 체크 시 2위·1위·3위 시상대(+4위).
  const cols = (thirdPlaceEnabled ? [
    { rank: 2, medal: '🥈', cls: 'silver', h: 'h2', teams: runnerUp ? [runnerUp] : [] },
    { rank: 1, medal: '🥇', cls: 'gold', h: 'h1', teams: [champion] },
    { rank: 3, medal: '🥉', cls: 'bronze', h: 'h3', teams: thirdTeams },
  ] : [
    { rank: 1, medal: '🥇', cls: 'gold', h: 'h1', teams: [champion] },
  ]).filter(c => c.teams.length)

  return (
    <div className={`podium ${compact ? 'podium-compact' : ''}`}>
      <div className="podium-title">{thirdPlaceEnabled ? '🏆 최종 순위' : '🏆 우승'}</div>
      <div className="podium-stage">
        {cols.map(c => (
          <div className="pod-col" key={c.rank}>
            <div className="pod-cap">
              <div className="pod-medal">{c.medal}</div>
              <div className="pod-names">
                {c.teams.map((t, i) => <div className="pod-name" key={i} title={labelOf(t)}>{labelOf(t)}</div>)}
              </div>
            </div>
            <div className={`pod-bar ${c.cls} ${c.h}`}>
              <span className="pod-rank-label">{joint && c.rank === 3 ? '공동 3위' : `${c.rank}위`}</span>
            </div>
          </div>
        ))}
      </div>
      {fourth && <div className="pod-extra">4위 · <strong>{labelOf(fourth)}</strong></div>}
    </div>
  )
}
