var API = ''
var state = { view: 'pending', payments: [], cards: [], keys: [] }

function api(path, opts) {
  opts = opts || {}
  return fetch(API + path, { headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}), method: opts.method, body: opts.body })
    .then(function(r) { return r.json().then(function(d) { if (!r.ok && d && d.error) throw new Error(d.error); if (!r.ok) throw new Error('HTTP ' + r.status); return d }) })
}

function notify(msg, type) { var e = document.createElement('div'); e.className = 'notification notification-' + (type || 'success'); e.textContent = msg; document.body.appendChild(e); setTimeout(function() { e.remove() }, 3500) }
function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML }
function fmtAmt(a, c) { return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: c || 'JPY' }).format(a) }
function fmtDate(iso) { return new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }

var S = { pending: '保留中', approved: '承認済み', rejected: '拒否', completed: '完了' }
var T = [{ k: 'pending', l: '保留中' }, { k: 'approved', l: '承認済み' }, { k: 'rejected', l: '拒否' }, { k: 'cards', l: 'カード' }, { k: 'keys', l: 'APIキー' }]

function r() {
  var dark = document.documentElement.classList.contains('dark')
  var h = '<div><header class="header"><div class="header-inner"><span class="header-title">Agent Payment Approval</span><button class="theme-btn" onclick="toggleTheme()">' + (dark ? '☀️' : '🌙') + '</button></div></header><div class="container"><div class="tabs">'
  for (var i = 0; i < T.length; i++) h += '<button class="tab' + (state.view === T[i].k ? ' active' : '') + '" onclick="s(\'' + T[i].k + '\')">' + T[i].l + '</button>'
  h += '</div><div id="content"></div></div></div>'
  document.getElementById('app').innerHTML = h
  l()
}

function l() {
  var c = document.getElementById('content'); if (!c) return
  c.innerHTML = '<div class="loading">読み込み中...</div>'
  var p
  if (state.view === 'cards') p = api('/api/cards').then(function(d) { state.cards = d.cards; rc(); })
  else if (state.view === 'keys') p = api('/api/keys').then(function(d) { state.keys = d.keys; rk(); })
  else p = api('/api/payment-requests?status=' + state.view).then(function(d) { state.payments = d.payments; rp(); })
  p.catch(function(e) { c.innerHTML = '<div class="empty-state"><p>エラー: ' + esc(e.message) + '</p></div>' })
}

function rp() {
  var c = document.getElementById('content'); if (!c) return
  if (!state.payments.length) { c.innerHTML = '<div class="empty-state"><p>' + (S[state.view] || state.view) + 'の支払いリクエストはありません</p></div>'; return }
  var h = ''
  for (var i = 0; i < state.payments.length; i++) {
    var p = state.payments[i]
    h += '<div class="payment-card"><div class="payment-row"><div class="payment-info"><div class="payment-amount">' + fmtAmt(p.amount, p.currency) + '</div><div class="payment-merchant">' + esc(p.merchant || 'マーチャント未設定') + '</div>' +
      (p.description ? '<div class="payment-desc">' + esc(p.description) + '</div>' : '') +
      '<div class="payment-meta"><span>' + fmtDate(p.createdAt) + '</span>' + (p.apiKeyName ? '<span>by ' + esc(p.apiKeyName) + '</span>' : '') + '<span class="badge badge-' + p.status + '">' + (S[p.status] || p.status) + '</span></div></div>' +
      (p.status === 'pending' ? '<div class="payment-actions"><button class="btn btn-success btn-sm" onclick="approve(\'' + p.id + '\')">承認</button><button class="btn btn-danger btn-sm" onclick="reject(\'' + p.id + '\')">拒否</button></div>' : '') +
      '</div></div>'
  }
  c.innerHTML = h
}

function approve(id) { api('/api/payment-requests/' + id + '/approve', { method: 'POST', body: '{}' }).then(function() { notify('承認しました'); l() }).catch(function(e) { notify(e.message, 'error') }) }
function reject(id) { api('/api/payment-requests/' + id + '/reject', { method: 'POST', body: '{}' }).then(function() { notify('拒否しました'); l() }).catch(function(e) { notify(e.message, 'error') }) }

function rc() {
  var c = document.getElementById('content'); if (!c) return
  var h = '<div class="card"><div class="card-header"><h2>登録済みカード</h2><button class="btn btn-primary btn-sm" onclick="addCard()">カードを追加</button></div>'
  if (!state.cards.length) h += '<div class="empty-state"><p>カードが登録されていません。</p></div>'
  else for (var i = 0; i < state.cards.length; i++) { var x = state.cards[i]; h += '<div class="card-item"><div><div class="card-label">' + esc(x.label) + '</div><div class="card-meta">登録日: ' + fmtDate(x.createdAt) + '</div></div><div class="card-actions"><button class="btn btn-danger btn-sm" onclick="delCard(\'' + x.id + '\')">削除</button></div></div>' }
  h += '</div>'; c.innerHTML = h
}

