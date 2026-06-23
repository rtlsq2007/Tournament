let _seq = 0
const teamId = () => `t${++_seq}`
const team = (playerIds, tierSum) => ({ id: teamId(), label: '', playerIds, tierSum })

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 단식: 1인 1팀
const singlesTeams = players => players.map(p => team([p.id], p.tier))

// 복식: 주어진 순서대로 2명씩 (홀수면 마지막 1명 단독)
function doublesFrom(players) {
  const teams = []
  for (let i = 0; i < players.length; i += 2) {
    const x = players[i], y = players[i + 1]
    teams.push(y ? team([x.id, y.id], x.tier + y.tier) : team([x.id], x.tier))
  }
  return teams
}

// 복식 auto: 티어 정렬 후 양끝 페어링(고수+하수)
function doublesAuto(players) {
  const sorted = [...players].sort((a, b) => b.tier - a.tier)
  const ordered = []
  let i = 0, j = sorted.length - 1
  while (i < j) { ordered.push(sorted[i++], sorted[j--]) }
  if (i === j) ordered.push(sorted[i])
  return doublesFrom(ordered)
}

// 혼복: 남/여 리스트를 순서대로 짝지음
function mixedFrom(men, women) {
  const n = Math.min(men.length, women.length)
  const teams = []
  for (let k = 0; k < n; k++) teams.push(team([men[k].id, women[k].id], men[k].tier + women[k].tier))
  return teams
}

// 혼복 auto: 남(고수순)+여(하수순) 균형
function mixedAuto(players) {
  const men = players.filter(p => p.gender === 'M').sort((a, b) => b.tier - a.tier)
  const women = players.filter(p => p.gender === 'F').sort((a, b) => a.tier - b.tier)
  return mixedFrom(men, women)
}

export function pairTeams(players, { matchType, mode }) {
  if (mode === 'random') {
    if (matchType === 'singles') return singlesTeams(shuffled(players))
    if (matchType === 'mixed') return mixedFrom(shuffled(players.filter(p => p.gender === 'M')), shuffled(players.filter(p => p.gender === 'F')))
    return doublesFrom(shuffled(players))
  }
  if (matchType === 'singles') return singlesTeams(players)
  if (matchType === 'mixed') return mixedAuto(players)
  return doublesAuto(players)
}

export function seedOrder(teams) {
  return [...teams].sort((a, b) => b.tierSum - a.tierSum)
}
