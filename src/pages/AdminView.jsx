import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { getTournament, putTournament, getMembers, putMembers, getRecords, putRecords } from '../lib/api.js'
import { getFormat, FORMAT_LABELS } from '../formats/index.js'
import { pairTeams } from '../lib/balancer.js'
import { todayName } from '../lib/date.js'
import Bracket from '../components/Bracket.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import ParticipantsTab from '../components/admin/ParticipantsTab.jsx'
import ClubTab from '../components/admin/ClubTab.jsx'

const TABS = [
  { key: 'info', label: '경기정보', ico: '⚙️' },
  { key: 'players', label: '참가자', ico: '👥' },
  { key: 'results', label: '경기판정', ico: '📋' },
  { key: 'record', label: '경기기록', ico: '📜' },
  { key: 'club', label: '라켓단', ico: '📇' },
  { key: 'share', label: '공유', ico: '🔗' },
]
const FORMATS = [
  { key: 'single_elim', label: '토너먼트', ready: true },
  { key: 'group_knockout', label: '조별→본선', ready: false },
  { key: 'round_robin', label: '풀리그', ready: false },
  { key: 'gameday', label: '게임데이', ready: false },
]
const MATCH_TYPES = [{ key: 'doubles', label: '복식' }, { key: 'singles', label: '단식' }, { key: 'mixed', label: '혼복' }]
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
  const token = sp.get('token')
  const [tab, setTab] = useState('players')
  const [data, setData] = useState(null)
  const [participants, setParticipants] = useState([])
  const [teams, setTeams] = useState([])
  const [work, setWork] = useState(null) // { structure, matches }
  const [error, setError] = useState(null)
  const [zoom, setZoom] = useState(1)
  const bracketBoxRef = useRef(null) // Ctrl+휠로 대진표만 줌
  const skipReconcileRef = useRef(false) // 로드 직후 팀 재구성 1회 스킵
  const skipWorkRef = useRef(false)      // 로드 직후 대진 재생성 1회 스킵
  const baseUpdatedAtRef = useRef(0)     // 낙관적 동시성 기준
  const [members, setMembers] = useState(null) // 라켓단 멤버(동아리 공용)
  const memberFirstRef = useRef(true)

  // 라켓단 멤버 로드 (데모/실서버 공통, 백엔드 있으면)
  useEffect(() => { getMembers().then(setMembers).catch(() => setMembers([])) }, [])
  // 멤버 변경 자동 저장 (최초 로드 제외)
  useEffect(() => {
    if (members === null) return
    if (memberFirstRef.current) { memberFirstRef.current = false; return }
    const t = setTimeout(() => { putMembers(members).catch(() => {}) }, 800)
    return () => clearTimeout(t)
  }, [members])

  useEffect(() => {
    if (demo) { const d = demoData(); setData(d); setParticipants(d.participants); return }
    getTournament(id)
      .then(res => {
        const d = res.data
        setData({ ...d, name: d.name || todayName() }) // 대회명 비어있으면 오늘 날짜 기본
        setParticipants(d.participants || [])
        baseUpdatedAtRef.current = res.updatedAt || 0
        if (d.teams?.length) { // 저장된 팀/대진이 있으면 그대로 복원 (재구성/재생성 스킵)
          skipReconcileRef.current = true
          skipWorkRef.current = true
          setTeams(d.teams)
          setWork({ structure: d.structure || { rounds: [], labels: [] }, matches: d.matches || [] })
        }
      })
      .catch(e => setError(e.message))
  }, [id, demo])

  // 변경 자동 저장 (디바운스). 데모/토큰없음 제외.
  useEffect(() => {
    if (demo || !data || !token || !work) return
    const t = setTimeout(() => {
      const payload = {
        name: data.name, sport: data.sport, format: data.format, matchType: data.matchType, pairingMode: data.pairingMode,
        status: data.status, settings: data.settings, records: data.records || [],
        participants, teams, structure: work.structure, matches: work.matches,
      }
      putTournament(id, token, payload, data.name, baseUpdatedAtRef.current)
        .then(res => { baseUpdatedAtRef.current = res.updatedAt })
        .catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [data, participants, teams, work, demo, token, id])

  // 참가자 '구성'이 바뀔 때만 팀 재구성 (인원 추가/삭제·종목·구성방식).
  // 이름/티어만 바뀐 경우(=ID 집합 동일)엔 재구성하지 않아 팀명·드래그 배치가 유지됨.
  const cfgRef = useRef(null)
  const activeIdsKey = participants.filter(p => p.checkedIn).map(p => p.id).join(',')
  useEffect(() => {
    if (!data) return
    if (skipReconcileRef.current) { skipReconcileRef.current = false; cfgRef.current = `${data.matchType}|${data.pairingMode}`; return }
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
    if (skipWorkRef.current) { skipWorkRef.current = false; return }
    if (!teams.length) { setWork({ structure: { rounds: [], labels: [] }, matches: [] }); return }
    const fmt = getFormat(data.format)
    const gen = fmt.generate(teams, data.settings)
    setWork({ structure: gen.structure, matches: gen.matches })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, data?.format, data?.settings?.bestOf, data?.settings?.thirdPlace])

  // Ctrl+휠: 페이지 전체가 아니라 대진표만 확대/축소 (브라우저 줌 가로채기)
  useEffect(() => {
    const el = bracketBoxRef.current
    if (!el) return
    const onWheel = e => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoom(z => Math.min(1.5, Math.max(0.4, +(z * (e.deltaY < 0 ? 1.08 : 0.92)).toFixed(3))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [data, work])

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
  // 결승 세트수(bestOf) 조정 — 결승 경기에만 적용
  const onSetBestOf = (matchId, bestOf) => {
    const fmt = getFormat(data.format)
    setWork(w => {
      const next = fmt.setMatchBestOf({ structure: w.structure, matches: w.matches }, matchId, bestOf, data.settings)
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
      <ThemeToggle admin />{/* 참가자 화면 버튼 아래 코너에 배치 */}

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
            <div className="field"><label>경기 방식</label>
              <div className="seg">{BEST_OF.map(b => (
                <button key={b.v} className={data.settings.bestOf === b.v ? 'active' : ''}
                  onClick={() => setSetting({ bestOf: b.v })}>{b.label}</button>))}</div>
              <div className="panel-hint" style={{ margin: '2px 0 0' }}>결승만 다른 세트수로 하려면 ‘경기판정’ 탭의 결승에서 조정할 수 있어요.</div></div>
            <div className="field"><label>패자전</label>
              <label className="check-row">
                <input type="checkbox" checked={!!data.settings.thirdPlace}
                  onChange={e => setSetting({ thirdPlace: e.target.checked })} />
                <span>3·4위전 진행 <span className="muted small">· 준결승 패자끼리 동메달 결정전</span></span>
              </label></div>
          </div>
        )}

        {tab === 'players' && (
          <ParticipantsTab participants={participants} setParticipants={setParticipants}
            teams={teams} setTeams={setTeams} matchType={data.matchType} members={members || []}
            swapPlayers={swapPlayers} swapTeams={swapTeams} deletePlayer={deletePlayer} />
        )}

        {tab === 'club' && <ClubTab members={members} setMembers={setMembers} />}

        {tab === 'results' && (() => {
          const finalId = work.structure.rounds.at(-1)?.[0]
          const tpId = work.structure.thirdPlace
          const tpMatch = tpId && work.matches.find(x => x.id === tpId)
          return (
          <div>
            <div className="panel-title">경기 판정</div>
            <div className="panel-hint">승자를 선택하면 다음 강으로 자동 진출합니다. 정확한 점수도 입력할 수 있습니다.</div>
            {work.structure.rounds.map((round, ri) => (
              <div className="rgroup" key={ri}>
                <div className="rg-title">{work.structure.labels[ri]}</div>
                {round.map(mid => {
                  const m = work.matches.find(x => x.id === mid)
                  return <ResultCard key={mid} match={m} teams={teams} participants={participants}
                    bestOf={data.settings.bestOf} isFinal={mid === finalId}
                    onResult={onResult} onPick={onPick} onSetBestOf={onSetBestOf} />
                })}
              </div>
            ))}
            {tpMatch && (
              <div className="rgroup">
                <div className="rg-title">🥉 3·4위전</div>
                <ResultCard match={tpMatch} teams={teams} participants={participants}
                  bestOf={data.settings.bestOf} onResult={onResult} onPick={onPick} />
              </div>
            )}
          </div>
          )
        })()}

        {tab === 'record' && (
          <RecordView data={data} setData={setData} teams={teams} participants={participants} work={work} tournamentId={id} />
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

      <div className="editor-bracket" ref={bracketBoxRef}>
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

function ResultCard({ match, teams, participants, bestOf, isFinal = false, onResult, onPick, onSetBestOf }) {
  const label = id => {
    const t = teams.find(x => x.id === id)
    if (!t) return '미정'
    if (t.playerIds.length > 1) return t.label?.trim() || `${t.no}팀` // 복식: 팀명
    return participants.find(p => p.id === t.playerIds[0])?.name || '?' // 단식: 선수명
  }
  const eff = match.bestOf || bestOf // 매치별 세트수 override(결승 조정) 우선
  const need = Math.floor(eff / 2) + 1
  const [sets, setSets] = useState(() => (match.games || []).map(g => ({ a: String(g.a), b: String(g.b) })))
  const getSet = i => sets[i] || { a: '', b: '' }

  // 조기 종료: 한 팀이 need 세트를 먼저 따면 그 세트까지만 표시(남은 세트 숨김)
  const rows = (() => {
    if (eff === 1) return 1
    let a = 0, b = 0
    for (let i = 0; i < sets.length; i++) {
      const x = Number(sets[i].a), y = Number(sets[i].b)
      if (sets[i].a !== '' && sets[i].b !== '' && x !== y) {
        x > y ? a++ : b++
        if (a === need || b === need) return i + 1
      }
    }
    return eff
  })()

  const ready = match.teamA && match.teamB
  const loneA = match.teamA && !match.teamB && match.srcB == null

  // 완성된 세트(양쪽 입력·동점 아님)만 결과로 반영. 점수 높은 쪽이 그 세트 획득.
  const apply = next => {
    const games = next
      .filter(s => s.a !== '' && s.b !== '' && Number(s.a) !== Number(s.b))
      .map(s => ({ a: Number(s.a), b: Number(s.b) }))
    onResult(match.id, games)
  }
  const setScore = (i, side, v) => {
    const next = sets.slice()
    while (next.length <= i) next.push({ a: '', b: '' })
    next[i] = { ...next[i], [side]: v }
    setSets(next)
    if (ready) apply(next)
  }

  const wins = sets.reduce((acc, s) => {
    const a = Number(s.a), b = Number(s.b)
    if (s.a !== '' && s.b !== '' && a !== b) (a > b ? acc.a++ : acc.b++)
    return acc
  }, { a: 0, b: 0 })

  const head = ready ? (eff === 1 ? '점수 입력 또는 승자 선택' : `${eff}판 ${need}선승 · 세트 점수`)
    : loneA ? '상대 없음 — 부전승 가능'
    : (match.srcA?.match || match.srcB?.match || match.srcA?.loserOf || match.srcB?.loserOf) ? '이전 경기 결과 대기' : '상대 미정'

  return (
    <div className="gcard">
      <div className="gc-head">{head}</div>
      {isFinal && onSetBestOf && (
        <div className="setcount-ctrl">
          <span className="muted small">결승 세트수</span>
          <button onClick={() => onSetBestOf(match.id, Math.max(1, eff - 2))} disabled={eff <= 1} aria-label="세트수 줄이기">−</button>
          <b>{eff === 1 ? '단판' : `${eff}판 ${need}선승`}</b>
          <button onClick={() => onSetBestOf(match.id, Math.min(9, eff + 2))} disabled={eff >= 9} aria-label="세트수 늘리기">＋</button>
        </div>
      )}
      <div className="gc-teams">
        <span className="gc-name">{label(match.teamA)}</span>
        {eff > 1 && ready && <span className="gc-sets">{wins.a} : {wins.b}</span>}
        <span className="gc-name" style={{ textAlign: 'right' }}>{match.teamB ? label(match.teamB) : '—'}</span>
      </div>
      {ready && Array.from({ length: rows }).map((_, i) => (
        <div className="gc-row" key={i}>
          {eff > 1 && <span className="gc-set-no">{i + 1}세트</span>}
          <input className="gc-score-in" value={getSet(i).a}
            onChange={e => setScore(i, 'a', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
          <span className="muted">:</span>
          <input className="gc-score-in" value={getSet(i).b}
            onChange={e => setScore(i, 'b', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
        </div>
      ))}
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

// 경기 기록: 현재 대회를 스냅샷으로 저장하고, 클럽의 모든 대회 기록을 한 곳에서 열람.
function RecordView({ data, setData, teams, participants, work, tournamentId }) {
  const [open, setOpen] = useState(null)
  const [archive, setArchive] = useState(null) // 클럽 공용 보관함(서버)
  const [busy, setBusy] = useState(false)
  useEffect(() => { getRecords().then(setArchive).catch(() => setArchive([])) }, [])

  const teamLabel = id => {
    const t = teams.find(x => x.id === id)
    if (!t) return '—'
    if (t.playerIds.length > 1) return t.label?.trim() || `${t.no}팀`
    return participants.find(p => p.id === t.playerIds[0])?.name || '?'
  }
  const rounds = work?.structure?.rounds || []
  const labels = work?.structure?.labels || []
  const champion = rounds.length ? work.matches.find(x => x.id === rounds.at(-1)[0])?.winner : null
  const tpId = work?.structure?.thirdPlace
  const third = tpId ? work.matches.find(x => x.id === tpId)?.winner : null

  // 이전 대회들(보관함) + 이 대회에 남아있던 옛 기록을 합쳐 최신순으로
  const legacy = data.records || []
  const list = [...(archive || []), ...legacy.filter(r => !(archive || []).some(a => a.id === r.id))]
    .sort((a, b) => b.id - a.id)

  // 현재 상태를 이름·점수까지 고정한 스냅샷으로 변환
  const snapshot = () => ({
    id: Date.now(),
    tournamentId, sport: data.sport,
    savedAt: new Date().toLocaleString('ko-KR'),
    name: data.name || '대회', matchType: data.matchType,
    teams: teams.map(t => ({ no: t.no, name: t.label?.trim() || `${t.no}팀`, players: t.playerIds.map(id => participants.find(p => p.id === id)?.name || '?') })),
    rounds: rounds.map((round, ri) => ({
      round: labels[ri],
      matches: round.filter(mid => { const m = work.matches.find(x => x.id === mid); return m.teamA || m.teamB }).map(mid => {
        const m = work.matches.find(x => x.id === mid)
        return {
          a: teamLabel(m.teamA), b: m.teamB ? teamLabel(m.teamB) : '—',
          games: (m.games || []).map(g => ({ a: g.a, b: g.b })), // 세트별 원점수 보존
          bye: !!m.teamA && !m.teamB && m.status === 'done',
          winner: m.winner ? teamLabel(m.winner) : null,
        }
      }),
    })),
    champion: champion ? teamLabel(champion) : null,
    third: third ? teamLabel(third) : null,
  })
  const saveRecord = async () => {
    const next = [snapshot(), ...(archive || [])]
    setArchive(next)
    setBusy(true)
    try { await putRecords(next) } catch { /* 오프라인/데모: 로컬만 반영 */ } finally { setBusy(false) }
  }
  const deleteRecord = async id => {
    if (archive?.some(r => r.id === id)) {
      const next = archive.filter(r => r.id !== id)
      setArchive(next)
      putRecords(next).catch(() => {})
    }
    if (legacy.some(r => r.id === id)) setData({ ...data, records: legacy.filter(r => r.id !== id) })
  }
  const downloadRecord = r => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${r.name}-${r.savedAt}.json`.replace(/[:/]/g, '-'); a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="panel-title">경기 기록</div>
      <div className="panel-hint">지금 대회를 저장하면 클럽 보관함에 남고, 다른 대회 기록도 여기서 함께 볼 수 있어요. 눌러서 복기할 수 있습니다.</div>
      <button className="btn btn-primary" style={{ width: '100%', marginBottom: 14 }}
        onClick={saveRecord} disabled={!rounds.length || busy}>{busy ? '저장 중…' : '💾 현재 경기 저장'}</button>

      {archive === null && <div className="muted small">기록 불러오는 중…</div>}
      {archive !== null && list.length === 0 && <div className="muted small">아직 저장된 기록이 없습니다. 위 버튼으로 현재 경기를 저장하세요.</div>}

      {list.map(r => (
        <div className="card" key={r.id} style={{ padding: 12 }}>
          <div className="row-between" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
            <div style={{ minWidth: 0 }}>
              <strong>{r.name}</strong> <span className="muted small">{r.savedAt}</span>
            </div>
            <div className="row" style={{ gap: 6, flex: 'none' }}>
              {r.champion && <span className="badge">🏆 {r.champion}</span>}
              {r.third && <span className="badge" title="3위">🥉 {r.third}</span>}
              <button className="icon-btn" title="JSON 저장" onClick={e => { e.stopPropagation(); downloadRecord(r) }}>📥</button>
              <button className="icon-btn" title="삭제" onClick={e => { e.stopPropagation(); deleteRecord(r.id) }}>🗑</button>
            </div>
          </div>
          {open === r.id && (
            <div style={{ marginTop: 10 }}>
              {r.rounds.map((rd, i) => (
                <div className="rgroup" key={i}>
                  <div className="rg-title">{rd.round}</div>
                  {rd.matches.map((mt, j) => {
                    const games = mt.games || []
                    const setsA = games.reduce((s, g) => s + (g.a > g.b ? 1 : 0), 0)
                    const setsB = games.reduce((s, g) => s + (g.b > g.a ? 1 : 0), 0)
                    const head = games.length > 1 ? `${setsA} : ${setsB} 세트`
                      : games.length === 1 ? `${games[0].a} : ${games[0].b}`
                        : (mt.bye ? '부전승' : (mt.score || 'vs')) // mt.score: 옛 기록 호환
                    return (
                      <div className="rec-match-box" key={j}>
                        <div className="rec-match">
                          <span className={`rec-team ${mt.winner === mt.a ? 'win' : ''}`}>{mt.a}</span>
                          <span className="rec-score">{head}</span>
                          <span className={`rec-team right ${mt.winner === mt.b ? 'win' : ''}`}>{mt.b}</span>
                        </div>
                        {games.length > 0 && (
                          <div className="rec-sets">
                            {games.map((g, k) => (
                              <span className="rec-set" key={k}>
                                {games.length > 1 && <em>{k + 1}세트</em>}
                                <b className={g.a > g.b ? 'w' : ''}>{g.a}</b>:<b className={g.b > g.a ? 'w' : ''}>{g.b}</b>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
