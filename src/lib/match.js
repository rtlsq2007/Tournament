export function gamesToWin(bestOf) { return Math.floor(bestOf / 2) + 1 }

export function matchWinner(games, bestOf) {
  const need = gamesToWin(bestOf)
  let a = 0, b = 0
  for (const g of games) {
    if (g.a > g.b) a++
    else if (g.b > g.a) b++
  }
  if (a >= need) return 'A'
  if (b >= need) return 'B'
  return null
}
