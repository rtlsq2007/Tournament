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

export function generate(teams, settings) {
  const seeded = seedOrder(teams)
  const size = nextPow2(seeded.length)
  const slots = seedSlots(size).map(seedNo => seeded[seedNo - 1] || null) // null = bye 자리

  const matches = []
  const rounds = []
  let mid = 0
  const newId = () => `m${++mid}`

  // 1라운드: 인접한 두 슬롯끼리
  let round1 = []
  for (let i = 0; i < size; i += 2) {
    const a = slots[i], b = slots[i + 1]
    const m = {
      id: newId(), round: 1, slot: i / 2, court: null,
      teamA: a ? a.id : null, teamB: b ? b.id : null,
      games: [], status: 'pending', winner: null,
    }
    if (m.teamA && !m.teamB) { m.status = 'done'; m.winner = m.teamA }
    else if (!m.teamA && m.teamB) { m.status = 'done'; m.winner = m.teamB }
    matches.push(m); round1.push(m.id)
  }
  rounds.push(round1)

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

  const state = { structure: { rounds }, matches }
  return propagate(state, settings) // bye 승자를 다음 라운드로 전진
}

// 결과로부터 다음 라운드 teamA/teamB를 다시 채움(멱등) — recompute의 핵심
export function propagate(state, settings = { bestOf: 1 }) {
  const { rounds } = state.structure
  const byId = id => state.matches.find(m => m.id === id)
  for (let r = 0; r < rounds.length - 1; r++) {
    for (let i = 0; i < rounds[r].length; i++) {
      const m = byId(rounds[r][i])
      const parent = byId(rounds[r + 1][Math.floor(i / 2)])
      const slotKey = i % 2 === 0 ? 'teamA' : 'teamB'
      m.winner = m.status === 'done' && m.teamA && m.teamB
        ? (matchWinner(m.games, settings.bestOf) === 'A' ? m.teamA : m.teamB)
        : (m.teamA && !m.teamB ? m.teamA : (!m.teamA && m.teamB ? m.teamB : m.winner))
      parent[slotKey] = m.winner || null
    }
  }
  return state
}

// 점수 입력/수정: 해당 경기 games·status 갱신 후 전체 재전파(되돌리기 포함)
export function applyResult(state, matchId, games, settings) {
  const next = structuredClone(state)
  const m = next.matches.find(x => x.id === matchId)
  if (!m) return next
  m.games = games
  const w = matchWinner(games, settings.bestOf)
  m.status = w ? 'done' : 'pending'
  return recompute(next, settings)
}

// 저장된 결과만으로 하류 대진 전부 재계산(멱등)
export function recompute(state, settings) {
  const next = structuredClone(state)
  for (const m of next.matches) {
    if (m.round > 1) { m.teamA = null; m.teamB = null; m.winner = null
      m.games = []; m.status = 'pending' }
  }
  return propagate(next, settings)
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

export default { generate, propagate, applyResult, recompute, isComplete, standings }
