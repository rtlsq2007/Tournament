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
const FORMATS = [
  { key: 'single_elim', label: '토너먼트', ready: true },
  { key: 'group_knockout', label: '조별→본선', ready: false },
  { key: 'round_robin', label: '풀리그', ready: false },
  { key: 'gameday', label: '게임데이', ready: false },
]
const MATCH_TYPES = [{ key: 'doubles', label: '복식' }, { key: 'singles', label: '단식' }, { key: 'mixed', label: '혼복' }]
const PAIRING = [{ key: 'auto', label: '자동 밸런싱' }, { key: 'manual', label: '직접 구성' }]
const BEST_OF = [{ v: 1, label: '단판' }, { v: 3, label: '3판2선' }, { v: 5, label: '5판3선' }]
const roundName = n => (n === 2 ? '결승' : n === 4 ? '준결승' : `${n}강`)

function demoData() {
  const participants = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`, name: `선수${i + 1}`, tier: 5 - (i % 5), gender: 'M', checkedIn: true,
  }))
  return {
    name: '데모 대회', format: 'single_elim', matchType: 'doubles', pairingMode: 'auto',
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
  const [teams, setTeams] = useState([])
  const [work, setWork] = useState(null) // { structure, matches }
  const [error, setError] = useState(null)

  useEffect(() => {
    if (demo) { const d = demoData(); setData(d); setParticipants(d.participants); return }
    getTournament(id)
      .then(res => { setData(res.data); setParticipants(res.data.participants || []) })
      .catch(e => setError(e.message))
  }, [id, demo])

  // 참가자/설정 → 팀 자동 구성 (직접 구성 시에도 초기 팀은 자동 생성 후 드래그로 조정)
  useEffect(() => {
    if (!data) return
    const active = participants.filter(p => p.checkedIn)
    setTeams(pairTeams(active, { matchType: data.matchType, mode: data.pairingMode }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, data?.matchType, data?.pairingMode])

  // 팀 → 대진표 생성
  useEffect(() => {
    if (!data) return
    if (!teams.length) { setWork({ structure: { rounds: [] }, matches: [] }); return }
    const fmt = getFormat(data.format)
    const gen = fmt.generate(teams, data.settings)
    setWork({ structure: gen.structure, matches: gen.matches })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, data?.format, data?.settings?.bestOf])

  const onResult = (matchId, games) => {
    const fmt = getFormat(data.format)
    setWork(w => {
      const next = fmt.applyResult({ structure: w.structure, matches: w.matches }, matchId, games, data.settings)
      return { structure: next.structure, matches: next.matches }
    })
  }

  if (error) return <div className="app"><div className="card"><h2 className="h2">⚠️ {error}</h2></div></div>
  if (!data || !work) return <div className="app"><div className="muted">불러오는 중…</div></div>

  const publicUrl = `${window.location.origin}/t/${id}`
  const setSetting = patch => setData({ ...data, settings: { ...data.settings, ...patch } })

  return (
    <div className="editor">
      <div className="editor-top">
        <div className="brand">
          <div className="brand-mark" style={{ width: 34, height: 34, fontSize: 18 }}>🏸</div>
          <div>
            <div className="brand-title" style={{ fontSize: 15 }}>{data.name || '새 대회'}</div>
            <div className="brand-sub">{FORMAT_LABELS[data.format]} · {teams.length}팀</div>
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
            <div className="panel-hint">대회 방식과 규칙을 설정합니다. 변경하면 대진표가 새로 구성됩니다.</div>
            <div className="field"><label>대회명</label>
              <input className="input" value={data.name} onChange={e => setData({ ...data, name: e.target.value })} /></div>
            <div className="field"><label>대회 방식</label>
              <div className="seg seg-wrap">
                {FORMATS.map(f => (
                  <button key={f.key} disabled={!f.ready} className={data.format === f.key ? 'active' : ''}
                    onClick={() => setData({ ...data, format: f.key })}>{f.label}{!f.ready && '·준비중'}</button>
                ))}
              </div></div>
            <div className="field"><label>경기 종류</label>
              <div className="seg">{MATCH_TYPES.map(m => (
                <button key={m.key} className={data.matchType === m.key ? 'active' : ''}
                  onClick={() => setData({ ...data, matchType: m.key })}>{m.label}</button>))}</div></div>
            <div className="field"><label>팀 구성</label>
              <div className="seg">{PAIRING.map(p => (
                <button key={p.key} className={data.pairingMode === p.key ? 'active' : ''}
                  onClick={() => setData({ ...data, pairingMode: p.key })}>{p.label}</button>))}</div></div>
            <div className="field"><label>경기 방식</label>
              <div className="seg">{BEST_OF.map(b => (
                <button key={b.v} className={data.settings.bestOf === b.v ? 'active' : ''}
                  onClick={() => setSetting({ bestOf: b.v })}>{b.label}</button>))}</div></div>
            <div className="row-between">
              <label className="small" style={{ fontWeight: 600, color: 'var(--text-muted)' }}>코트 수</label>
              <div className="count-pill">
                <button onClick={() => setSetting({ courts: Math.max(1, data.settings.courts - 1) })}>−</button>
                <span>{data.settings.courts}</span>
                <button onClick={() => setSetting({ courts: Math.min(12, data.settings.courts + 1) })}>＋</button>
              </div>
            </div>
          </div>
        )}

        {tab === 'players' && (
          <ParticipantsTab participants={participants} setParticipants={setParticipants}
            teams={teams} setTeams={setTeams} matchType={data.matchType} />
        )}

        {tab === 'results' && (
          <div>
            <div className="panel-title">경기 결과 등록</div>
            <div className="panel-hint">승자를 선택하면 다음 강으로 자동 진출합니다. 정확한 점수도 입력할 수 있습니다.</div>
            {work.structure.rounds.map((round, ri) => (
              <div className="rgroup" key={ri}>
                <div className="rg-title">{roundName(round.length * 2)}</div>
                {round.map(mid => {
                  const m = work.matches.find(x => x.id === mid)
                  if (!m.teamA && !m.teamB) return null
                  return <ResultCard key={mid} match={m} teams={teams} pointsToWin={data.settings.pointsToWin} onResult={onResult} />
                })}
              </div>
            ))}
          </div>
        )}

        {tab === 'share' && (
          <div>
            <div className="panel-title">공유</div>
            <div className="panel-hint">참가자에게 아래 링크를 공유하면 진행 상황만 실시간으로 볼 수 있습니다.</div>
            <div className="field"><label>공개 URL (읽기 전용)</label>
              <div className="row">
                <input className="input" value={publicUrl} readOnly />
                <button className="btn" onClick={() => navigator.clipboard?.writeText(publicUrl)}>복사</button>
              </div></div>
            <div style={{ display: 'grid', placeItems: 'center', padding: 16, background: '#fff', borderRadius: 'var(--r-ctrl)', width: 'fit-content', margin: '0 auto' }}>
              <QRCodeCanvas value={publicUrl} size={156} />
            </div>
            <div className="muted small" style={{ textAlign: 'center', marginTop: 8 }}>참가자들이 QR을 스캔해 입장</div>
          </div>
        )}
      </section>

      <div className="editor-bracket">
        <Bracket state={work} teams={teams} />
      </div>
    </div>
  )
}

function ResultCard({ match, teams, pointsToWin, onResult }) {
  const label = id => teams.find(t => t.id === id)?.label || '–'
  const init = match.games?.length ? match.games[0] : { a: '', b: '' }
  const [a, setA] = useState(init.a)
  const [b, setB] = useState(init.b)
  const ready = match.teamA && match.teamB

  const pick = side => onResult(match.id, side === 'A' ? [{ a: pointsToWin, b: 0 }] : [{ a: 0, b: pointsToWin }])
  const saveScore = () => {
    const ga = Number(a), gb = Number(b)
    if (!Number.isFinite(ga) || !Number.isFinite(gb) || ga === gb) return
    onResult(match.id, [{ a: ga, b: gb }])
  }

  return (
    <div className="gcard">
      <div className="gc-head">{ready ? '승자 선택 또는 점수 입력' : '상대 미정'}</div>
      <div className="gc-row">
        <span className="gc-name">{label(match.teamA)}</span>
        <input className="gc-score-in" value={a} onChange={e => setA(e.target.value)} disabled={!ready} />
        <span className="muted">:</span>
        <input className="gc-score-in" value={b} onChange={e => setB(e.target.value)} disabled={!ready} />
        <span className="gc-name" style={{ textAlign: 'right' }}>{label(match.teamB)}</span>
      </div>
      {ready && (
        <>
          <div className="win-pick">
            <button className={match.winner === match.teamA ? 'chosen' : ''} onClick={() => pick('A')}>◀ {label(match.teamA)} 승</button>
            <button className={match.winner === match.teamB ? 'chosen' : ''} onClick={() => pick('B')}>{label(match.teamB)} 승 ▶</button>
          </div>
          <button className="btn" style={{ width: '100%', marginTop: 8 }} onClick={saveScore}>점수로 저장</button>
        </>
      )}
    </div>
  )
}
