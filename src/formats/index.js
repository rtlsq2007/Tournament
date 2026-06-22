import singleElim from './singleElim.js'

const REGISTRY = { single_elim: singleElim }

export const FORMAT_LABELS = {
  single_elim: '싱글 엘리미네이션',
  group_knockout: '조별리그 → 본선토너먼트',
  round_robin: '전체 풀리그',
  gameday: '게임데이 로테이션',
}

export function getFormat(key) {
  const f = REGISTRY[key]
  if (!f) throw new Error(`미구현 포맷: ${key}`)
  return f
}
