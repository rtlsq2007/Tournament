import { useState } from 'react'

let _pid = 0
const newPid = () => `p${Date.now().toString(36)}_${++_pid}`

export default function ParticipantsTab({ participants, setParticipants, matchType }) {
  const [sub, setSub] = useState('simple')
  const [bulk, setBulk] = useState(participants.map(p => p.name).join('\n'))

  const applyBulk = () => {
    const names = bulk.split('\n').map(s => s.trim()).filter(Boolean)
    setParticipants(names.map(name => {
      const ex = participants.find(p => p.name === name)
      return ex || { id: newPid(), name, tier: 3, gender: 'M', checkedIn: true }
    }))
  }
  const add = () => setParticipants([...participants,
    { id: newPid(), name: `참가자${participants.length + 1}`, tier: 3, gender: 'M', checkedIn: true }])
  const removeLast = () => setParticipants(participants.slice(0, -1))
  const update = (id, patch) => setParticipants(participants.map(p => p.id === id ? { ...p, ...patch } : p))
  const remove = id => setParticipants(participants.filter(p => p.id !== id))
  const shuffle = () => setParticipants([...participants].sort(() => Math.random() - 0.5))

  return (
    <div>
      <div className="panel-title">참가자 등록</div>
      <div className="panel-hint">간단 입력으로 한 번에 붙여넣거나, 상세 입력에서 개별 관리하세요.</div>

      <div className="row-between" style={{ marginBottom: 14 }}>
        <div className="count-pill">
          <button onClick={removeLast} aria-label="한 명 줄이기">−</button>
          <span>{participants.length}명</span>
          <button onClick={add} aria-label="한 명 늘리기">＋</button>
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
        <div>
          {participants.map(p => (
            <div className="prow" key={p.id}>
              <input className="pname input" style={{ background: 'transparent', border: 'none', padding: 0 }}
                value={p.name} onChange={e => update(p.id, { name: e.target.value })} />
              {matchType === 'mixed' && (
                <select className="input" style={{ width: 64 }} value={p.gender}
                  onChange={e => update(p.id, { gender: e.target.value })}>
                  <option value="M">남</option><option value="F">여</option>
                </select>
              )}
              <span title="실력 티어" style={{ whiteSpace: 'nowrap' }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} onClick={() => update(p.id, { tier: s })}
                    style={{ cursor: 'pointer', color: p.tier >= s ? 'var(--warn)' : 'var(--border-strong)' }}>★</span>
                ))}
              </span>
              <button className="icon-btn" onClick={() => remove(p.id)} title="삭제">🗑</button>
            </div>
          ))}
          {participants.length === 0 && <div className="muted small">참가자가 없습니다. 위 ＋ 로 추가하세요.</div>}
        </div>
      )}
    </div>
  )
}
