import { describe, it, expect } from 'vitest'
import { getFormat, FORMAT_LABELS } from './index.js'

describe('formats registry', () => {
  it('single_elim 모듈 반환', () => {
    const f = getFormat('single_elim')
    expect(typeof f.generate).toBe('function')
    expect(typeof f.recompute).toBe('function')
  })
  it('라벨 맵 존재', () => {
    expect(FORMAT_LABELS.single_elim).toBe('싱글 엘리미네이션')
  })
})
