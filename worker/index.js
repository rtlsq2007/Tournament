// Cloudflare Worker: /api/* 는 D1 백엔드 처리, 그 외는 정적 자산(SPA) 서빙.
import { shortId, secretToken } from '../src/lib/id.js'
import { signSession, verifySession, getCookie, sessionSetCookie, sessionClearCookie, timingSafeEqual } from './auth.js'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

const unauthorized = () => json({ error: 'unauthorized' }, 401)
// 세션 쿠키 검증 → payload({sub,exp}) 또는 null
const requireAuth = (request, env) =>
  verifySession(env.SESSION_SECRET, getCookie(request.headers.get('Cookie'), 'sess'))

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url)
    return env.ASSETS.fetch(request) // 정적 자산 + SPA 폴백
  },
}

async function handleApi(request, env, url) {
  // 인증 (DB 불필요)
  if (url.pathname === '/api/login' && request.method === 'POST') return await login(request, env)
  if (url.pathname === '/api/logout' && request.method === 'POST') return logout()
  if (url.pathname === '/api/me') return await me(request, env)

  if (!env.DB) return json({ error: 'DB not configured' }, 503)
  try {
    const authed = await requireAuth(request, env)
    // 라켓단 멤버 DB (동아리 공용 — 운영자만)
    if (url.pathname === '/api/members') {
      if (!authed) return unauthorized()
      if (request.method === 'GET') return await getMembers(env)
      if (request.method === 'PUT') return await putMembers(request, env)
      return json({ error: 'method not allowed' }, 405)
    }
    // 경기 기록 보관함 (클럽 공용 — 운영자만)
    if (url.pathname === '/api/records') {
      if (!authed) return unauthorized()
      if (request.method === 'GET') return await getKvList(env, 'records')
      if (request.method === 'PUT') return await putKvList(request, env, 'records')
      return json({ error: 'method not allowed' }, 405)
    }
    // AI 밸런싱 (운영자만 — 쿼터 보호)
    if (url.pathname === '/api/balance' && request.method === 'POST') {
      if (!authed) return unauthorized()
      return await balanceTeams(request, env)
    }
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500)
  }
  const m = url.pathname.match(/^\/api\/tournament\/?([^/]*)$/)
  if (!m) return json({ error: 'not found' }, 404)
  const id = m[1]
  try {
    // 생성·저장은 로그인 필요. 읽기(GET)는 공개(참가자 관전).
    if (!id && request.method === 'POST') return (await requireAuth(request, env)) ? await createTournament(request, env) : unauthorized()
    if (id && request.method === 'GET') return await getTournament(env, id, url)
    if (id && request.method === 'PUT') return (await requireAuth(request, env)) ? await putTournament(request, env, id) : unauthorized()
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500)
  }
  return json({ error: 'method not allowed' }, 405)
}

// ===== 인증 (단일 관리자 비밀번호 → 서명 세션 쿠키) =====
async function login(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET)
    return json({ error: '로그인이 설정되지 않았습니다. (ADMIN_PASSWORD / SESSION_SECRET secret 필요)' }, 503)
  const body = await request.json().catch(() => ({}))
  const pw = String(body.password || '')
  if (!timingSafeEqual(pw, env.ADMIN_PASSWORD)) {
    await new Promise(r => setTimeout(r, 350)) // 무차별 대입 완화
    return json({ error: '비밀번호가 올바르지 않습니다.' }, 401)
  }
  const token = await signSession(env.SESSION_SECRET, 'admin')
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'content-type': 'application/json', 'Set-Cookie': sessionSetCookie(token, 30 * 24 * 3600) },
  })
}
function logout() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'content-type': 'application/json', 'Set-Cookie': sessionClearCookie() },
  })
}
async function me(request, env) {
  const s = await requireAuth(request, env)
  return json({ authed: !!s, sub: s?.sub || null, configured: !!(env.ADMIN_PASSWORD && env.SESSION_SECRET) })
}

