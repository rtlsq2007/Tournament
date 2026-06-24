// 경기 종료 시 최종 순위(1~4등)를 시각적으로 정리해 보여줌.
// standings: { champion, runnerUp, third, fourth, semiLosers } / labelOf(teamId) → 표시명
export default function Podium({ standings, labelOf, compact = false }) {
  if (!standings?.champion) return null
  const { champion, runnerUp, third, fourth, semiLosers } = standings

  const rows = [
    { rank: 1, medal: '🥇', cls: 'gold', label: '우승', team: champion },
    { rank: 2, medal: '🥈', cls: 'silver', label: '준우승', team: runnerUp },
  ]
  if (third) {
    rows.push({ rank: 3, medal: '🥉', cls: 'bronze', label: '3위', team: third })
    if (fourth) rows.push({ rank: 4, medal: '4️⃣', cls: 'fourth', label: '4위', team: fourth })
  } else if (semiLosers?.length) {
    // 3·4위전 미진행 → 준결승 패자 공동 3위
    semiLosers.forEach(t => rows.push({ rank: 3, medal: '🥉', cls: 'bronze', label: '공동 3위', team: t }))
  }

  return (
    <div className={`podium ${compact ? 'podium-compact' : ''}`}>
      <div className="podium-title">🏆 최종 순위</div>
      <div className="podium-list">
        {rows.filter(r => r.team).map((r, i) => (
          <div className={`podium-row ${r.cls}`} key={i}>
            <span className="podium-medal">{r.medal}</span>
            <span className="podium-rank">{r.label}</span>
            <span className="podium-name">{labelOf(r.team)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
