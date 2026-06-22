import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { getTournament } from '../lib/api.js'
import { getFormat, FORMAT_LABELS } from '../formats/index.js'
import { pairTeams } from '../lib/balancer.js'
import Bracket from '../components/Bracket.jsx'
import ParticipantsTab from '../components/admin/ParticipantsTab.jsx'

const TABS = [
  { key: 'info', label: '기본정보', ico: '⚙️' },
  { key: 'players', label: '참가자', ico: '👥' },
  { key: 'results', label: '경기결과', ico: '📋' },
  { key: 'share', label: '공유', ico: '🔗' },
]

const ROUND_NAME = (idx, total) => {
  const fromEnd = total - idx
  if (fromEnd === 1) return '결승전'
  if (fromEnd === 2) return '준결승'
  if (fromEnd === 3) return '8강'
  return `${idx + 1}라운드`
}

function demoData() {
  const participants = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`, name: `Player${i + 1}`, tier: 5 - (i % 5), gender: 'M', checkedIn: true,
  }))
  return {
    name: '데모 대회', format: 'single_elim', matchType: 'singles', pairingMode: 'auto',
    status: 'in_progress', settings: { pointsToWin: 21, bestOf: 1, courts: 2 }, participants,
  }
}

export default function AdminView() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const demo = sp.get('demo') === '1'
  const [tab, setTab] = useState('players')
  const [data, setData] = useState(null)
  const [participants, setParticipants] = useState([])
  const [work, setWork] = useState(null) // { teams, structure, matches }
  const [error, setError] = useState(null)

  useEffect(() => {
    if (demo) { const d = demoData(); setData(d); setParticipants(d.participants); return }
    getTournament(id)
      .then(res => { setData(res.data); setParticipants(res.data.participants || []) })
      .catch(e => setError(e.message))
  }, [id, demo])

  const fmt = data ? getFormat(data.format) : null

  // 참가자/설정 변경 시 팀+대진 재생성 (setup 단계). 점수 입력 후엔 참가자 변경 자제.
  useEffect(() => {
    if (!data) return
    const active = participants.filter(p => p.checkedIn)
    const teams = pairTeams(active, { matchType: data.matchType, mode: data.pairingMode })
    const gen = fmt.generate(teams, data.settings)
    setWork({ teams, structure: gen.structure, matches: gen.matches })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, data?.format, data?.matchType, data?.pairingMode])

  const onResult = (matchId, games) => {
    setWork(w => {
      const next = fmt.applyResult({ structure: w.structure, matches: w.matches }, matchId, games, data.settings)
      return { ...next, teams: w.teams }
    })
  }

  if (error) return <div className="app"><div className="card"><h2 className="h2">⚠️ {error}</h2></div></div>
  if (!data || !work) return <div className="app"><div className="muted">불러오는 중…</div></div>

  const publicUrl = `${window.location.origin}/t/${id}`

  return (
    <div className="editor">
      <div className="editor-top">
        <div className="brand">
          <div className="brand-mark" style={{ width: 34, height: 34, fontSize: 18 }}>🏸</div>
          <div>
            <div className="brand-title" style={{ fontSize: 15 }}>{data.name || '새 대회'}</div>
            <div className="brand-sub">{FORMAT_LABELS[data.format]} · {work.teams.length}팀</div>
          </div>
        </div>
        <a className="btn btn-primary" href={publicUrl} target="_blank" rel="noreferrer">참가자 화면 ↗</a>
      </div>

      <nav className="editor-rail">
        {TABS.map(t => (
          <button key={t.key} className={`rail-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            <span className="ico">{t.ico}</span>{t.label}
          </button>
        ))}
      </nav>

      <section className="editor-panel">
        {tab === 'info' && (
          <div>
            <div className="panel-title">기본 정보</div>
            <div className="panel-hint">대회 이름과 표시 옵션을 설정합니다.</div>
            <div className="field">
              <label>대회명</label>
              <input className="input" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} />
            </div>
            <div className="field">
              <label>대회 방식</label>
              <input className="input" value={FORMAT_LABELS[data.format]} disabled />
            </div>
            <div className="row" style={{ gap: 16 }}>
              <div className="badge">{data.matchType === 'singles' ? '단식' : data.matchType === 'mixed' ? '혼합복식' : '복식'}</div>
              <div className="badge">{data.settings.bestOf === 1 ? '단판' : `${data.settings.bestOf}판`}</div>
              <div className="badge">코트 {data.settings.courts}</div>
            </div>
          </div>
        )}

        {tab === 'players' && (
          <ParticipantsTab participants={participants} setParticipants={setParticipants} matchType={data.matchType} />
        )}

        {tab === 'results' && (
          <div>
            <div className="panel-title">경기 결과 등록</div>
            <div className="panel-hint">진행 중인 경기의 점수를 입력하면 대진표가 자동 갱신됩니다.</div>
            {work.structure.rounds.map((round, ri) => (
              <div className="rgroup" key={ri}>
                <div className="rg-title">{ROUND_NAME(ri, work.structure.rounds.length)}</div>
                {round.map(mid => {
                  const m = work.matches.find(x => x.id === mid)
                  if (!m.teamA && !m.teamB) return null
                  return <ResultCard key={mid} match={m} teams={work.teams} bestOf={data.settings.bestOf} onResult={onResult} />
                })}
              </div>
            ))}
          </div>
        )}

        {tab === 'share' && (
          <div>
            <div className="panel-title">공유</div>
            <div className="panel-hint">참가자에게 아래 링크를 공유하면 진행 상황만 실시간으로 볼 수 있습니다.</div>
            <div className="field">
              <label>공개 URL (읽기 전용)</label>
              <div className="row">
                <input className="input" value={publicUrl} readOnly />
                <button className="btn" onClick={() => navigator.clipboard?.writeText(publicUrl)}>복사</button>
              </div>
            </div>
            <div style={{ display: 'grid', placeItems: 'center', padding: 16, background: '#fff', borderRadius: 'var(--r-ctrl)', width: 'fit-content', margin: '0 auto' }}>
              <QRCodeCanvas value={publicUrl} size={156} />
            </div>
            <div className="muted small" style={{ textAlign: 'center', marginTop: 8 }}>참가자들이 QR을 스캔해 입장</div>
          </div>
        )}
      </section>

      <div className="editor-bracket">
        <Bracket state={{ structure: work.structure, matches: work.matches }} teams={work.teams} />
      </div>
    </div>
  )
}

