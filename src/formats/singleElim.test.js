import { describe, it, expect } from 'vitest'
import { generate, applyResult, recompute, isComplete, standings } from './singleElim.js'

const mkTeams = n => Array.from({ length: n }, (_, i) => ({ id: `t${i+1}`, label: `T${i+1}`, tierSum: n - i }))

describe('singleElim.generate', () => {
  it('4팀: 1라운드 2경기, 결승 1경기, 총 2라운드', () => {
    const s = generate(mkTeams(4), { bestOf: 1 })
    expect(s.structure.rounds).toHaveLength(2)
    expect(s.structure.rounds[0]).toHaveLength(2)
    expect(s.structure.rounds[1]).toHaveLength(1)
    expect(s.matches.filter(m => m.round === 1)).toHaveLength(2)
  })
  it('비-2의거듭제곱(5팀): 8칸 브라켓 + 상위시드 부전승', () => {
    const s = generate(mkTeams(5), { bestOf: 1 })
    const r1 = s.matches.filter(m => m.round === 1)
    expect(r1).toHaveLength(4)
    const byes = r1.filter(m => m.teamA === null || m.teamB === null)
    expect(byes.length).toBe(3) // 8칸 - 5팀 = 3 bye
    for (const m of byes) expect(m.status).toBe('done')
  })
})

describe('singleElim.applyResult/recompute', () => {
  const start = () => generate(mkTeams(4), { bestOf: 1 })

  it('1라운드 결과 입력 시 승자가 결승에 진출', () => {
    let s = start()
    const r1 = s.matches.filter(m => m.round === 1)
    s = applyResult(s, r1[0].id, [{ a: 21, b: 10 }], { bestOf: 1 })
    s = applyResult(s, r1[1].id, [{ a: 21, b: 15 }], { bestOf: 1 })
    const final = s.matches.find(m => m.round === 2)
    expect(final.teamA).toBe(r1[0].teamA)
    expect(final.teamB).toBe(r1[1].teamA)
  })

  it('되돌리기/수정: 1라운드 점수를 바꾸면 결승 진출자도 바뀜', () => {
    let s = start()
    const r1 = s.matches.filter(m => m.round === 1)
    s = applyResult(s, r1[0].id, [{ a: 21, b: 10 }], { bestOf: 1 })
    s = applyResult(s, r1[0].id, [{ a: 10, b: 21 }], { bestOf: 1 })
    const final = s.matches.find(m => m.round === 2)
    expect(final.teamA).toBe(r1[0].teamB)
  })

  it('결승까지 끝나면 isComplete=true, 우승자 노출', () => {
    let s = start()
    const r1 = s.matches.filter(m => m.round === 1)
    s = applyResult(s, r1[0].id, [{ a: 21, b: 1 }], { bestOf: 1 })
    s = applyResult(s, r1[1].id, [{ a: 21, b: 1 }], { bestOf: 1 })
    const final = s.matches.find(m => m.round === 2)
    s = applyResult(s, final.id, [{ a: 21, b: 1 }], { bestOf: 1 })
    expect(isComplete(s)).toBe(true)
    expect(standings(s).champion).toBe(final.teamA)
  })

  it('진출자가 안 바뀌는 초기 점수 수정은 하류(결승) 결과를 보존한다', () => {
    let s = start()
    const r1 = s.matches.filter(m => m.round === 1)
    s = applyResult(s, r1[0].id, [{ a: 21, b: 1 }], { bestOf: 1 })  // r1[0] teamA 승
    s = applyResult(s, r1[1].id, [{ a: 21, b: 1 }], { bestOf: 1 })  // r1[1] teamA 승
    let final = s.matches.find(m => m.round === 2)
    s = applyResult(s, final.id, [{ a: 21, b: 5 }], { bestOf: 1 })  // 결승 완료
    const championBefore = standings(s).champion
    // r1[0] 점수만 수정(승자는 동일 teamA) → 결승 진출자 불변 → 결승 결과 보존돼야
    s = applyResult(s, r1[0].id, [{ a: 21, b: 19 }], { bestOf: 1 })
    expect(isComplete(s)).toBe(true)
    expect(standings(s).champion).toBe(championBefore)
  })
})
