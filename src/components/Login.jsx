import { useState } from 'react'
import { login } from '../lib/api.js'

// 관리자 로그인 화면. 성공 시 onSuccess() → 상위에서 보호 컨텐츠 렌더.
export default function Login({ onSuccess }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async e => {
    e.preventDefault()
    setBusy(true); setErr('')
    try { await login(pw); onSuccess?.() }
    catch (e2) { setErr(e2.message || '로그인 실패'); setBusy(false) }
  }

  return (
    <div className="app">
      <div className="login-wrap">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: 20 }}>
          <div className="brand-mark">🏆</div>
          <div>
            <div className="brand-title">토너먼트 메이커</div>
            <div className="brand-sub">관리자 로그인</div>
          </div>
        </div>
        <form className="card" onSubmit={submit} style={{ marginBottom: 12 }}>
          <div className="field"><label>관리자 비밀번호</label>
            <input className="input" type="password" value={pw} autoFocus autoComplete="current-password"
              onChange={e => setPw(e.target.value)} placeholder="비밀번호 입력" /></div>
          {err && <div className="login-err">⚠️ {err}</div>}
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy || !pw}>
            {busy ? '확인 중…' : '로그인'}</button>
        </form>
        <p className="muted small" style={{ textAlign: 'center' }}>
          관리자만 접근할 수 있어요. 관전은 운영자가 공유한 참가자 링크로 들어가세요.
        </p>
      </div>
    </div>
  )
}