function ResultCard({ match, teams, bestOf, onResult }) {
  const label = id => teams.find(t => t.id === id)?.label || '–'
  const init = match.games?.length ? match.games[0] : { a: '', b: '' }
  const [a, setA] = useState(init.a)
  const [b, setB] = useState(init.b)
  const ready = match.teamA && match.teamB
  const submit = () => {
    const ga = Number(a), gb = Number(b)
    if (!Number.isFinite(ga) || !Number.isFinite(gb)) return
    onResult(match.id, [{ a: ga, b: gb }])
  }
  return (
    <div className="gcard">
      <div className="gc-head">{ready ? '클릭해서 점수 입력' : '상대 미정'}</div>
      <div className="gc-row">
        <span className="gc-name">{label(match.teamA)}</span>
        <input className="gc-score-in" value={a} onChange={e => setA(e.target.value)} disabled={!ready} />
        <span className="muted">:</span>
        <input className="gc-score-in" value={b} onChange={e => setB(e.target.value)} disabled={!ready} />
        <span className="gc-name" style={{ textAlign: 'right' }}>{label(match.teamB)}</span>
      </div>
      {ready && <button className="btn btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={submit}>
        {match.status === 'done' ? '점수 수정' : '결과 저장'}</button>}
    </div>
  )
}
