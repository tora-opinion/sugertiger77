import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env, PaymentRequest, EncryptedCard, CardPayload } from './types'
import { generateId, generateApiKey, encryptCardData, decryptCardData } from './crypto'
import { sha256, validateApiKey } from './auth'

const app = new Hono<{ Bindings: Env; Variables: { apiKeyId: string; apiKeyName: string } }>()
app.use('/api/*', cors({ origin: '*', credentials: true }))

async function requireApiKey(c: any, next: any) {
  const r = await validateApiKey(c.req.raw, c.env.AGENT_KEYS_KV)
  if (!r.valid) return c.json({ error: 'Invalid API key' }, 401)
  c.set('apiKeyId', r.keyId!); c.set('apiKeyName', r.keyName!)
  return next()
}

app.post('/api/payment-requests', requireApiKey, async (c) => {
  const b = await c.req.json<{ amount: number; currency?: string; merchant?: string; description?: string }>()
  if (!b.amount || b.amount <= 0 || !Number.isFinite(b.amount)) return c.json({ error: '有効な金額を指定してください' }, 400)
  const id = generateId(); const now = new Date().toISOString()
  const p: PaymentRequest = { id, amount: b.amount, currency: b.currency || 'JPY', merchant: b.merchant || '未設定', description: b.description || '', status: 'pending', apiKeyId: c.get('apiKeyId'), apiKeyName: c.get('apiKeyName'), createdAt: now, updatedAt: now }
  await c.env.AGENT_PAYMENTS_KV.put('payment:' + id, JSON.stringify(p))
  return c.json({ id, status: 'pending', amount: p.amount, currency: p.currency, merchant: p.merchant, description: p.description, createdAt: p.createdAt }, 201)
})

app.get('/api/payment-requests/:id', async (c) => {
  const id = c.req.param('id'); const d = await c.env.AGENT_PAYMENTS_KV.get('payment:' + id)
  if (!d) return c.json({ error: '見つかりません' }, 404)
  const p = JSON.parse(d) as PaymentRequest
  const r: any = { id: p.id, status: p.status, amount: p.amount, currency: p.currency, merchant: p.merchant, description: p.description, createdAt: p.createdAt, updatedAt: p.updatedAt, apiKeyName: p.apiKeyName }
  const ak = await validateApiKey(c.req.raw, c.env.AGENT_KEYS_KV)
  if (p.status === 'approved' && p.cardId && ak.valid && ak.keyId === p.apiKeyId) {
    const cd = await c.env.AGENT_CARDS_KV.get('card:' + p.cardId)
    if (cd) { try { r.card = JSON.parse(await decryptCardData((JSON.parse(cd) as EncryptedCard).encryptedData, c.env.CARD_ENCRYPTION_KEY)) as CardPayload; p.status = 'completed'; p.updatedAt = new Date().toISOString(); await c.env.AGENT_PAYMENTS_KV.put('payment:' + id, JSON.stringify(p)) } catch { return c.json({ error: 'カード復号に失敗しました' }, 500) } }
  }
  return c.json(r)
})

app.get('/api/payment-requests', async (c) => {
  const filter = c.req.query('status'); const list = await c.env.AGENT_PAYMENTS_KV.list({ prefix: 'payment:' })
  const ps: PaymentRequest[] = []
  for (const k of list.keys) { const d = await c.env.AGENT_PAYMENTS_KV.get(k.name); if (d) { const p = JSON.parse(d) as PaymentRequest; if (!filter || p.status === filter) ps.push(p) } }
  ps.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return c.json({ payments: ps })
})

app.post('/api/payment-requests/:id/approve', async (c) => {
  const id = c.req.param('id'); const d = await c.env.AGENT_PAYMENTS_KV.get('payment:' + id)
  if (!d) return c.json({ error: '見つかりません' }, 404)
  const p = JSON.parse(d) as PaymentRequest
  if (p.status !== 'pending') return c.json({ error: p.status + 'は承認できません' }, 400)
  const body = await c.req.json<{ cardId?: string }>().catch(() => ({ cardId: undefined }))
  const list = await c.env.AGENT_CARDS_KV.list({ prefix: 'card:' })
  if (!list.keys.length) return c.json({ error: 'カードが登録されていません' }, 400)
  const cid = body.cardId || list.keys[0].name.replace('card:', '')
  if (!await c.env.AGENT_CARDS_KV.get('card:' + cid)) return c.json({ error: 'カードが見つかりません' }, 404)
  p.status = 'approved'; p.cardId = cid; p.updatedAt = new Date().toISOString()
  await c.env.AGENT_PAYMENTS_KV.put('payment:' + id, JSON.stringify(p))
  return c.json({ success: true, status: 'approved' })
})

