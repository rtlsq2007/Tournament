import { Routes, Route, useLocation } from 'react-router-dom'
import ThemeToggle from './components/ThemeToggle.jsx'
import Home from './pages/Home.jsx'
import AdminView from './pages/AdminView.jsx'
import PublicView from './pages/PublicView.jsx'

export default function App() {
  const loc = useLocation()
  const isPublic = /^\/t\/[^/]+$/.test(loc.pathname) // 참가자 화면(/t/:id)은 토글을 하단에 자체 배치
  return (
    <>
      {!isPublic && <ThemeToggle />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:id/admin" element={<AdminView />} />
        <Route path="/t/:id" element={<PublicView />} />
      </Routes>
    </>
  )
}
