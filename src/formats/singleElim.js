import { matchWinner } from '../lib/match.js'

// 경기 승자 id. 점수가 있으면 점수로, 없으면 직접 지정(pick)으로. 자동 부전승 없음.
// 매치별 bestOf override(m.bestOf, 결승 세트수 조정용)가 있으면 그걸 우선.
function winnerOf(m, settings) {
  if (!m) return null
  if (m.games?.length) {
    const w = matchWinner(m.games, m.bestOf || settings.bestOf)
    return w === 'A' ? m.teamA : w === 'B' ? m.teamB : null
  }
  if (m.pick) return m.pick
  return null
}

// 경기 패자 id (승자가 정해졌고 두 팀이 모두 있을 때만). 3·4위전 진출에 사용.
function loserOf(m) {
  if (!m || !m.winner || !m.teamA || !m.teamB) return null
  return m.winner === m.teamA ? m.teamB : m.teamA
}

const newMatch = (id, round, slot, srcA, srcB) => ({
  id, round, slot, srcA, srcB,
  teamA: null, teamB: null, games: [], pick: null, status: 'pending', winner: null,
})

// 라운드 라벨: 결승부터 거꾸로 (결승/준결승/8강/16강 …)
function buildLabels(roundCount) {
  return Array.from({ length: roundCount }, (_, ri) => {
    const fromEnd = roundCount - ri
    if (fromEnd === 1) return '결승'
    if (fromEnd === 2) return '준결승'
    return `${2 ** fromEnd}강`
  })
}

// 싱글 엘리미네이션 대진 생성 (순차 페어링).
// 팀을 순서대로 2개씩 묶고, 홀수면 마지막 경기의 상대 칸은 비워둠(부전승 자동 진출 없음).
export function generate(teams, settings = { bestOf: 1 }) {
  const N = teams.length
  if (N < 1) return { structure: { rounds: [], labels: [] }, matches: [] }

  let mid = 0
  const newId = () => `m${++mid}`
  const matches = []
  const rounds = []

  // 1라운드
  const r0 = []
  for (let i = 0; i < N; i += 2) {
    const A = teams[i], B = teams[i + 1] || null
    const m = newMatch(newId(), 0, i / 2, { team: A.id }, B ? { team: B.id } : null)
    matches.push(m); r0.push(m.id)
  }
  rounds.push(r0)

  // 이후 라운드 (경기 수가 1이 될 때까지)
  let prev = r0
  while (prev.length > 1) {
    const r = []
    for (let i = 0; i < prev.length; i += 2) {
      const fa = prev[i], fb = prev[i + 1] || null
      const m = newMatch(newId(), rounds.length, i / 2, { match: fa }, fb ? { match: fb } : null)
      matches.push(m); r.push(m.id)
    }
    rounds.push(r); prev = r
  }

  const labels = buildLabels(rounds.length)
  const structure = { rounds, labels }

  // 3·4위전(동메달 결정전): 준결승 두 패자가 맞붙는 별도 경기. rounds엔 넣지 않고 별도 참조.
  if (settings.thirdPlace && rounds.length >= 2) {
    const finalMatch = matches.find(m => m.id === rounds.at(-1)[0])
    const sa = finalMatch?.srcA?.match, sb = finalMatch?.srcB?.match
    if (sa && sb) {
      const tp = newMatch(newId(), rounds.length - 1, 0, { loserOf: sa }, { loserOf: sb })
      matches.push(tp)
      structure.thirdPlace = tp.id
    }
  }

  return recompute({ structure, matches }, settings)
}

// 저장된 결과(games/pick)로부터 전체 대진을 재유도(멱등).
export function recompute(state, settings = { bestOf: 1 }) {
  const next = structuredClone(state)
  const byId = id => next.matches.find(m => m.id === id)
  const resolve = src => {
    if (!src) return null
    if (src.team) return src.team
    if (src.match) return winnerOf(byId(src.match), settings)
    if (src.loserOf) return loserOf(byId(src.loserOf)) // 3·4위전: 준결승 패자
    return null
  }
  for (const m of next.matches) { // matches는 라운드 순서로 저장됨
    const newA = resolve(m.srcA)
    const newB = resolve(m.srcB)
    if (m.teamA !== newA || m.teamB !== newB) { m.games = []; m.pick = null }
    m.teamA = newA; m.teamB = newB
    m.winner = winnerOf(m, settings)
    m.status = m.winner ? 'done' : 'pending'
  }
  return next
}

// 점수로 결과 입력 (점수가 승자를 결정, pick 해제)
export function applyResult(state, matchId, games, settings) {
  const next = structuredClone(state)
  const m = next.matches.find(x => x.id === matchId)
  if (!m) return next
  m.games = games; m.pick = null
  return recompute(next, settings)
}

// 매치별 세트수(bestOf) 조정 — 결승만 다른 판수로 진행할 때. 홀수 1~9.
export function setMatchBestOf(state, matchId, bestOf, settings) {
  const next = structuredClone(state)
  const m = next.matches.find(x => x.id === matchId)
  if (m) m.bestOf = bestOf
  return recompute(next, settings)
}

// 점수 없이 승자만 지정 (부전승 진출 포함). 단, 이미 점수가 있으면 점수를 보존.
export function pickWinner(state, matchId, teamId, settings) {
  const next = structuredClone(state)
  const m = next.matches.find(x => x.id === matchId)
  if (!m) return next
  if (m.games?.length) return next // 점수가 우선 — 지우지 않음
  m.pick = teamId
  return recompute(next, settings)
}

export function isComplete(state) {
  const last = state.structure.rounds[state.structure.rounds.length - 1]
  if (!last?.length) return false
  const fm = state.matches.find(m => m.id === last[0])
  return fm.status === 'done' && !!fm.winner
}

export function standings(state) {
  const byId = id => state.matches.find(m => m.id === id)
  const rounds = state.structure.rounds
  const fm = rounds.length ? byId(rounds.at(-1)[0]) : null
  const complete = isComplete(state)
  const champion = complete ? fm.winner : null
  // 준우승: 결승 패자
  const runnerUp = complete && fm.teamA && fm.teamB ? (fm.winner === fm.teamA ? fm.teamB : fm.teamA) : null
  // 3·4위전이 있으면 승자=3위, 패자=4위
  const tp = state.structure.thirdPlace ? byId(state.structure.thirdPlace) : null
  const third = tp?.winner || null
  const fourth = tp?.winner && tp.teamA && tp.teamB ? (tp.winner === tp.teamA ? tp.teamB : tp.teamA) : null
  // 3·4위전이 없으면 준결승 두 패자가 공동 3위
  let semiLosers = []
  if (!tp && complete && rounds.length >= 2) {
    semiLosers = rounds[rounds.length - 2]
      .map(id => byId(id)).map(m => (m?.winner && m.teamA && m.teamB) ? (m.winner === m.teamA ? m.teamB : m.teamA) : null)
      .filter(Boolean)
  }
  return { champion, runnerUp, third, fourth, semiLosers }
}

export default { generate, recompute, applyResult, pickWinner, setMatchBestOf, isComplete, standings }
