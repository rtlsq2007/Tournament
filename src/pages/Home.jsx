import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTournament } from '../lib/api.js'

const SPORTS = [
  { key: 'badminton', ico: '🏸', label: '배드민턴', ready: true },
  { key: 'soccer', ico: '⚽', label: '축구', ready: false },
  { key: 'basketball', ico: '🏀', label: '농구', ready: false },
  { key: 'volleyball', ico: '🏐', label: '배구', ready: false },
]
const FORMATS = [
  { key: 'single_elim', label: '싱글 엘리미네이션', ready: true },
  { key: 'group_knockout', label: '조별리그→본선', ready: false },
  { key: 'round_robin', label: '전체 풀리그', ready: false },
  { key: 'gameday', label: '게임데이', ready: false },
]
const MATCH_TYPES = [
  { key: 'doubles', label: '복식' },
  { key: 'singles', label: '단식' },
  { key: 'mixed', label: '혼합복식' },
]
const PAIRING = [
  { key: 'auto', label: '자동 밸런싱' },
  { key: 'manual', label: '직접 구성' },
]
const BEST_OF = [
  { v: 1, label: '단판' },
  { v: 3, label: '3판 2선승' },
  { v: 5, label: '5판 3선승' },
]

export default function Home() {
  const nav = useNavigate()
  const [sport, setSport] = useState('badminton')
  const [name, setName] = useState('')
  const [format, setFormat] = useState('single_elim')
  const [matchType, setMatchType] = useState('doubles')
  const [pairingMode, setPairingMode] = useState('manual')
  const [bestOf, setBestOf] = useState(1)
  const [busy, setBusy] = useState(false)
  const recent = JSON.parse(localStorage.getItem('recent_tournaments') || '[]')

  const create = async () => {
    setBusy(true)
    try {
      const { id, adminToken } = await createTournament({
        name, sport, format, matchType, pairingMode,
        settings: { pointsToWin: 21, bestOf },
      })
      const list = [{ id, name, token: adminToken }, ...recent].slice(0, 10)
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
        <div className="sport-grid">
          {SPORTS.map(s => (
            <button key={s.key} className={`sport-card ${sport === s.key ? 'active' : ''}`} disabled={!s.ready}
              onClick={() => s.ready && setSport(s.key)} title={s.ready ? '' : '준비 중'}>
              <span className="sport-ico">{s.ico}</span>
              <span className="sport-name">{s.label}</span>
              {!s.ready && <span className="sport-soon">준비중</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="h2">🏸 배드민턴 대회 만들기</h2>

        <div className="field">
          <label>대회 이름</label>
          <input className="input" placeholder="예: 2026 봄 정기대회"
            value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="field">
          <label>대회 방식</label>
          <div className="seg seg-wrap">
            {FORMATS.map(f => (
              <button key={f.key} className={format === f.key ? 'active' : ''} disabled={!f.ready}
                onClick={() => setFormat(f.key)} title={f.ready ? '' : '준비 중'}>
                {f.label}{!f.ready && ' ·준비중'}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>경기 종류</label>
          <div className="seg">
            {MATCH_TYPES.map(m => (
              <button key={m.key} className={matchType === m.key ? 'active' : ''}
                onClick={() => setMatchType(m.key)}>{m.label}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>{matchType === 'singles' ? '매칭 밸런싱' : '팀 구성'}</label>
          <div className="seg">
            {PAIRING.map(p => (
              <button key={p.key} className={pairingMode === p.key ? 'active' : ''}
                onClick={() => setPairingMode(p.key)}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>경기 방식</label>
          <div className="seg">
            {BEST_OF.map(b => (
              <button key={b.v} className={bestOf === b.v ? 'active' : ''}
                onClick={() => setBestOf(b.v)}>{b.label}</button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-lg" style={{ marginTop: 'var(--sp-4)' }}
          onClick={create} disabled={busy}>
          {busy ? '생성 중…' : '대회 생성 →'}
        </button>
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