app.post('/api/payment-requests/:id/reject', async (c) => {
  const id = c.req.param('id'); const d = await c.env.AGENT_PAYMENTS_KV.get('payment:' + id)
  if (!d) return c.json({ error: '見つかりません' }, 404)
  const p = JSON.parse(d) as PaymentRequest
  if (p.status !== 'pending') return c.json({ error: p.status + 'は拒否できません' }, 400)
  p.status = 'rejected'; p.updatedAt = new Date().toISOString()
  await c.env.AGENT_PAYMENTS_KV.put('payment:' + id, JSON.stringify(p))
  return c.json({ success: true, status: 'rejected' })
})

app.get('/api/cards', async (c) => {
  const list = await c.env.AGENT_CARDS_KV.list({ prefix: 'card:' })
  const cards: Array<{ id: string; label: string; createdAt: string }> = []
  for (const k of list.keys) { const d = await c.env.AGENT_CARDS_KV.get(k.name); if (d) { const x = JSON.parse(d) as EncryptedCard; cards.push({ id: x.id, label: x.label, createdAt: x.createdAt }) } }
  return c.json({ cards })
})

app.post('/api/cards', async (c) => {
  const b = await c.req.json<{ label: string; number: string; expiry: string; cvv: string; holderName: string }>()
  if (!b.number || !b.expiry || !b.cvv) return c.json({ error: 'カード番号、有効期限、CVVは必須です' }, 400)
  const encrypted = await encryptCardData(JSON.stringify({ number: b.number, expiry: b.expiry, cvv: b.cvv, holderName: b.holderName || '' }), c.env.CARD_ENCRYPTION_KEY)
  const id = generateId()
  const card: EncryptedCard = { id, label: b.label || (b.holderName || '') + '（****' + b.number.slice(-4) + '）', encryptedData: encrypted, createdAt: new Date().toISOString() }
  await c.env.AGENT_CARDS_KV.put('card:' + id, JSON.stringify(card))
  return c.json({ success: true, id, label: card.label }, 201)
})

app.delete('/api/cards/:id', async (c) => {
  const id = c.req.param('id')
  if (!await c.env.AGENT_CARDS_KV.get('card:' + id)) return c.json({ error: '見つかりません' }, 404)
  await c.env.AGENT_CARDS_KV.delete('card:' + id)
  return c.json({ success: true })
})

app.get('/api/keys', async (c) => {
  const list = await c.env.AGENT_KEYS_KV.list({ prefix: 'apikey:' })
  const keys: Array<{ id: string; name: string; createdAt: string }> = []
  for (const k of list.keys) { const d = await c.env.AGENT_KEYS_KV.get(k.name); if (d) { const i = JSON.parse(d); keys.push({ id: i.id, name: i.name, createdAt: i.createdAt }) } }
  return c.json({ keys })
})

app.post('/api/keys', async (c) => {
  const { name } = await c.req.json<{ name: string }>()
  if (!name) return c.json({ error: 'キー名は必須です' }, 400)
  const id = generateId(); const key = generateApiKey(); const now = new Date().toISOString()
  await c.env.AGENT_KEYS_KV.put('apikey:' + await sha256(key), JSON.stringify({ id, name, createdAt: now }))
  return c.json({ id, name, key, createdAt: now } as any, 201)
})

app.delete('/api/keys/:id', async (c) => {
  const id = c.req.param('id'); const list = await c.env.AGENT_KEYS_KV.list({ prefix: 'apikey:' })
  for (const k of list.keys) { const d = await c.env.AGENT_KEYS_KV.get(k.name); if (d) { const i = JSON.parse(d); if (i.id === id) { await c.env.AGENT_KEYS_KV.delete(k.name); return c.json({ success: true }) } } }
  return c.json({ error: '見つかりません' }, 404)
})

export default app
