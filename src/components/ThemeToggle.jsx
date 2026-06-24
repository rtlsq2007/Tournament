import { useEffect, useState } from 'react'

export default function ThemeToggle({ bottom = false }) {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light') // 다크 기본
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])
  return (
    <button className={`theme-btn ${bottom ? 'theme-btn-bottom' : ''}`} onClick={() => setDark(d => !d)}
      aria-label="테마 전환" title="테마 전환">
      {bottom ? (dark ? '☀️ 라이트 모드' : '🌙 다크 모드') : (dark ? '☀️' : '🌙')}
    </button>
  )
}
