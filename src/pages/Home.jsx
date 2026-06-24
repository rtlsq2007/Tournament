import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTournament } from '../lib/api.js'

const SPORTS = [
  { key: 'badminton', ico: '🏸', label: '배드민턴', ready: true },
  { key: 'soccer', ico: '⚽', label: '축구', ready: false },
  { key: 'basketball', ico: '🏀', label: '농구', ready: false },
  { key: 'volleyball', ico: '🏐', label: '배구', ready: false },
]

export default function Home() {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const recent = JSON.parse(localStorage.getItem('recent_tournaments') || '[]')

  const start = async sport => {
    setBusy(true)
    try {
      // 기본값으로 대회 생성 → 상세 설정은 편집기(경기정보 탭)에서
      const { id, adminToken } = await createTournament({
        name: '', sport,
        format: 'single_elim', matchType: 'doubles', pairingMode: 'manual',
        settings: { pointsToWin: 21, bestOf: 1 },
      })
      const list = [{ id, name: '', token: adminToken }, ...recent].slice(0, 10)
      localStorage.setItem('recent_tournaments', JSON.stringify(list))
      nav(`/t/${id}/admin?token=${adminToken}`)
    } catch (e) {
      alert('대회 생성 실패: ' + e.message)
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">🏆</div>
          <div>
            <div className="brand-title">토너먼트 메이커</div>
            <div className="brand-sub">대진 · 점수 · 실시간 관전</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="h2">어떤 종목의 대진표를 만들까요?</h2>
        <p className="panel-hint">종목을 선택하면 대회가 만들어지고, 상세 설정은 다음 화면(경기정보)에서 할 수 있어요.</p>
        <div className="sport-grid">
          {SPORTS.map(s => (
            <button key={s.key} className="sport-card" disabled={!s.ready || busy}
              onClick={() => s.ready && start(s.key)} title={s.ready ? '' : '준비 중'}>
              <span className="sport-ico">{s.ico}</span>
              <span className="sport-name">{s.label}</span>
              {!s.ready && <span className="sport-soon">준비중</span>}
            </button>
          ))}
        </div>
        {busy && <p className="muted small" style={{ marginTop: 10 }}>대회 만드는 중…</p>}
      </div>

      {recent.length > 0 && (
        <div className="card">
          <h2 className="h2">최근 대회 <span className="muted small">운영자</span></h2>
          {recent.map(r => (
            <a key={r.id} className="recent-row" href={`/t/${r.id}/admin?token=${r.token}`}>
              <span>{r.name || '(이름 없음)'}</span>
              <span className="meta">{r.id} →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
