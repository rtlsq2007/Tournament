import { describe, it, expect } from 'vitest'
import { pairTeams, seedOrder } from './balancer.js'

const P = (id, tier, gender = 'M') => ({ id, name: id, tier, gender })

describe('pairTeams', () => {
  it('단식: 1인 1팀', () => {
    const teams = pairTeams([P('a', 5), P('b', 3)], { matchType: 'singles', mode: 'auto' })
    expect(teams).toHaveLength(2)
    expect(teams[0].playerIds).toHaveLength(1)
  })
  it('복식 auto: 고수+하수 짝지어 전력 균형(양끝 페어링)', () => {
    const teams = pairTeams([P('a',5),P('b',4),P('c',2),P('d',1)], { matchType: 'doubles', mode: 'auto' })
    expect(teams).toHaveLength(2)
    const sums = teams.map(t => t.tierSum).sort()
    expect(sums).toEqual([6, 6])
  })
  it('혼복 auto: 각 팀 남1+여1', () => {
    const players = [P('m1',5,'M'),P('m2',3,'M'),P('f1',4,'F'),P('f2',2,'F')]
    const teams = pairTeams(players, { matchType: 'mixed', mode: 'auto' })
    expect(teams).toHaveLength(2)
    for (const t of teams) {
      const gs = t.playerIds.map(id => players.find(p => p.id === id).gender).sort()
      expect(gs).toEqual(['F', 'M'])
    }
  })
})

describe('seedOrder', () => {
  it('tierSum 내림차순으로 시드 부여', () => {
    const ordered = seedOrder([{ id: 't1', tierSum: 4 }, { id: 't2', tierSum: 9 }])
    expect(ordered.map(t => t.id)).toEqual(['t2', 't1'])
  })
})
