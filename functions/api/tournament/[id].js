export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url)
  const since = Number(url.searchParams.get('since') || 0)
  const row = await env.DB.prepare('SELECT * FROM tournaments WHERE id=?').bind(params.id).first()
  if (!row) return new Response('not found', { status: 404 })
  if (since && row.updated_at <= since) return new Response(null, { status: 304 })
  return Response.json({
    id: row.id, name: row.name, updatedAt: row.updated_at,
    data: JSON.parse(row.data_json),
  })
}

export async function onRequestPut({ params, request, env }) {
  const row = await env.DB.prepare('SELECT * FROM tournaments WHERE id=?').bind(params.id).first()
  if (!row) return new Response('not found', { status: 404 })
  const token = request.headers.get('x-admin-token')
  if (token !== row.admin_token) return new Response('forbidden', { status: 403 })
  const body = await request.json()
  if (body.baseUpdatedAt && body.baseUpdatedAt < row.updated_at) {
    return new Response(JSON.stringify({ conflict: true, updatedAt: row.updated_at, data: JSON.parse(row.data_json) }),
      { status: 409, headers: { 'content-type': 'application/json' } })
  }
  const now = Date.now()
  await env.DB.prepare('UPDATE tournaments SET data_json=?, name=?, updated_at=? WHERE id=?')
    .bind(JSON.stringify(body.data), body.name ?? row.name, now, params.id).run()
  return Response.json({ updatedAt: now })
}