function addCard() {
  var ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'modal'
  ov.innerHTML = '<div class="modal"><h3>クレジットカードを追加</h3><form id="card-form"><div class="form-group"><label>ラベル</label><input type="text" id="f-label" required></div><div class="form-group"><label>名義人</label><input type="text" id="f-holder" required></div><div class="form-group"><label>カード番号</label><input type="text" id="f-number" required placeholder="4111111111111111"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="form-group"><label>有効期限（月/年）</label><input type="text" id="f-expiry" required placeholder="12/28"></div><div class="form-group"><label>CVV</label><input type="text" id="f-cvv" required placeholder="123"></div></div><div class="modal-actions"><button type="button" class="btn btn-outline" onclick="cl()">キャンセル</button><button type="submit" class="btn btn-primary">保存</button></div></form></div>'
  document.body.appendChild(ov)
  document.getElementById('card-form').addEventListener('submit', function(e) {
    e.preventDefault()
    api('/api/cards', { method: 'POST', body: JSON.stringify({ label: document.getElementById('f-label').value, holderName: document.getElementById('f-holder').value, number: document.getElementById('f-number').value.replace(/\s/g, ''), expiry: document.getElementById('f-expiry').value, cvv: document.getElementById('f-cvv').value }) })
      .then(function() { notify('カードを追加しました'); cl(); l() }).catch(function(e) { notify(e.message, 'error') })
  })
}

function cl() { var m = document.getElementById('modal'); if (m) m.remove() }
function delCard(id) { if (!confirm('削除しますか？')) return; api('/api/cards/' + id, { method: 'DELETE' }).then(function() { notify('削除しました'); l() }).catch(function(e) { notify(e.message, 'error') }) }

function rk() {
  var c = document.getElementById('content'); if (!c) return
  var h = '<div class="card"><div class="card-header"><h2>APIキー</h2><button class="btn btn-primary btn-sm" onclick="addKey()">キーを作成</button></div>'
  if (!state.keys.length) h += '<div class="empty-state"><p>APIキーがありません。</p></div>'
  else for (var i = 0; i < state.keys.length; i++) { var k = state.keys[i]; h += '<div class="card-item"><div><div class="card-label">' + esc(k.name) + '</div><div class="card-meta">作成日: ' + fmtDate(k.createdAt) + '</div></div><div class="card-actions"><button class="btn btn-danger btn-sm" onclick="delKey(\'' + k.id + '\')">削除</button></div></div>' }
  h += '</div>'; c.innerHTML = h
}

function addKey() {
  var ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'modal'
  ov.innerHTML = '<div class="modal"><h3>APIキーを作成</h3><form id="key-form"><div class="form-group"><label>キー名</label><input type="text" id="f-kname" required></div><div class="modal-actions"><button type="button" class="btn btn-outline" onclick="cl()">キャンセル</button><button type="submit" class="btn btn-primary">作成</button></div></form><div id="key-result" style="display:none"><p style="font-size:13px;color:var(--success);margin-bottom:8px">コピーしてください。再表示はできません。</p><div class="key-display" id="key-val"></div><button class="btn btn-sm btn-outline" onclick="copyKey()" style="margin-top:8px">コピー</button><button class="btn btn-sm btn-primary" onclick="cl()" style="margin-top:8px;margin-left:4px">閉じる</button></div></div>'
  document.body.appendChild(ov)
  document.getElementById('key-form').addEventListener('submit', function(e) {
    e.preventDefault()
    api('/api/keys', { method: 'POST', body: JSON.stringify({ name: document.getElementById('f-kname').value }) })
      .then(function(d) { document.getElementById('key-form').style.display = 'none'; document.getElementById('key-val').textContent = d.key; document.getElementById('key-result').style.display = 'block'; notify('作成しました'); l() })
      .catch(function(e) { notify(e.message, 'error') })
  })
}

function copyKey() { var e = document.getElementById('key-val'); if (e) navigator.clipboard.writeText(e.textContent).then(function() { notify('コピーしました') }).catch(function() { notify('失敗', 'error') }) }
function delKey(id) { if (!confirm('削除しますか？')) return; api('/api/keys/' + id, { method: 'DELETE' }).then(function() { notify('削除しました'); l() }).catch(function(e) { notify(e.message, 'error') }) }

window.toggleTheme = function() { document.documentElement.classList.toggle('dark'); try { localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light' } catch(e) {} r() }
window.s = function(v) { state.view = v; r() }
window.approve = approve; window.reject = reject
window.addCard = addCard; window.delCard = delCard; window.cl = cl
window.addKey = addKey; window.delKey = delKey; window.copyKey = copyKey

r()
