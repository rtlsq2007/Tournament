import { Routes, Route, useLocation } from 'react-router-dom'
import ThemeToggle from './components/ThemeToggle.jsx'
import Home from './pages/Home.jsx'
import AdminView from './pages/AdminView.jsx'
import PublicView from './pages/PublicView.jsx'

export default function App() {
  const loc = useLocation()
  // 참가자 화면(/t/:id)은 하단에, 운영자 화면(/t/:id/admin)은 상단 코너에 자체 배치 → 홈에서만 전역 토글
  const isHome = loc.pathname === '/'
  return (
    <>
      {isHome && <ThemeToggle />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:id/admin" element={<AdminView />} />
        <Route path="/t/:id" element={<PublicView />} />
      </Routes>
    </>
  )
}
