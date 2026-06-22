import { describe, it, expect } from 'vitest'
import { gamesToWin, matchWinner } from './match.js'

describe('match', () => {
  it('gamesToWin: bestOf의 과반', () => {
    expect(gamesToWin(1)).toBe(1)
    expect(gamesToWin(3)).toBe(2)
    expect(gamesToWin(5)).toBe(3)
  })
  it('matchWinner: 단판', () => {
    expect(matchWinner([{ a: 21, b: 18 }], 1)).toBe('A')
    expect(matchWinner([{ a: 15, b: 21 }], 1)).toBe('B')
  })
  it('matchWinner: 3판2선승 - 2세트 먼저 이긴 쪽', () => {
    expect(matchWinner([{ a: 21, b: 10 }, { a: 18, b: 21 }, { a: 21, b: 19 }], 3)).toBe('A')
  })
  it('matchWinner: 아직 미결정이면 null', () => {
    expect(matchWinner([{ a: 21, b: 10 }], 3)).toBe(null)
    expect(matchWinner([], 1)).toBe(null)
  })
})
