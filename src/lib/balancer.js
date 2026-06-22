let _seq = 0
const teamId = () => `t${++_seq}`

// 단식: 1인 1팀
function singlesTeams(players) {
  return players.map(p => ({ id: teamId(), label: p.name, playerIds: [p.id], tierSum: p.tier }))
}

// 복식 auto: 티어 정렬 후 양끝 페어링(고수+하수)
function doublesAuto(players) {
  const sorted = [...players].sort((a, b) => b.tier - a.tier)
  const teams = []
  let i = 0, j = sorted.length - 1
  while (i < j) {
    const x = sorted[i++], y = sorted[j--]
    teams.push({ id: teamId(), label: `${x.name}+${y.name}`, playerIds: [x.id, y.id], tierSum: x.tier + y.tier })
  }
  if (i === j) { // 홀수: 남은 1명 단독(부전 인원)
    const x = sorted[i]
    teams.push({ id: teamId(), label: x.name, playerIds: [x.id], tierSum: x.tier })
  }
  return teams
}

// 혼복 auto: 남/여 각각 티어 정렬 후 남고수+여하수 식으로 균형
function mixedAuto(players) {
  const men = players.filter(p => p.gender === 'M').sort((a, b) => b.tier - a.tier)
  const women = players.filter(p => p.gender === 'F').sort((a, b) => a.tier - b.tier)
  const n = Math.min(men.length, women.length)
  const teams = []
  for (let k = 0; k < n; k++) {
    const m = men[k], w = women[k]
    teams.push({ id: teamId(), label: `${m.name}+${w.name}`, playerIds: [m.id, w.id], tierSum: m.tier + w.tier })
  }
  return teams
}

export function pairTeams(players, { matchType, mode }) {
  // mode==='manual'은 화면에서 직접 팀을 구성하므로 여기서는 auto만 처리
  if (matchType === 'singles') return singlesTeams(players)
  if (matchType === 'mixed') return mixedAuto(players)
  return doublesAuto(players)
}

export function seedOrder(teams) {
  return [...teams].sort((a, b) => b.tierSum - a.tierSum)
}
