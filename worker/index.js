// Cloudflare Worker: /api/* 는 D1 백엔드 처리, 그 외는 정적 자산(SPA) 서빙.
import { shortId, secretToken } from '../src/lib/id.js'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url)
    return env.ASSETS.fetch(request) // 정적 자산 + SPA 폴백
  },
}

async function handleApi(request, env, url) {
  if (!env.DB) return json({ error: 'DB not configured' }, 503)
  const m = url.pathname.match(/^\/api\/tournament\/?([^/]*)$/)
  if (!m) return json({ error: 'not found' }, 404)
  const id = m[1]
  try {
    if (!id && request.method === 'POST') return await createTournament(request, env)
    if (id && request.method === 'GET') return await getTournament(env, id, url)
    if (id && request.method === 'PUT') return await putTournament(request, env, id)
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500)
  }
  return json({ error: 'method not allowed' }, 405)
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

// 상태 저장 (admin_token 필요). 낙관적 동시성(baseUpdatedAt).
async function putTournament(request, env, id) {
  const row = await env.DB.prepare('SELECT * FROM tournaments WHERE id=?').bind(id).first()
  if (!row) return json({ error: 'not found' }, 404)
  if (request.headers.get('x-admin-token') !== row.admin_token) return json({ error: 'forbidden' }, 403)
  const body = await request.json()
  if (body.baseUpdatedAt && body.baseUpdatedAt < row.updated_at) {
    return json({ conflict: true, updatedAt: row.updated_at, data: JSON.parse(row.data_json) }, 409)
  }
  const now = Date.now()
  await env.DB.prepare('UPDATE tournaments SET data_json=?, name=?, updated_at=? WHERE id=?')
    .bind(JSON.stringify(body.data), body.name ?? row.name, now, id).run()
  return json({ updatedAt: now })
}