// 새 대회 생성 → { id, adminToken }
async function createTournament(request, env) {
  const body = await request.json()
  const id = shortId()
  const admin_token = secretToken()
  const now = Date.now()
  const data = {
    name: body.name || '', sport: body.sport || 'badminton',
    format: body.format, matchType: body.matchType, pairingMode: body.pairingMode,
    status: 'setup', settings: body.settings || {},
    participants: [], teams: [], structure: { rounds: [], labels: [] }, matches: [],
  }
  await env.DB.prepare(
    'INSERT INTO tournaments (id, admin_token, name, data_json, updated_at, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(id, admin_token, body.name || '', JSON.stringify(data), now, now).run()
  return json({ id, adminToken: admin_token })
}

// 상태 읽기 (admin_token은 내려보내지 않음). since 이후 변경 없으면 304.
async function getTournament(env, id, url) {
  const since = Number(url.searchParams.get('since') || 0)
  const row = await env.DB.prepare('SELECT * FROM tournaments WHERE id=?').bind(id).first()
  if (!row) return json({ error: 'not found' }, 404)
  if (since && row.updated_at <= since) return new Response(null, { status: 304 })
  return json({ id: row.id, name: row.name, updatedAt: row.updated_at, data: JSON.parse(row.data_json) })
}

// 상태 저장 (세션 인증은 라우트에서 처리). 낙관적 동시성(baseUpdatedAt).
async function putTournament(request, env, id) {
  const row = await env.DB.prepare('SELECT * FROM tournaments WHERE id=?').bind(id).first()
  if (!row) return json({ error: 'not found' }, 404)
  const body = await request.json()
  if (body.baseUpdatedAt && body.baseUpdatedAt < row.updated_at) {
    return json({ conflict: true, updatedAt: row.updated_at, data: JSON.parse(row.data_json) }, 409)
  }
  const now = Date.now()
  await env.DB.prepare('UPDATE tournaments SET data_json=?, name=?, updated_at=? WHERE id=?')
    .bind(JSON.stringify(body.data), body.name ?? row.name, now, id).run()
  return json({ updatedAt: now })
}

// ===== 라켓단 멤버 (동아리 공용 명부) =====
async function ensureKv(env) {
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS app_kv (k TEXT PRIMARY KEY, v TEXT)').run()
}
async function getMembers(env) {
  await ensureKv(env)
  const row = await env.DB.prepare("SELECT v FROM app_kv WHERE k='members'").first()
  return json({ members: row ? JSON.parse(row.v) : [] })
}
async function putMembers(request, env) {
  await ensureKv(env)
  const body = await request.json()
  const members = Array.isArray(body.members) ? body.members : []
  await env.DB.prepare("INSERT INTO app_kv (k, v) VALUES ('members', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v")
    .bind(JSON.stringify(members)).run()
  return json({ ok: true, count: members.length })
}

// 범용 KV 리스트 (app_kv에 JSON 배열 한 칸). 키별로 GET/PUT.
async function getKvList(env, key) {
  await ensureKv(env)
  const row = await env.DB.prepare('SELECT v FROM app_kv WHERE k=?').bind(key).first()
  return json({ [key]: row ? JSON.parse(row.v) : [] })
}
async function putKvList(request, env, key) {
  await ensureKv(env)
  const body = await request.json()
  const list = Array.isArray(body[key]) ? body[key] : []
  await env.DB.prepare('INSERT INTO app_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v')
    .bind(key, JSON.stringify(list)).run()
  return json({ ok: true, count: list.length })
}

// ===== AI 밸런싱 (Gemini) =====
// 키로 사용 가능한 모델을 조회해 가장 최신 flash 모델부터 시도하도록 후보 목록 생성
async function pickModels(env) {
  const verNum = n => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/i); return m ? parseFloat(m[1]) : 0 }
  let available = []
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`)
    if (r.ok) {
      const d = await r.json()
      available = (d.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent')
          && /models\/gemini-/i.test(m.name) && !/embedding|aqa|tts|image|learnlm/i.test(m.name))
        .map(m => m.name.replace(/^models\//, ''))
    }
  } catch { /* 조회 실패 시 폴백 사용 */ }
  const flash = available.filter(n => /flash/i.test(n) && !/preview|exp|thinking/i.test(n))
  const ordered = [...(flash.length ? flash : available)].sort((a, b) => verNum(b) - verNum(a))
  return [...new Set([...ordered, 'gemini-2.5-flash', 'gemini-2.0-flash'])].slice(0, 5)
}

async function balanceTeams(request, env) {
  if (!env.GEMINI_API_KEY) return json({ error: 'AI 키가 설정되지 않았습니다. (GEMINI_API_KEY)' }, 503)
  const body = await request.json()
  const players = Array.isArray(body.players) ? body.players : []
  const teamSize = body.teamSize === 1 ? 1 : 2
  const teamCount = Math.floor(players.length / teamSize)
  if (teamCount < 1) return json({ error: '선수가 부족합니다.' }, 400)

  const lines = players.map((p, i) =>
    `${i}: ${p.name} (실력 ${p.tier}/5)${p.strengths ? ` 장점:${p.strengths}` : ''}${p.weaknesses ? ` 단점:${p.weaknesses}` : ''}`
  ).join('\n')
  const prompt = `너는 배드민턴 대회 운영자야. 아래 선수들을 ${teamCount}개의 ${teamSize}인 팀으로, 팀 간 전력이 최대한 균형되도록 나눠줘.
실력(별점)과 장단점을 종합 고려하고, 서로의 단점을 보완하는 조합을 우선해. 각 팀의 전력 합이 비슷하도록 해.
모든 선수를 정확히 한 번씩만 배정해. 반드시 아래 JSON 형식만 출력(설명 금지):
{"teams":[[선수인덱스, ...], ...]}

선수목록:
${lines}`

  // 키로 사용 가능한 모델을 조회해 가장 최신 flash 모델 선택 (Gemini 3 등 신규도 자동 사용)
  const candidates = await pickModels(env)
  let text = null, lastErr = '', usedModel = ''
  for (const model of candidates) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.8 } }),
    })
    if (r.ok) { const d = await r.json(); text = d?.candidates?.[0]?.content?.parts?.[0]?.text; if (text) { usedModel = model; break } }
    else {
      lastErr = (await r.text()).slice(0, 140)
      // 과부하/쿼터/모델없음 등 일시·대체 가능한 오류면 다음 모델 시도, 그 외(인증 등)는 중단
      if (!/not found|not supported|overload|high demand|unavailable|exhausted|quota|rate|503|429/i.test(lastErr)) break
    }
  }
  if (!text) return json({ error: 'AI 호출 실패: ' + lastErr }, 502)
  let parsed
  try { parsed = JSON.parse(text) } catch { return json({ error: 'AI 응답 형식 오류' }, 502) }
  return json({ teams: Array.isArray(parsed.teams) ? parsed.teams : [], model: usedModel })
}
