import { seedOrder } from '../lib/balancer.js'
import { matchWinner } from '../lib/match.js'

const nextPow2 = n => { let p = 1; while (p < n) p *= 2; return p }

// 표준 시드 배치 순서(1번시드와 2번시드가 결승에서 만나도록)
function seedSlots(size) {
  let rounds = [[1, 2]]
  while (rounds[0].length < size) {
    const prev = rounds[0]
    const sum = prev.length * 2 + 1
    const next = []
    for (const s of prev) { next.push(s); next.push(sum - s) }
    rounds = [next]
  }
  return rounds[0] // 길이 size, 값은 시드번호(1-based)
}

// 한 경기의 승자 id. 부전승(한쪽만 존재) 또는 점수로 결정. 미결정이면 null
function winnerOf(m, settings) {
  if (!m) return null
  if (m.teamA && !m.teamB) return m.teamA
  if (!m.teamA && m.teamB) return m.teamB
  if (m.teamA && m.teamB && m.games.length) {
    const w = matchWinner(m.games, settings.bestOf)
    return w === 'A' ? m.teamA : w === 'B' ? m.teamB : null
  }
  return null
}

export function generate(teams, settings) {
  const seeded = seedOrder(teams)
  const size = nextPow2(seeded.length)
  const slots = seedSlots(size).map(seedNo => seeded[seedNo - 1] || null) // null = bye 자리

  const matches = []
  const rounds = []
  let mid = 0
  const newId = () => `m${++mid}`

  // 1라운드: 인접한 두 슬롯끼리 (부전승 처리는 recompute가 일괄 수행)
  let round1 = []
  for (let i = 0; i < size; i += 2) {
    const a = slots[i], b = slots[i + 1]
    const m = {
      id: newId(), round: 1, slot: i / 2, court: null,
      teamA: a ? a.id : null, teamB: b ? b.id : null,
      games: [], status: 'pending', winner: null,
    }
    matches.push(m); round1.push(m.id)
  }
  rounds.push(round1)

  // 이후 라운드: 빈 경기 칸 미리 생성(teamA/B는 recompute가 진출자로 채움)
  let count = size / 2
  while (count > 1) {
    count = count / 2
    const r = []
    for (let i = 0; i < count; i++) {
      const m = { id: newId(), round: rounds.length + 1, slot: i, court: null,
        teamA: null, teamB: null, games: [], status: 'pending', winner: null }
      matches.push(m); r.push(m.id)
    }
    rounds.push(r)
  }

  return recompute({ structure: { rounds }, matches }, settings)
}

// 저장된 경기 점수만으로 전체 브라켓을 재유도(멱등).
// 진출자가 실제로 바뀐 하류 경기의 "낡은" 점수만 무효화하므로,
// 무관한 초기 경기 점수 수정이 하류 결과를 날리지 않는다. (수정·되돌리기 안전)
export function recompute(state, settings = { bestOf: 1 }) {
  const next = structuredClone(state)
  const { rounds } = next.structure
  const byId = id => next.matches.find(m => m.id === id)

  for (let r = 0; r < rounds.length; r++) {
    for (let i = 0; i < rounds[r].length; i++) {
      const m = byId(rounds[r][i])
      if (r > 0) {
        // 진출자 = 직전 라운드 두 경기의 승자
        const newA = winnerOf(byId(rounds[r - 1][i * 2]), settings)
        const newB = winnerOf(byId(rounds[r - 1][i * 2 + 1]), settings)
        // 진출자가 바뀌었으면 이 경기의 기존 점수는 무효
        if (m.teamA !== newA || m.teamB !== newB) { m.games = []; m.status = 'pending' }
        m.teamA = newA; m.teamB = newB
      }
      const w = winnerOf(m, settings)
      m.winner = w
      m.status = w ? 'done' : 'pending'
    }
  }
  return next
}

// 점수 입력/수정: 해당 경기 games 갱신 후 전체 재유도(되돌리기 포함)
export function applyResult(state, matchId, games, settings) {
  const next = structuredClone(state)
  const m = next.matches.find(x => x.id === matchId)
  if (!m) return next
  m.games = games
  return recompute(next, settings)
}

export function isComplete(state) {
  const last = state.structure.rounds[state.structure.rounds.length - 1]
  const finalMatch = state.matches.find(m => m.id === last[0])
  return finalMatch.status === 'done' && !!finalMatch.winner
}

export function standings(state) {
  const champion = isComplete(state)
    ? state.matches.find(m => m.id === state.structure.rounds.at(-1)[0]).winner
    : null
  return { champion }
}

export default { generate, recompute, applyResult, isComplete, standings }
