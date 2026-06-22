import { describe, it, expect } from 'vitest'
import { shortId, secretToken } from './id.js'

describe('id', () => {
  it('shortId: 6자 영숫자(혼동문자 제외)', () => {
    const id = shortId()
    expect(id).toMatch(/^[0-9a-hjkmnp-z]{6}$/)
  })
  it('secretToken: 충분히 길고 매번 다름', () => {
    const a = secretToken(), b = secretToken()
    expect(a.length).toBeGreaterThanOrEqual(24)
    expect(a).not.toBe(b)
  })
})
