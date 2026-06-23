import { useState, useRef } from 'react'

let _pid = 0
const newPid = () => `p${Date.now().toString(36)}_${++_pid}`

export default function ParticipantsTab({ participants, setParticipants, teams, setTeams, matchType }) {
  const [sub, setSub] = useState('simple')
  const [bulk, setBulk] = useState(participants.map(p => p.name).join('\n'))
  const step = matchType === 'singles' ? 1 : 2

  const pName = id => participants.find(p => p.id === id)?.name || '?'
  const pTier = id => participants.find(p => p.id === id)?.tier || 0

  // ---- 인원/명단 (participants) ----
  const addStep = () => {
    const add = Array.from({ length: step }, (_, k) =>
      ({ id: newPid(), name: `참가자${participants.length + k + 1}`, tier: 3, gender: 'M', checkedIn: true }))
    setParticipants([...participants, ...add])
  }
  const removeStep = () => setParticipants(participants.slice(0, Math.max(0, participants.length - step)))
  const shuffle = () => setParticipants([...participants].sort(() => Math.random() - 0.5))
  const applyBulk = () => {
    const names = bulk.split('\n').map(s => s.trim()).filter(Boolean)
    setParticipants(names.map(name => participants.find(p => p.name === name)
      || { id: newPid(), name, tier: 3, gender: 'M', checkedIn: true }))
  }

  // ---- 팀 편집 (teams): 이름 변경 + 홀드 드래그 스왑 ----
  const renameTeam = (id, label) => setTeams(teams.map(t => t.id === id ? { ...t, label } : t))

  const dragRef = useRef(null)
  const targetRef = useRef(null)
  const [ghost, setGhost] = useState(null)
  const [targetId, setTargetId] = useState(null)

  const moveDrag = e => {
    setGhost(g => g ? { ...g, x: e.clientX, y: e.clientY } : g)
    const chip = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pchip')
    const pid = chip?.getAttribute('data-pid') || null
    const t = (pid && pid !== dragRef.current) ? pid : null
    targetRef.current = t
    setTargetId(t)
  }
  const endDrag = () => {
    window.removeEventListener('pointermove', moveDrag)
    window.removeEventListener('pointerup', endDrag)
    const from = dragRef.current, to = targetRef.current
    dragRef.current = null; targetRef.current = null
    setGhost(null); setTargetId(null)
    if (from && to) swapPlayers(from, to)
  }
  const beginDrag = (e, playerId) => {
    e.preventDefault()
    dragRef.current = playerId
    targetRef.current = null
    setTargetId(null)
    setGhost({ name: pName(playerId), x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', moveDrag)
    window.addEventListener('pointerup', endDrag)
  }
  const swapPlayers = (a, b) => {
    setTeams(teams.map(t => {
      if (!t.playerIds.includes(a) && !t.playerIds.includes(b)) return t
      const ids = t.playerIds.map(id => id === a ? b : id === b ? a : id)
      return { ...t, playerIds: ids, tierSum: ids.reduce((s, id) => s + pTier(id), 0) }
    }))
  }

  return (
    <div>
      <div className="panel-title">참가자 등록</div>
      <div className="panel-hint">간단 입력으로 명단을 넣고, 상세 입력에서 팀을 조정하세요. 칩을 꾹 눌러 다른 선수와 자리를 바꿀 수 있습니다.</div>

      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="count-pill">
          <button onClick={removeStep} aria-label={`${step}명 줄이기`}>−</button>
          <span>{participants.length}명{step === 2 ? ` · ${teams.length}팀` : ''}</span>
          <button onClick={addStep} aria-label={`${step}명 늘리기`}>＋</button>
        </div>
        <button className="btn" onClick={shuffle}>🔀 셔플</button>
      </div>

      <div className="subtabs">
        <button className={sub === 'simple' ? 'active' : ''} onClick={() => setSub('simple')}>간단 입력</button>
        <button className={sub === 'detail' ? 'active' : ''} onClick={() => setSub('detail')}>상세 입력</button>
      </div>

      {sub === 'simple' ? (
        <div>
          <textarea className="input" rows={10} value={bulk} onChange={e => setBulk(e.target.value)}
            placeholder={'이름을 한 줄에 한 명씩\nPlayer1\nPlayer2 ...'} />
          <button className="btn btn-primary" style={{ marginTop: 10, width: '100%' }} onClick={applyBulk}>
            명단 적용 ({bulk.split('\n').filter(s => s.trim()).length}명)
          </button>
        </div>
      ) : (
        <div className="team-grid">
          {teams.map((t, i) => (
            <div className={`team-card ${targetId && t.playerIds.includes(targetId) ? 'drop-into' : ''}`} key={t.id}>
              <div className="tc-head">
                <span className="tnum">{i + 1}</span>
                <input className="team-name-in" value={t.label}
                  onChange={e => renameTeam(t.id, e.target.value)} placeholder={`${i + 1}팀`} />
                {step === 2 && <span className="tc-sum">전력 {t.tierSum}</span>}
              </div>
              <div className="tc-members">
                {t.playerIds.map(pidv => (
                  <span key={pidv} className={`pchip ${dragRef.current === pidv ? 'dragging' : ''} ${targetId === pidv ? 'swap-target' : ''}`}
                    data-pid={pidv} onPointerDown={e => beginDrag(e, pidv)}>
                    <span className="pc-grip">⠿</span>{pName(pidv)}<span className="pc-tier">★{pTier(pidv)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {teams.length === 0 && <div className="muted small">참가자를 추가하면 팀이 자동 구성됩니다.</div>}
        </div>
      )}

      {ghost && <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.name}</div>}
    </div>
  )
}
