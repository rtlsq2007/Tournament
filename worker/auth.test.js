import { describe, it, expect } from 'vitest'
import { signSession, verifySession, timingSafeEqual, getCookie, sessionSetCookie, sessionClearCookie } from './auth.js'

const SECRET = 'test-secret-xyz'

describe('auth session', () => {
  it('서명한 세션은 같은 키로 검증되고 sub을 돌려준다', async () => {
    const token = await signSession(SECRET, 'admin')
    const payload = await verifySession(SECRET, token)
    expect(payload?.sub).toBe('admin')
    expect(typeof payload.exp).toBe('number')
  })
  it('다른 키로는 검증 실패(위조 방지)', async () => {
    const token = await signSession(SECRET, 'admin')
    expect(await verifySession('other-secret', token)).toBe(null)
  })
  it('서명 변조 시 검증 실패', async () => {
    const token = await signSession(SECRET, 'admin')
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa')
    expect(await verifySession(SECRET, tampered)).toBe(null)
  })
  it('만료된 토큰은 거부', async () => {
    const token = await signSession(SECRET, 'admin', -1000) // 이미 만료
    expect(await verifySession(SECRET, token)).toBe(null)
  })
  it('빈/형식오류 토큰·빈 시크릿은 null', async () => {
    expect(await verifySession(SECRET, '')).toBe(null)
    expect(await verifySession(SECRET, 'nodothere')).toBe(null)
    expect(await verifySession('', await signSession(SECRET, 'admin'))).toBe(null)
  })
  it('timingSafeEqual', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'ab')).toBe(false)
    expect(timingSafeEqual('', '')).toBe(true)
  })
  it('쿠키 파싱/직렬화', () => {
    expect(getCookie('a=1; sess=xyz; b=2', 'sess')).toBe('xyz')
    expect(getCookie('a=1', 'sess')).toBe(null)
    expect(sessionSetCookie('tok', 60)).toContain('HttpOnly')
    expect(sessionSetCookie('tok', 60)).toContain('Max-Age=60')
    expect(sessionClearCookie()).toContain('Max-Age=0')
  })
})
