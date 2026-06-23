import { useRef, useState } from 'react'

// 공용 홀드-드래그 스왑 훅.
// 드래그 가능한 요소에 {[attr]: id} 와 onPointerDown={e=>begin(e,id)} 를 달면,
// 같은 attr을 가진 다른 요소 위에서 놓을 때 onSwap(fromId, toId)가 호출된다.
export function useSwap({ attr, onSwap, labelOf }) {
  const dragRef = useRef(null)
  const targetRef = useRef(null)
  const [dragId, setDragId] = useState(null)
  const [targetId, setTargetId] = useState(null)
  const [ghost, setGhost] = useState(null)

  const move = e => {
    setGhost(g => (g ? { ...g, x: e.clientX, y: e.clientY } : g))
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest(`[${attr}]`)
    const id = el?.getAttribute(attr) || null
    const t = id && id !== dragRef.current ? id : null
    targetRef.current = t
    setTargetId(t)
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    const from = dragRef.current, to = targetRef.current
    dragRef.current = null; targetRef.current = null
    setDragId(null); setTargetId(null); setGhost(null)
    if (from && to) onSwap(from, to)
  }
  const begin = (e, id) => {
    e.preventDefault(); e.stopPropagation()
    dragRef.current = id; setDragId(id)
    targetRef.current = null; setTargetId(null)
    setGhost({ label: labelOf(id), x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  const ghostEl = ghost ? <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.label}</div> : null
  return { begin, dragId, targetId, ghostEl }
}
