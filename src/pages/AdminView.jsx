import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { getTournament } from '../lib/api.js'
import { getFormat, FORMAT_LABELS } from '../formats/index.js'
import { pairTeams } from '../lib/balancer.js'
import Bracket from '../components/Bracket.jsx'
import ParticipantsTab from '../components/admin/ParticipantsTab.jsx'

const TABS = [
  { key: 'info', label: '경기정보', ico: '⚙️' },
  { key: 'players', label: '참가자', ico: '👥' },
  { key: 'results', label: '경기판정', ico: '📋' },
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

function demoData() {
  const participants = Array.from({ length: 10 }, (_, i) => ({
    id: `p${i + 1}`, name: `선수${i + 1}`, tier: 5 - (i % 5), gender: 'M', checkedIn: true,
  }))
  return {
    name: '데모 대회', format: 'single_elim', matchType: 'doubles', pairingMode: 'manual',
    status: 'in_progress', settings: { pointsToWin: 21, bestOf: 1, courts: 2 }, participants,
  }
}

let _tseq = 0
const newTeamId = () => `t${Date.now().toString(36)}_${++_tseq}`

// 기존 팀을 유지한 채 명단 변화만 반영 (삭제된 선수만 빼고, 새 선수만 채움). 전체 재페어링 X.
function reconcileTeams(prev, active, matchType) {
  const activeIds = new Set(active.map(p => p.id))
  const tierOf = id => active.find(p => p.id === id)?.tier || 0
  const cap = matchType === 'singles' ? 1 : 2
  let next = prev
    .map(t => ({ ...t, playerIds: t.playerIds.filter(id => activeIds.has(id)) }))
    .filter(t => t.playerIds.length > 0)
  const assigned = new Set(next.flatMap(t => t.playerIds))
  for (const p of active) {
    if (assigned.has(p.id)) continue
    const open = next.find(t => t.playerIds.length < cap)
    if (open) open.playerIds = [...open.playerIds, p.id]
    else next = [...next, { id: newTeamId(), label: '', playerIds: [p.id] }]
    assigned.add(p.id)
  }
  return next.map((t, i) => ({ ...t, no: i + 1, tierSum: t.playerIds.reduce((s, id) => s + tierOf(id), 0) }))
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
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (demo) { const d = demoData(); setData(d); setParticipants(d.participants); return }
    getTournament(id)
      .then(res => { setData(res.data); setParticipants(res.data.participants || []) })
      .catch(e => setError(e.message))
  }, [id, demo])

  // 참가자 '구성'이 바뀔 때만 팀 재구성 (인원 추가/삭제·종목·구성방식).
  // 이름/티어만 바뀐 경우(=ID 집합 동일)엔 재구성하지 않아 팀명·드래그 배치가 유지됨.
  const cfgRef = useRef(null)
  const activeIdsKey = participants.filter(p => p.checkedIn).map(p => p.id).join(',')
  useEffect(() => {
    if (!data) return
    const active = participants.filter(p => p.checkedIn)
    const cfg = `${data.matchType}|${data.pairingMode}`
    const cfgChanged = cfgRef.current !== null && cfgRef.current !== cfg
    cfgRef.current = cfg
    // 종목/구성방식 변경(또는 최초) → 전체 재페어링. 그 외(선수 추가/삭제) → 기존 팀 유지하며 증분 반영.
    setTeams(prev => (prev.length === 0 || cfgChanged)
      ? pairTeams(active, { matchType: data.matchType, mode: data.pairingMode })
      : reconcileTeams(prev, active, data.matchType))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdsKey, data?.matchType, data?.pairingMode])

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
  const onPick = (matchId, teamId) => {
    const fmt = getFormat(data.format)
    setWork(w => {
      const next = fmt.pickWinner({ structure: w.structure, matches: w.matches }, matchId, teamId, data.settings)
      return { structure: next.structure, matches: next.matches }
    })
  }

  const pTier = id => participants.find(p => p.id === id)?.tier || 0
  // 선수 스왑(다른 팀과 자리 교체) — 참가자 탭/대진표 공용
  const swapPlayers = (a, b) => setTeams(prev => prev.map(t => {
    if (!t.playerIds.includes(a) && !t.playerIds.includes(b)) return t
    const ids = t.playerIds.map(id => id === a ? b : id === b ? a : id)
    return { ...t, playerIds: ids, tierSum: ids.reduce((s, id) => s + pTier(id), 0) }
  }))
  // 팀 위치 스왑(대진 상대 바꾸기)
  const swapTeams = (a, b) => setTeams(prev => {
    const arr = [...prev]
    const ia = arr.findIndex(t => t.id === a), ib = arr.findIndex(t => t.id === b)
    if (ia < 0 || ib < 0) return prev
    ;[arr[ia], arr[ib]] = [arr[ib], arr[ia]]
    return arr
  })
  // 선수 완전 삭제 (명단에서 제거 → 팀 재구성)
  const deletePlayer = id => setParticipants(prev => prev.filter(p => p.id !== id))

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
            <div className="panel-title">경기 정보</div>
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
            <div className="field"><label>{data.matchType === 'singles' ? '매칭 밸런싱' : '팀 구성'}</label>
              <div className="seg">{PAIRING.map(p => (
                <button key={p.key} className={data.pairingMode === p.key ? 'active' : ''}
                  onClick={() => setData({ ...data, pairingMode: p.key })}>{p.label}</button>))}</div></div>
            <div className="field"><label>경기 방식</label>
              <div className="seg">{BEST_OF.map(b => (
                <button key={b.v} className={data.settings.bestOf === b.v ? 'active' : ''}
                  onClick={() => setSetting({ bestOf: b.v })}>{b.label}</button>))}</div></div>
          </div>
        )}

        {tab === 'players' && (
          <ParticipantsTab participants={participants} setParticipants={setParticipants}
            teams={teams} setTeams={setTeams} matchType={data.matchType}
            swapPlayers={swapPlayers} swapTeams={swapTeams} deletePlayer={deletePlayer} />
        )}

        {tab === 'results' && (
          <div>
            <div className="panel-title">경기 판정</div>
            <div className="panel-hint">승자를 선택하면 다음 강으로 자동 진출합니다. 정확한 점수도 입력할 수 있습니다.</div>
            {work.structure.rounds.map((round, ri) => (
              <div className="rgroup" key={ri}>
                <div className="rg-title">{work.structure.labels[ri]}</div>
                {round.map(mid => {
                  const m = work.matches.find(x => x.id === mid)
                  return <ResultCard key={mid} match={m} teams={teams} participants={participants} onResult={onResult} onPick={onPick} />
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
        <div className="bracket-toolbar">
          <span className="muted small" style={{ fontWeight: 600 }}>대진표 크기</span>
          <input type="range" className="zoom-range" min="0.4" max="1.5" step="0.05"
            value={zoom} onChange={e => setZoom(Number(e.target.value))} />
          <span className="muted small" style={{ minWidth: 42, textAlign: 'right', fontWeight: 600 }}>{Math.round(zoom * 100)}%</span>
        </div>
        <Bracket state={work} teams={teams} participants={participants} editable swapPlayers={swapPlayers} deletePlayer={deletePlayer} zoom={zoom} teamMode={data.matchType !== 'singles'} />
      </div>
    </div>
  )
}

function ResultCard({ match, teams, participants, onResult, onPick }) {
  const label = id => {
    const t = teams.find(x => x.id === id)
    if (!t) return '미정'
    if (t.playerIds.length > 1) return t.label?.trim() || `${t.no}팀` // 복식: 팀명
    return participants.find(p => p.id === t.playerIds[0])?.name || '?' // 단식: 선수명
  }
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  // 저장된 점수와 입력칸 동기화 (대진표/카드에서 점수가 유지되도록)
  useEffect(() => {
    const g = match.games?.length ? match.games[0] : { a: '', b: '' }
    setA(g.a); setB(g.b)
  }, [match.games])

  const ready = match.teamA && match.teamB
  const loneA = match.teamA && !match.teamB && match.srcB == null // 상대 없는 경기

  // 점수 입력 → 자동 반영(별도 저장 버튼 없음). 두 값이 유효하고 서로 다르면 적용.
  const applyScore = () => {
    if (!ready) return
    const ga = Number(a), gb = Number(b)
    if (a === '' || b === '' || !Number.isFinite(ga) || !Number.isFinite(gb) || ga === gb) return
    onResult(match.id, [{ a: ga, b: gb }])
  }

  const head = ready ? '승자 선택 또는 점수 입력'
    : loneA ? '상대 없음 — 부전승 가능'
    : (match.srcA?.match || match.srcB?.match) ? '이전 경기 결과 대기' : '상대 미정'

  return (
    <div className="gcard">
      <div className="gc-head">{head}</div>
      <div className="gc-row">
        <span className="gc-name">{label(match.teamA)}</span>
        <input className="gc-score-in" value={a} disabled={!ready}
          onChange={e => setA(e.target.value)} onBlur={applyScore}
          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
        <span className="muted">:</span>
        <input className="gc-score-in" value={b} disabled={!ready}
          onChange={e => setB(e.target.value)} onBlur={applyScore}
          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
        <span className="gc-name" style={{ textAlign: 'right' }}>{match.teamB ? label(match.teamB) : '—'}</span>
      </div>
      {ready && (
        <div className="win-pick">
          <button className={match.winner === match.teamA ? 'chosen' : ''} onClick={() => onPick(match.id, match.teamA)}>◀ {label(match.teamA)} 승</button>
          <button className={match.winner === match.teamB ? 'chosen' : ''} onClick={() => onPick(match.id, match.teamB)}>{label(match.teamB)} 승 ▶</button>
        </div>
      )}
      {loneA && (
        <button className={`btn ${match.winner ? 'btn-primary' : ''}`} style={{ width: '100%', marginTop: 8 }}
          onClick={() => onPick(match.id, match.teamA)}>부전승 진출 →</button>
      )}
    </div>
  )
}
