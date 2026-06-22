import { shortId, secretToken } from '../../../src/lib/id.js'

export async function onRequestPost({ request, env }) {
  const body = await request.json()
  const id = shortId()
  const admin_token = secretToken()
  const now = Date.now()
  const data = {
    format: body.format, matchType: body.matchType, pairingMode: body.pairingMode,
    status: 'setup', settings: body.settings || {},
    participants: [], teams: [], structure: {}, matches: [],
  }
  await env.DB.prepare(
    'INSERT INTO tournaments (id, admin_token, name, data_json, updated_at, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(id, admin_token, body.name || '', JSON.stringify(data), now, now).run()
  return Response.json({ id, adminToken: admin_token })
}
