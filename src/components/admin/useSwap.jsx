import { useRef, useState } from 'react'

// 공용 홀드-드래그 훅.
// 드래그 요소에 {[attr]: id} + onPointerDown={e=>begin(e,id)} 를 달면:
//  - 같은 attr 요소 위에서 놓으면 onSwap(fromId, toId)
//  - [data-swap-trash] 위에서 놓으면 onDelete(fromId)
export function useSwap({ attr, onSwap, onDelete, labelOf, trashLabel = '🗑 여기에 놓아 삭제' }) {
  const dragRef = useRef(null)
  const targetRef = useRef(null)
  const trashRef = useRef(false)
  const [dragId, setDragId] = useState(null)
  const [targetId, setTargetId] = useState(null)
  const [overTrash, setOverTrash] = useState(false)
  const [ghost, setGhost] = useState(null)

  const move = e => {
    setGhost(g => (g ? { ...g, x: e.clientX, y: e.clientY } : g))
    const at = document.elementFromPoint(e.clientX, e.clientY)
    const onTrash = !!at?.closest('[data-swap-trash]')
    trashRef.current = onTrash
    setOverTrash(onTrash)
    if (onTrash) { targetRef.current = null; setTargetId(null); return }
    const id = at?.closest(`[${attr}]`)?.getAttribute(attr) || null
    const t = id && id !== dragRef.current ? id : null
    targetRef.current = t
    setTargetId(t)
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    const from = dragRef.current, to = targetRef.current, trash = trashRef.current
    dragRef.current = null; targetRef.current = null; trashRef.current = false
    setDragId(null); setTargetId(null); setOverTrash(false); setGhost(null)
    if (from && trash && onDelete) onDelete(from)
    else if (from && to) onSwap(from, to)
  }
  const begin = (e, id) => {
    e.preventDefault(); e.stopPropagation()
    dragRef.current = id; setDragId(id)
    targetRef.current = null; trashRef.current = false
    setTargetId(null); setOverTrash(false)
    setGhost({ label: labelOf(id), x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }

  const ghostEl = ghost ? <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.label}</div> : null
  const trashEl = (onDelete && dragId)
    ? <div className={`drag-trash ${overTrash ? 'over' : ''}`} data-swap-trash>{trashLabel}</div>
    : null

  return { begin, dragId, targetId, ghostEl, trashEl }
}
