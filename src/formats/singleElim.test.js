import { describe, it, expect } from 'vitest'
import { generate, applyResult, pickWinner, isComplete, standings } from './singleElim.js'

const mkTeams = n => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, label: '', playerIds: [`p${i + 1}`], tierSum: 3 }))
const byId = (s, id) => s.matches.find(m => m.id === id)

describe('singleElim.generate (순차 페어링)', () => {
  it('4팀: 준결승(2)+결승(1)', () => {
    const s = generate(mkTeams(4), { bestOf: 1 })
    expect(s.structure.rounds.map(r => r.length)).toEqual([2, 1])
    expect(s.structure.labels).toEqual(['준결승', '결승'])
  })
  it('8팀: 8강·준결승·결승, 1라운드 4경기 모두 두 팀', () => {
    const s = generate(mkTeams(8), { bestOf: 1 })
    expect(s.structure.labels).toEqual(['8강', '준결승', '결승'])
    const r0 = s.structure.rounds[0].map(id => byId(s, id))
    for (const m of r0) { expect(m.teamA).toBeTruthy(); expect(m.teamB).toBeTruthy() }
  })
  it('5팀: 예선 없이, 1라운드 3경기 중 마지막은 상대 칸 비움', () => {
    const s = generate(mkTeams(5), { bestOf: 1 })
    expect(s.structure.labels).toEqual(['8강', '준결승', '결승'])
    const r0 = s.structure.rounds[0].map(id => byId(s, id))
    expect(r0.length).toBe(3)
    expect(r0[2].teamA).toBeTruthy()
    expect(r0[2].teamB).toBe(null)   // 상대 비움
    expect(r0[2].srcB).toBe(null)    // 부전승 자동 진출 아님
    expect(r0[2].winner).toBe(null)
  })
})

describe('singleElim 결과/진출', () => {
  it('점수 입력 시 내가 쓴 점수가 보존되고 승자 결정', () => {
    let s = generate(mkTeams(4), { bestOf: 1 })
    const m0 = s.structure.rounds[0][0]
    s = applyResult(s, m0, [{ a: 2, b: 1 }], { bestOf: 1 })
    const m = byId(s, m0)
    expect(m.games).toEqual([{ a: 2, b: 1 }])
    expect(m.winner).toBe(m.teamA)
  })
  it('승자 버튼은 점수가 있으면 점수를 지우지 않음', () => {
    let s = generate(mkTeams(4), { bestOf: 1 })
    const m0 = s.structure.rounds[0][0]
    s = applyResult(s, m0, [{ a: 2, b: 1 }], { bestOf: 1 })
    const winner = byId(s, m0).winner
    s = pickWinner(s, m0, winner, { bestOf: 1 })
    expect(byId(s, m0).games).toEqual([{ a: 2, b: 1 }]) // 점수 유지
  })
  it('상대 빈 경기는 부전승 진출 버튼(pick)으로만 올라감', () => {
    let s = generate(mkTeams(5), { bestOf: 1 })
    const lone = byId(s, s.structure.rounds[0][2]) // 상대 빈 경기
    expect(lone.winner).toBe(null) // 자동 진출 안 함
    s = pickWinner(s, lone.id, lone.teamA, { bestOf: 1 })
    expect(byId(s, s.structure.rounds[0][2]).winner).toBe(lone.teamA)
  })
  it('결승까지 완료 시 우승자', () => {
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
