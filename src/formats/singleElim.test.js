import { describe, it, expect } from 'vitest'
import { generate } from './singleElim.js'

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
