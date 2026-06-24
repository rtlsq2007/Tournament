// 오늘 날짜 기준 기본 대회명. 예: "2026년 6월 25일 대회"
export function todayName() {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 대회`
}
