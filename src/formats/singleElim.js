import { seedOrder } from '../lib/balancer.js'
import { matchWinner } from '../lib/match.js'

const largestPow2LE = n => { let p = 1; while (p * 2 <= n) p *= 2; return p }

// 표준 시드 배치 순서 (1·2번 시드가 결승에서 만나도록). 반환: 길이 size, 값 = 시드번호(1-based)
function seedSlots(size) {
  let arr = [1, 2]
  while (arr.length < size) {
    const sum = arr.length * 2 + 1
    const next = []
    for (const s of arr) { next.push(s); next.push(sum - s) }
    arr = next
  }
  return arr
}

const roundLabel = teamsInRound =>
  teamsInRound === 2 ? '결승' : teamsInRound === 4 ? '준결승' : `${teamsInRound}강`

// 경기 승자 id. 점수(games)가 있으면 점수로, 없으면 직접 지정(pick)으로, 한쪽만 있으면 부전승.
function winnerOf(m, settings) {
  if (!m) return null
  if (m.games?.length) {
    const w = matchWinner(m.games, settings.bestOf)
    return w === 'A' ? m.teamA : w === 'B' ? m.teamB : null
  }
  if (m.pick && m.teamA && m.teamB) return m.pick
  if (m.teamA && !m.teamB) return m.teamA
  if (!m.teamA && m.teamB) return m.teamB
  return null
}

const newMatch = (id, round, slot, srcA, srcB) => ({
  id, round, slot, court: null, srcA, srcB,
  teamA: null, teamB: null, games: [], pick: null, status: 'pending', winner: null,
})

// 싱글 엘리미네이션 대진 생성. 초과 인원은 "예선(play-in)"으로 처리해 부전승 칸이 생기지 않음.
export function generate(teams, settings = { bestOf: 1 }) {
  const seeded = seedOrder(teams)
  const N = seeded.length
  if (N < 2) return { structure: { rounds: [], labels: [] }, matches: [] }

  const P = largestPow2LE(N) // 본선 진입 팀 수 (round-of-P)
  const E = N - P            // 예선 경기 수
  const byeCount = P - E     // 예선 없이 본선 직행하는 상위 시드 수

  let mid = 0
  const newId = () => `m${++mid}`
  const matches = []
  const rounds = []
  const labels = []

  // 1) 예선 (초과 인원만)
  const prelimIds = []
  if (E > 0) {
    const prelimTeams = seeded.slice(byeCount) // 하위 2E팀
    for (let k = 0; k < E; k++) {
      const A = prelimTeams[k], B = prelimTeams[2 * E - 1 - k]
      const m = newMatch(newId(), 0, k, { team: A.id }, { team: B.id })
      matches.push(m); prelimIds.push(m.id)
    }
    rounds.push(prelimIds); labels.push('예선')
  }

  // 시드 → 본선 슬롯 소스 (상위=직행 팀, 하위=예선 승자)
  const entrantSrc = seed =>
    seed <= byeCount ? { team: seeded[seed - 1].id } : { match: prelimIds[seed - byeCount - 1] }

  // 2) 본선 1라운드 (round-of-P)
  const slots = seedSlots(P)
  const roP = []
  for (let i = 0; i < P; i += 2) {
    const m = newMatch(newId(), rounds.length, i / 2, entrantSrc(slots[i]), entrantSrc(slots[i + 1]))
    matches.push(m); roP.push(m.id)
  }
  rounds.push(roP); labels.push(roundLabel(P))

  // 3) 이후 라운드
  let prev = roP
  let count = P / 2
  while (count > 1) {
    count = count / 2
    const r = []
    for (let i = 0; i < count; i++) {
      const m = newMatch(newId(), rounds.length, i, { match: prev[i * 2] }, { match: prev[i * 2 + 1] })
      matches.push(m); r.push(m.id)
    }
    rounds.push(r); labels.push(roundLabel(count * 2))
    prev = r
  }

  return recompute({ structure: { rounds, labels }, matches }, settings)
}

// 저장된 결과(games/pick)로부터 전체 대진을 재유도(멱등).
// 매 경기 진출자를 소스로부터 다시 계산하고, 진출자가 바뀐 하류 경기의 낡은 결과만 무효화.
export function recompute(state, settings = { bestOf: 1 }) {
  const next = structuredClone(state)
  const byId = id => next.matches.find(m => m.id === id)
  const resolve = src => {
    if (!src) return null
    if (src.team) return src.team
    if (src.match) return winnerOf(byId(src.match), settings)
    return null
  }
  // matches는 라운드 순서(예선→본선→…)로 저장돼 있어 앞에서부터 확정하면 됨
  for (const m of next.matches) {
    const newA = resolve(m.srcA)
    const newB = resolve(m.srcB)
    if (m.teamA !== newA || m.teamB !== newB) { m.games = []; m.pick = null }
    m.teamA = newA; m.teamB = newB
    m.winner = winnerOf(m, settings)
    m.status = m.winner ? 'done' : 'pending'
  }
  return next
}

// 점수로 결과 입력 (점수가 우선, pick 해제)
export function applyResult(state, matchId, games, settings) {
  const next = structuredClone(state)
  const m = next.matches.find(x => x.id === matchId)
  if (!m) return next
  m.games = games; m.pick = null
  return recompute(next, settings)
}

// 점수 없이 승자만 지정
export function pickWinner(state, matchId, teamId, settings) {
  const next = structuredClone(state)
  const m = next.matches.find(x => x.id === matchId)
  if (!m) return next
  m.pick = teamId; m.games = []
  return recompute(next, settings)
}

export function isComplete(state) {
  const last = state.structure.rounds[state.structure.rounds.length - 1]
  if (!last?.length) return false
  const fm = state.matches.find(m => m.id === last[0])
  return fm.status === 'done' && !!fm.winner
}

export function standings(state) {
  const champion = isComplete(state)
    ? state.matches.find(m => m.id === state.structure.rounds.at(-1)[0]).winner
    : null
  return { champion }
}

export default { generate, recompute, applyResult, pickWinner, isComplete, standings }
