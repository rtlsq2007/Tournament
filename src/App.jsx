import { useEffect, useState } from 'react'
import { Routes, Route, useLocation, useSearchParams } from 'react-router-dom'
import ThemeToggle from './components/ThemeToggle.jsx'
import Login from './components/Login.jsx'
import { getMe } from './lib/api.js'
import Home from './pages/Home.jsx'
import AdminView from './pages/AdminView.jsx'
import PublicView from './pages/PublicView.jsx'

// 보호 라우트: 로그인해야 진입. ?demo=1 은 UI 데모용으로 우회.
// (프론트 가드는 UX용일 뿐, 실제 보안은 서버가 모든 쓰기에 세션을 강제함)
function Gate({ children }) {
  const [sp] = useSearchParams()
  const demo = sp.get('demo') === '1'
  const [state, setState] = useState(demo ? 'ok' : 'loading')
  useEffect(() => {
    if (demo) return
    let alive = true
    getMe().then(d => { if (alive) setState(d.authed ? 'ok' : 'no') })
    return () => { alive = false }
  }, [demo])
  if (state === 'loading') return <div className="app"><div className="muted">확인 중…</div></div>
  if (state === 'no') return <Login onSuccess={() => setState('ok')} />
  return children
}

export default function App() {
  const loc = useLocation()
  const isHome = loc.pathname === '/'
  return (
    <>
      {isHome && <ThemeToggle />}
      <Routes>
        <Route path="/" element={<Gate><Home /></Gate>} />
        <Route path="/t/:id/admin" element={<Gate><AdminView /></Gate>} />
        <Route path="/t/:id" element={<PublicView />} />
      </Routes>
    </>
  )
}
