let _mid = 0
const newMid = () => `m${Date.now().toString(36)}_${++_mid}`

// 라켓단(동아리) 멤버 명부 관리. members/setMembers는 상위(AdminView)에서 로드·자동저장.
export default function ClubTab({ members, setMembers }) {
  if (members === null) {
    return <div><div className="panel-title">라켓단 멤버</div><div className="muted small">불러오는 중…</div></div>
  }
  const add = () => setMembers([{ id: newMid(), name: '', tier: 3, strengths: '', weaknesses: '' }, ...members])
  const update = (id, patch) => setMembers(members.map(m => m.id === id ? { ...m, ...patch } : m))
  const remove = id => setMembers(members.filter(m => m.id !== id))

  return (
    <div>
      <div className="panel-title">라켓단 멤버</div>
      <div className="panel-hint">동아리 멤버를 등록해두면, 참가자 명단에 같은 이름을 넣을 때 실력·정보가 자동으로 채워집니다.</div>
      <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }} onClick={add}>＋ 멤버 추가</button>
      {members.length === 0 && <div className="muted small">아직 등록된 멤버가 없습니다.</div>}
      {members.map(m => (
        <div className="card" key={m.id} style={{ padding: 12 }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}>
            <input className="input" style={{ fontWeight: 700 }} placeholder="이름"
              value={m.name} onChange={e => update(m.id, { name: e.target.value })} />
            <button className="icon-btn" onClick={() => remove(m.id)} title="삭제">🗑</button>
          </div>
          <div className="field"><label>실력</label>
            <span className="pc-stars">
              {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className={`pc-star ${m.tier >= s ? 'on' : ''}`}
                  onPointerDown={e => { e.preventDefault(); update(m.id, { tier: s }) }}>★</span>
              ))}
            </span>
          </div>
          <div className="field"><label>장점</label>
            <textarea className="input" rows={2} value={m.strengths || ''}
              onChange={e => update(m.id, { strengths: e.target.value })} placeholder="예: 스매시 강함, 체력 좋음" /></div>
          <div className="field"><label>단점</label>
            <textarea className="input" rows={2} value={m.weaknesses || ''}
              onChange={e => update(m.id, { weaknesses: e.target.value })} placeholder="예: 백핸드 약함, 수비 불안" /></div>
        </div>
      ))}
    </div>
  )
}
