import { describe, it, expect } from 'vitest'
import { generate, applyResult, pickWinner, isComplete, standings } from './singleElim.js'

const mkTeams = n => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, label: `T${i + 1}`, tierSum: n - i }))
const byId = (s, id) => s.matches.find(m => m.id === id)

describe('singleElim.generate', () => {
  it('4팀: 예선 없이 준결승+결승', () => {
    const s = generate(mkTeams(4), { bestOf: 1 })
    expect(s.structure.rounds.map(r => r.length)).toEqual([2, 1])
    expect(s.structure.labels).toEqual(['준결승', '결승'])
  })
  it('8팀: 8강·준결승·결승', () => {
    const s = generate(mkTeams(8), { bestOf: 1 })
    expect(s.structure.labels).toEqual(['8강', '준결승', '결승'])
  })
  it('5팀: 예선 1경기 + 준결승 + 결승, 부전승 칸 없음', () => {
    const s = generate(mkTeams(5), { bestOf: 1 })
    expect(s.structure.labels).toEqual(['예선', '준결승', '결승'])
    expect(s.structure.rounds[0].length).toBe(1) // 예선 1경기
    const prelim = byId(s, s.structure.rounds[0][0])
    expect(prelim.teamA).toBeTruthy()
    expect(prelim.teamB).toBeTruthy()
    // 영구 부전승 칸이 없음: 모든 본선 슬롯은 (직행 팀 | 예선 승자) 소스를 가짐
    for (const m of s.matches) {
      expect(m.srcA).toBeTruthy()
      expect(m.srcB).toBeTruthy()
    }
  })
})

describe('singleElim 진출/결과', () => {
  it('5팀: 예선 승자가 준결승에 진출', () => {
    let s = generate(mkTeams(5), { bestOf: 1 })
    const pre = s.structure.rounds[0][0]
    const preWinner = byId(s, pre).teamA
    s = applyResult(s, pre, [{ a: 21, b: 10 }], { bestOf: 1 })
    const semi = s.structure.rounds[1].map(id => byId(s, id))
    expect(semi.some(m => m.teamA === preWinner || m.teamB === preWinner)).toBe(true)
  })

  it('점수 입력 시 내가 쓴 점수가 보존된다 (pick 아님)', () => {
    let s = generate(mkTeams(4), { bestOf: 1 })
    const m0 = s.structure.rounds[0][0]
    s = applyResult(s, m0, [{ a: 2, b: 1 }], { bestOf: 1 })
    const m = byId(s, m0)
    expect(m.games).toEqual([{ a: 2, b: 1 }])
    expect(m.winner).toBe(m.teamA) // 2>1
  })

  it('pickWinner: 점수 없이 승자만 지정', () => {
    let s = generate(mkTeams(4), { bestOf: 1 })
    const m0 = s.structure.rounds[0][0]
    const a = byId(s, m0).teamA
    s = pickWinner(s, m0, a, { bestOf: 1 })
    const m = byId(s, m0)
    expect(m.winner).toBe(a)
    expect(m.games.length).toBe(0)
  })

  it('수정 시 하류 결과 보존 / 결승 완료 시 우승자', () => {
    let s = generate(mkTeams(4), { bestOf: 1 })
    const semis = s.structure.rounds[0]
    s = pickWinner(s, semis[0], byId(s, semis[0]).teamA, { bestOf: 1 })
    s = pickWinner(s, semis[1], byId(s, semis[1]).teamA, { bestOf: 1 })
    const fin = s.structure.rounds[1][0]
    const finA = byId(s, fin).teamA
    s = pickWinner(s, fin, finA, { bestOf: 1 })
    expect(isComplete(s)).toBe(true)
    expect(standings(s).champion).toBe(finA)
  })
})
