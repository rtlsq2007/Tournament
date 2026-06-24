// 관리자 세션 — HMAC 서명 토큰 (payloadB64.sigB64). sub은 지금 'admin',
// 추후 계정 도입 시 사용자명으로만 바뀌면 됨(쿠키·검증 로직 그대로).
const enc = new TextEncoder()

const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const a = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i)
  return a
}

// 상수 시간 문자열 비교 (타이밍 공격 방지). 길이 다르면 즉시 false.
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return await crypto.subtle.sign('HMAC', key, enc.encode(data))
}

export async function signSession(secret, sub, ttlMs = 30 * 24 * 3600 * 1000) {
  const payload = b64url(enc.encode(JSON.stringify({ sub, exp: Date.now() + ttlMs })))
  const sig = b64url(await hmac(secret, payload))
  return `${payload}.${sig}`
}

// 유효하면 payload({sub, exp}) 반환, 아니면 null. (서명 위조·만료 모두 거름)
export async function verifySession(secret, token) {
  if (!secret || !token || typeof token !== 'string') return null
  const dot = token.indexOf('.')
  if (dot < 1) return null
  const payload = token.slice(0, dot), sig = token.slice(dot + 1)
  const expected = b64url(await hmac(secret, payload))
  if (!timingSafeEqual(expected, sig)) return null
  let obj
  try { obj = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))) } catch { return null }
  if (!obj || typeof obj.exp !== 'number' || obj.exp < Date.now()) return null
  return obj
}

export function getCookie(cookieHeader, name) {
  const m = (cookieHeader || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}

export const sessionSetCookie = (token, maxAgeSec) =>
  `sess=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`
export const sessionClearCookie = () =>
  'sess=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
