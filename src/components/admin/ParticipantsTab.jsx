import { useState } from 'react'
import { useSwap } from './useSwap.jsx'
import { pairTeams } from '../../lib/balancer.js'

let _pid = 0
const newPid = () => `p${Date.now().toString(36)}_${++_pid}`
const mkP = name => ({ id: newPid(), name, tier: 3, gender: 'M', checkedIn: true })

// 별점: 마우스 올린 지점까지 연하게 미리보기, 누르면 설정
function StarRating({ tier, onSet }) {
  const [hover, setHover] = useState(0)
  return (
    <span className="pc-stars" onPointerLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(s => {
        const cls = s <= tier ? 'on' : (hover && s <= hover ? 'preview' : '')
        return (
          <span key={s} className={`pc-star ${cls}`}
            onPointerEnter={() => setHover(s)}
            onPointerDown={e => { e.stopPropagation(); onSet(s) }}>★</span>
        )
      })}
    </span>
  )
}

export default function ParticipantsTab({ participants, setParticipants, teams, setTeams, matchType, members = [], swapPlayers, swapTeams, deletePlayer }) {
  const [sub, setSub] = useState('list')
  const [bulk, setBulk] = useState(participants.map(p => p.name).join('\n'))
  const step = matchType === 'singles' ? 1 : 2

  const pName = id => participants.find(p => p.id === id)?.name || '?'
  const pTier = id => participants.find(p => p.id === id)?.tier || 0
  const teamLabel = id => {
    const t = teams.find(x => x.id === id)
    return t?.label?.trim() || `${t?.no}팀`
  }

  // 드래그 스왑: 선수(칩, 휴지통으로 삭제 가능) / 팀(카드)
  const playerSwap = useSwap({ attr: 'data-pid', onSwap: swapPlayers, onDelete: deletePlayer, labelOf: pName })
  const teamSwap = useSwap({ attr: 'data-team', onSwap: swapTeams, labelOf: teamLabel })

  // 간단 입력(선수 명단): 타이핑하면 버튼 없이 바로 반영
  // 인덱스 기준으로 매핑 — 이름만 바꾸면 같은 선수(id 유지)라 팀/팀명이 깨지지 않음
  const onBulk = v => {
    setBulk(v)
    const names = v.split('\n').map(s => s.trim()).filter(Boolean)
    setParticipants(names.map((name, i) => {
      const base = participants[i]
      const mem = name ? members.find(mm => mm.name === name) : null
      if (mem) {
        // 라켓단 멤버와 이름 일치 → 실력 자동 채움(이미 연결됐으면 수동 수정 보존)
        if (base && base.memberId === mem.id) return { ...base, name }
        return { id: base?.id || newPid(), name, tier: mem.tier, gender: base?.gender || 'M', checkedIn: base?.checkedIn ?? true, memberId: mem.id }
      }
      return base ? { ...base, name, memberId: undefined } : mkP(name)
    }))
  }
  const setCount = next => { setParticipants(next); setBulk(next.map(p => p.name).join('\n')) }
  const addStep = () => setCount([...participants, ...Array.from({ length: step }, (_, k) => mkP(`참가자${participants.length + k + 1}`))])
  const removeStep = () => setCount(participants.slice(0, Math.max(0, participants.length - step)))
  // 셔플: 팀명은 자리(순서) 기준으로 유지.
  const shuffleArr = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }
  const doShuffle = mode => setTeams(prev => {
    const active = participants.filter(p => p.checkedIn)
    // 밸런스(auto)는 동일 티어 순서를 섞어 매번 다른 균형 조합이 나오도록
    const input = mode === 'auto' ? shuffleArr(active) : active
    const fresh = pairTeams(input, { matchType, mode })
    return fresh.map((t, i) => prev[i]?.label ? { ...t, label: prev[i].label } : t)
  })

  const renameTeam = (id, label) => setTeams(teams.map(t => t.id === id ? { ...t, label } : t))
  const setTier = (pid, tier) => setParticipants(participants.map(p => p.id === pid ? { ...p, tier } : p))

  return (
    <div>
      <div className="panel-title">참가자 등록</div>
      <div className="panel-hint">명단을 줄단위로 입력하면 자동 반영됩니다. ‘선수 조정’에서 칩/팀을 꾹 눌러 자리를 바꿀 수 있습니다.</div>

      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="count-pill">
          <button onClick={removeStep} aria-label={`${step}명 줄이기`}>−</button>
          <span>{participants.length}명{step === 2 ? ` · ${teams.length}팀` : ''}</span>
          <button onClick={addStep} aria-label={`${step}명 늘리기`}>＋</button>
        </div>
        <div className="shuffle-group">
          <button className="btn btn-sm" onClick={() => doShuffle('auto')} title="실력(별점) 균형으로 팀 구성">⚖️ 밸런스</button>
          <button className="btn btn-sm" onClick={() => doShuffle('random')} title="완전 무작위로 팀 구성">🔀 일반</button>
        </div>
      </div>

      <div className="subtabs">
        <button className={sub === 'list' ? 'active' : ''} onClick={() => setSub('list')}>선수 명단</button>
        <button className={sub === 'adjust' ? 'active' : ''} onClick={() => setSub('adjust')}>선수 조정</button>
      </div>

      {sub === 'list' ? (
        <textarea className="input" rows={11} value={bulk} onChange={e => onBulk(e.target.value)}
          placeholder={'이름을 한 줄에 한 명씩 (자동 반영)\n선수1\n선수2 ...'} />
      ) : (
        <div className="team-grid">
          {teams.map((t, i) => (
            <div className={`team-card team-drag ${teamSwap.dragId === t.id ? 'dragging' : ''} ${teamSwap.targetId === t.id ? 'drop-into' : ''}`}
              key={t.id} data-team={t.id} title="카드를 꾹 눌러 드래그하면 팀 위치를 바꿀 수 있어요"
              onPointerDown={e => { if (e.target.closest('.team-name-in') || e.target.closest('.pchip')) return; teamSwap.begin(e, t.id) }}>
              <div className="tc-head">
                <span className="tnum">{t.no}</span>
                <input className="team-name-in" value={t.label}
                  onChange={e => renameTeam(t.id, e.target.value)} placeholder={`${t.no}팀`} />
                {step === 2 && <span className="tc-sum">전력 {t.playerIds.reduce((s, pid) => s + pTier(pid), 0)}</span>}
              </div>
              <div className="tc-members">
                {t.playerIds.map(pid => (
                  <span key={pid} className={`pchip ${playerSwap.dragId === pid ? 'dragging' : ''} ${playerSwap.targetId === pid ? 'swap-target' : ''}`}
                    data-pid={pid} onPointerDown={e => playerSwap.begin(e, pid)}>
                    <span className="pc-grip">⠿</span>
                    <span className="pc-name">{pName(pid)}</span>
                    <StarRating tier={pTier(pid)} onSet={s => setTier(pid, s)} />
                  </span>
                ))}
              </div>
            </div>
          ))}
          {teams.length === 0 && <div className="muted small">참가자를 추가하면 팀이 자동 구성됩니다.</div>}
        </div>
      )}

      {playerSwap.ghostEl}
      {teamSwap.ghostEl}
      {playerSwap.trashEl}
    </div>
  )
}
