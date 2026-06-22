import { Routes, Route } from 'react-router-dom'
import ThemeToggle from './components/ThemeToggle.jsx'
import Home from './pages/Home.jsx'
import AdminView from './pages/AdminView.jsx'
import PublicView from './pages/PublicView.jsx'

export default function App() {
  return (
    <>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:id/admin" element={<AdminView />} />
        <Route path="/t/:id" element={<PublicView />} />
      </Routes>
    </>
  )
}
