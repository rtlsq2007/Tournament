# 배드민턴 토너먼트 — 계획 1: 토대 + 싱글 엘리미네이션 슬라이스

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloudflare에 배포 가능한, 싱글 엘리미네이션 대회를 끝까지 운영·실시간 관전할 수 있는 동작하는 웹앱을 만든다.

**Architecture:** React 19 + Vite 단일 SPA(react-router). 백엔드는 Cloudflare Pages Functions + D1(SQLite), 대회 상태는 `tournaments.data_json`에 통째로 저장. 참가자 화면은 `updated_at` 기반 4초 폴링. 대회 포맷 로직은 `src/formats/*`의 공통 인터페이스(`generate/applyResult/recompute/standings/isComplete`)로 격리한다.

**Tech Stack:** React 19, Vite 8, react-router-dom, Vitest, qrcode.react, html2canvas, Cloudflare Pages Functions, D1, wrangler.

**참고:** 설계 스펙 = `docs/superpowers/specs/2026-06-22-badminton-tournament-design.md`. 이 계획은 3개 계획 중 1번(토대 + 싱글 엘리미네이션). 포맷 3종은 계획 2, 가로지르는 추가기능 마무리는 계획 3.

**용어:** `team` = 대진 한 칸의 출전 단위(단식 1인, 복식/혼복 2인). `match` = 한 경기. `games` = bestOf 세트별 점수 배열.

---

## File Structure (이 계획에서 생성)

```
Tournament/
├─ package.json, vite.config.js, index.html, .gitignore
├─ wrangler.toml                       # Pages + D1 바인딩
├─ schema.sql                          # tournaments 테이블
├─ README.md                           # 로컬 실행 + Cloudflare 배포 가이드
├─ src/
│  ├─ main.jsx, App.jsx                # 라우터
│  ├─ index.css                        # 디자인 토큰(--primary/--radius 등) + 다크모드
│  ├─ lib/
│  │  ├─ id.js (+ id.test.js)          # 공개 id / 비밀 token 생성
│  │  ├─ match.js (+ match.test.js)    # bestOf 세트 승자 판정
│  │  ├─ balancer.js (+ test)          # 팀 분배 + 페어링(자동 밸런싱)
│  │  └─ api.js                        # 백엔드 호출 + usePolling 훅
│  ├─ formats/
│  │  ├─ singleElim.js (+ test)        # 싱글 엘리미네이션 로직
│  │  └─ index.js                      # 포맷 레지스트리
│  ├─ pages/  Home.jsx, AdminView.jsx, PublicView.jsx
│  └─ components/ ParticipantManager.jsx, Bracket.jsx, MatchCard.jsx,
│                 ProgressDashboard.jsx, ShareBar.jsx, ThemeToggle.jsx
└─ functions/api/tournament/
   ├─ index.js                         # POST 생성
   └─ [id].js                          # GET / PUT
```

각 파일은 단일 책임을 가진다. 포맷 모듈은 순수 함수만 노출하여 단위 테스트가 쉽다.

---

## 디자인 시스템 (필수 준수)

> 사용자는 디자인에 매우 깐깐하며 **스마트·현대적·완전히 전문적인** UI를 요구한다. 아래 방향은 합의된 확정 사항이다. **UI Task의 인라인 스타일은 "기능 검증용 placeholder"이며, 실제 구현에서는 반드시 이 디자인 시스템(클래스)으로 대체한다.** 각 UI Task 완료 시 결과는 이 기준에 부합해야 하며, 로컬에서 화면을 띄워 사용자와 시각 피드백을 반영한다.

- **방향**: 미니멀 & 클린 (Linear/Vercel 풍). 넉넉한 여백, 절제된 단일 액센트, 명료한 타이포 위계, 얇은 보더, 미세한 그림자, 부드러운 트랜지션.
- **기본 모드**: **다크 우선**(라이트 토글 제공). `<html data-theme="dark">`가 기본.
- **액센트**: 인디고/바이올렛 (`#6366f1` 계열).
- **폰트**: Pretendard (CDN), 폴백 system-ui.
- **간격 스케일**: 4·8·12·16·24·32px. **반경**: 카드 16px, 컨트롤 10px. **그림자**: 은은하게(2단계).
- **컴포넌트 원칙**: 모든 화면은 `index.css`의 공용 클래스(`.card`, `.btn`, `.btn-primary`, `.btn-ghost`, `.input`, `.field`, `.badge`, `.stack`, `.row`, `.muted`, `.h1/.h2`)를 사용한다. 컴포넌트별 인라인 색/간격 하드코딩 금지(토큰 변수 사용).
- **모바일 우선**: 참가자 화면은 폰에서 큰 터치 타깃·높은 가독성. 반응형 필수.

이 시스템의 토큰·기본 스타일은 Task 1에서 `index.css`로 구축한다.

---

## Task 1: 프로젝트 스캐폴딩 + git 초기화

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `src/main.jsx`, `src/App.jsx`, `src/index.css`

- [ ] **Step 1: git 초기화 및 .gitignore 작성**

Create `.gitignore`:
```
node_modules
dist
.wrangler
.dev.vars
*.local
.DS_Store
```

Run:
```bash
cd /c/Users/UserPC/Desktop/Tournament
git init
```

- [ ] **Step 2: package.json 작성**

Create `package.json`:
```json
{
  "name": "badminton-tournament",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "pages:dev": "wrangler pages dev -- npm run dev"
  },
  "dependencies": {
    "html2canvas": "^1.4.1",
    "qrcode.react": "^4.2.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-router-dom": "^7.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.1",
    "vite": "^8.0.12",
    "vitest": "^3.2.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 3: vite.config.js (Vitest 포함)**

Create `vite.config.js`:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
```

- [ ] **Step 4: index.html + main.jsx + 빈 App**

Create `index.html` (Pretendard CDN + 다크 우선, 깜빡임 방지 인라인 스크립트):
```html
<!doctype html>
<html lang="ko" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>배드민턴 토너먼트</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
    <script>
      // 저장된 테마를 페인트 전에 적용(다크 기본)
      try { document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') === 'light' ? 'light' : 'dark') } catch (e) {}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Create `src/main.jsx`:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

Create `src/App.jsx` (라우트는 Task 14에서 채움):
```jsx
export default function App() {
  return <div className="app"><h1>배드민턴 토너먼트</h1></div>
}
```

- [ ] **Step 5: index.css 디자인 토큰 (참고 프로젝트의 누락 변수 정비 + 다크모드)**

Create `src/index.css` (다크 우선 Linear 풍 디자인 시스템 — 토큰 + 공용 컴포넌트 클래스):
```css
/* ===== 다크 우선 토큰 (기본 = 다크) ===== */
:root {
  --accent: #818cf8;          /* 인디고/바이올렛 (다크에서 또렷) */
  --accent-strong: #6366f1;
  --accent-weak: rgba(129, 140, 248, 0.14);
  --success: #34d399;
  --danger: #f87171;
  --warn: #fbbf24;

  --bg: #0b0d12;              /* 페이지 배경 */
  --surface: #14171f;        /* 카드 */
  --surface-2: #1b1f2a;      /* 입력/내부 */
  --text: #e7e9ee;
  --text-muted: #9aa3b2;
  --border: #232838;
  --border-strong: #2f3548;

  --shadow-sm: 0 1px 2px rgba(0,0,0,.4);
  --shadow-md: 0 8px 24px rgba(0,0,0,.45);

  --r-card: 16px;
  --r-ctrl: 10px;
  --r-pill: 999px;

  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px; --sp-8:32px;

  --font: 'Pretendard', system-ui, 'Segoe UI', Roboto, sans-serif;
}
[data-theme='light'] {
  --accent: #6366f1;
  --accent-strong: #4f46e5;
  --accent-weak: rgba(99, 102, 241, 0.10);
  --success: #10b981;
  --danger: #ef4444;
  --warn: #d97706;

  --bg: #f7f8fa;
  --surface: #ffffff;
  --surface-2: #f1f3f7;
  --text: #0f1115;
  --text-muted: #5b6472;
  --border: #e6e8ee;
  --border-strong: #d6dae3;

  --shadow-sm: 0 1px 2px rgba(16,24,40,.06);
  --shadow-md: 0 8px 24px rgba(16,24,40,.10);
}

* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
  line-height: 1.5;
}

/* ===== 타이포 ===== */
.h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 var(--sp-2); }
.h2 { font-size: 20px; font-weight: 650; letter-spacing: -0.02em; margin: 0 0 var(--sp-2); }
.muted { color: var(--text-muted); }
.small { font-size: 13px; }

/* ===== 레이아웃 ===== */
.app { max-width: 760px; margin: 0 auto; padding: var(--sp-6) var(--sp-4) 64px; }
.stack > * + * { margin-top: var(--sp-3); }
.row { display: flex; align-items: center; gap: var(--sp-2); }
.row-between { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }

/* ===== 카드 ===== */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-sm);
  padding: var(--sp-4);
  margin-bottom: var(--sp-4);
}

/* ===== 버튼 ===== */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px 16px; border-radius: var(--r-ctrl);
  border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text);
  font: inherit; font-weight: 600; cursor: pointer;
  transition: background .15s ease, border-color .15s ease, transform .05s ease;
}
.btn:hover { border-color: var(--accent); }
.btn:active { transform: translateY(1px); }
.btn-primary {
  background: var(--accent-strong); border-color: var(--accent-strong); color: #fff;
}
.btn-primary:hover { filter: brightness(1.08); border-color: var(--accent-strong); }
.btn-ghost { background: transparent; border-color: transparent; color: var(--text-muted); }
.btn-ghost:hover { color: var(--text); background: var(--surface-2); }
.btn:disabled { opacity: .5; cursor: not-allowed; }

/* ===== 입력 ===== */
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--sp-3); }
.field > label { font-size: 13px; color: var(--text-muted); font-weight: 600; }
.input, select.input, textarea.input {
  width: 100%; padding: 10px 12px; border-radius: var(--r-ctrl);
  border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text);
  font: inherit; outline: none; transition: border-color .15s ease, box-shadow .15s ease;
}
.input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-weak); }

/* ===== 뱃지 / 칩 ===== */
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: var(--r-pill); font-size: 12px; font-weight: 600;
  background: var(--accent-weak); color: var(--accent);
}
.badge-live { background: rgba(248,113,113,.16); color: var(--danger); }
.badge-done { background: rgba(52,211,153,.16); color: var(--success); }

/* ===== 진행바 ===== */
.progress { height: 8px; border-radius: var(--r-pill); background: var(--surface-2); overflow: hidden; }
.progress > i { display:block; height: 100%; background: var(--accent-strong); border-radius: var(--r-pill); transition: width .3s ease; }
```

- [ ] **Step 6: 의존성 설치 후 dev 서버 확인**

Run:
```bash
npm install
npm run dev
```
Expected: Vite가 `http://localhost:5173`에서 기동, "배드민턴 토너먼트" 제목 표시. (확인 후 Ctrl+C)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite+react project with design tokens"
```

---

## Task 2: Vitest 동작 확인

**Files:** Create: `src/lib/smoke.test.js`

- [ ] **Step 1: 스모크 테스트 작성**
```js
import { describe, it, expect } from 'vitest'
describe('smoke', () => { it('runs', () => { expect(1 + 1).toBe(2) }) })
```

- [ ] **Step 2: 실행 확인**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 3: 정리 후 commit**
```bash
rm src/lib/smoke.test.js
git add -A && git commit -m "test: verify vitest runs"
```

---

## Task 3: ID / 토큰 생성 (`src/lib/id.js`)

**Files:** Create `src/lib/id.js`, `src/lib/id.test.js`

- [ ] **Step 1: 실패 테스트 작성**
```js
import { describe, it, expect } from 'vitest'
import { shortId, secretToken } from './id.js'

describe('id', () => {
  it('shortId: 6자 영숫자(혼동문자 제외)', () => {
    const id = shortId()
    expect(id).toMatch(/^[0-9a-hjkmnp-z]{6}$/)
  })
  it('secretToken: 충분히 길고 매번 다름', () => {
    const a = secretToken(), b = secretToken()
    expect(a.length).toBeGreaterThanOrEqual(24)
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- id`
Expected: FAIL ("does not provide an export named 'shortId'").

- [ ] **Step 3: 구현**
```js
// 혼동되는 i,l,o,1,0 등은 공개 id에서 제외
const ALPHABET = '0123456789abcdefghjkmnpqrstuvwxyz'

function randomFrom(set, len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (let i = 0; i < len; i++) out += set[bytes[i] % set.length]
  return out
}

export function shortId() { return randomFrom(ALPHABET, 6) }
export function secretToken() {
  const full = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return randomFrom(full, 32)
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- id`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: id/token generators"
```

---

## Task 4: bestOf 세트 승자 판정 (`src/lib/match.js`)

**Files:** Create `src/lib/match.js`, `src/lib/match.test.js`

- [ ] **Step 1: 실패 테스트 작성**
```js
import { describe, it, expect } from 'vitest'
import { gamesToWin, matchWinner } from './match.js'

describe('match', () => {
  it('gamesToWin: bestOf의 과반', () => {
    expect(gamesToWin(1)).toBe(1)
    expect(gamesToWin(3)).toBe(2)
    expect(gamesToWin(5)).toBe(3)
  })
  it('matchWinner: 단판', () => {
    expect(matchWinner([{ a: 21, b: 18 }], 1)).toBe('A')
    expect(matchWinner([{ a: 15, b: 21 }], 1)).toBe('B')
  })
  it('matchWinner: 3판2선승 - 2세트 먼저 이긴 쪽', () => {
    expect(matchWinner([{ a: 21, b: 10 }, { a: 18, b: 21 }, { a: 21, b: 19 }], 3)).toBe('A')
  })
  it('matchWinner: 아직 미결정이면 null', () => {
    expect(matchWinner([{ a: 21, b: 10 }], 3)).toBe(null)
    expect(matchWinner([], 1)).toBe(null)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- match`
Expected: FAIL.

- [ ] **Step 3: 구현**
```js
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
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- match` → PASS

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: bestOf match winner helpers"
```

---

## Task 5: 팀 분배 + 페어링 (`src/lib/balancer.js`)

참고 프로젝트의 `shuffleRandom`/`balanceByTier`를 이식하고, 복식/혼복용 `pairTeams`(자동 밸런싱 페어링)와 시드 정렬을 추가.

**Files:** Create `src/lib/balancer.js`, `src/lib/balancer.test.js`

- [ ] **Step 1: 실패 테스트 작성**
```js
import { describe, it, expect } from 'vitest'
import { pairTeams, seedOrder } from './balancer.js'

const P = (id, tier, gender = 'M') => ({ id, name: id, tier, gender })

describe('pairTeams', () => {
  it('단식: 1인 1팀', () => {
    const teams = pairTeams([P('a', 5), P('b', 3)], { matchType: 'singles', mode: 'auto' })
    expect(teams).toHaveLength(2)
    expect(teams[0].playerIds).toHaveLength(1)
  })
  it('복식 auto: 고수+하수 짝지어 전력 균형(양끝 페어링)', () => {
    // 티어 4명: 5,4,2,1 → (5+1)=6, (4+2)=6
    const teams = pairTeams([P('a',5),P('b',4),P('c',2),P('d',1)], { matchType: 'doubles', mode: 'auto' })
    expect(teams).toHaveLength(2)
    const sums = teams.map(t => t.tierSum).sort()
    expect(sums).toEqual([6, 6])
  })
  it('혼복 auto: 각 팀 남1+여1', () => {
    const players = [P('m1',5,'M'),P('m2',3,'M'),P('f1',4,'F'),P('f2',2,'F')]
    const teams = pairTeams(players, { matchType: 'mixed', mode: 'auto' })
    expect(teams).toHaveLength(2)
    for (const t of teams) {
      const gs = t.playerIds.map(id => players.find(p => p.id === id).gender).sort()
      expect(gs).toEqual(['F', 'M'])
    }
  })
})

describe('seedOrder', () => {
  it('tierSum 내림차순으로 시드 부여', () => {
    const ordered = seedOrder([{ id: 't1', tierSum: 4 }, { id: 't2', tierSum: 9 }])
    expect(ordered.map(t => t.id)).toEqual(['t2', 't1'])
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- balancer` → FAIL

- [ ] **Step 3: 구현**
```js
let _seq = 0
const teamId = () => `t${++_seq}`

// 단식: 1인 1팀
function singlesTeams(players) {
  return players.map(p => ({ id: teamId(), label: p.name, playerIds: [p.id], tierSum: p.tier }))
}

// 복식 auto: 티어 정렬 후 양끝 페어링(고수+하수)
function doublesAuto(players) {
  const sorted = [...players].sort((a, b) => b.tier - a.tier)
  const teams = []
  let i = 0, j = sorted.length - 1
  while (i < j) {
    const x = sorted[i++], y = sorted[j--]
    teams.push({ id: teamId(), label: `${x.name}+${y.name}`, playerIds: [x.id, y.id], tierSum: x.tier + y.tier })
  }
  if (i === j) { // 홀수: 남은 1명 단독(부전 인원)
    const x = sorted[i]
    teams.push({ id: teamId(), label: x.name, playerIds: [x.id], tierSum: x.tier })
  }
  return teams
}

// 혼복 auto: 남/여 각각 티어 정렬 후 남고수+여하수 식으로 균형
function mixedAuto(players) {
  const men = players.filter(p => p.gender === 'M').sort((a, b) => b.tier - a.tier)
  const women = players.filter(p => p.gender === 'F').sort((a, b) => a.tier - b.tier)
  const n = Math.min(men.length, women.length)
  const teams = []
  for (let k = 0; k < n; k++) {
    const m = men[k], w = women[k]
    teams.push({ id: teamId(), label: `${m.name}+${w.name}`, playerIds: [m.id, w.id], tierSum: m.tier + w.tier })
  }
  return teams
}

export function pairTeams(players, { matchType, mode }) {
  // mode==='manual'은 화면에서 직접 팀을 구성하므로 여기서는 auto만 처리
  if (matchType === 'singles') return singlesTeams(players)
  if (matchType === 'mixed') return mixedAuto(players)
  return doublesAuto(players)
}

export function seedOrder(teams) {
  return [...teams].sort((a, b) => b.tierSum - a.tierSum)
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- balancer` → PASS

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: team pairing and seeding"
```

---

## Task 6: 싱글 엘리미네이션 - 대진 생성 (`src/formats/singleElim.js`)

부전승(bye) 포함 브라켓 생성. `structure.rounds`는 라운드별 match id 배열, `matches`는 전체 경기.

**Files:** Create `src/formats/singleElim.js`, `src/formats/singleElim.test.js`

- [ ] **Step 1: 실패 테스트 작성**
```js
import { describe, it, expect } from 'vitest'
import { generate } from './singleElim.js'

const mkTeams = n => Array.from({ length: n }, (_, i) => ({ id: `t${i+1}`, label: `T${i+1}`, tierSum: n - i }))

describe('singleElim.generate', () => {
  it('4팀: 1라운드 2경기, 결승 1경기, 총 2라운드', () => {
    const s = generate(mkTeams(4), { bestOf: 1 })
    expect(s.structure.rounds).toHaveLength(2)
    expect(s.structure.rounds[0]).toHaveLength(2)
    expect(s.structure.rounds[1]).toHaveLength(1)
    expect(s.matches.filter(m => m.round === 1)).toHaveLength(2)
  })
  it('비-2의거듭제곱(5팀): 8칸 브라켓 + 상위시드 부전승', () => {
    const s = generate(mkTeams(5), { bestOf: 1 })
    // 1라운드 4경기 중 일부는 bye(상대 null) → 자동 done 처리
    const r1 = s.matches.filter(m => m.round === 1)
    expect(r1).toHaveLength(4)
    const byes = r1.filter(m => m.teamA === null || m.teamB === null)
    expect(byes.length).toBe(3) // 8칸 - 5팀 = 3 bye
    for (const m of byes) expect(m.status).toBe('done')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- singleElim` → FAIL

- [ ] **Step 3: 구현 (generate + 내부 헬퍼)**
```js
import { seedOrder } from '../lib/balancer.js'
import { matchWinner } from '../lib/match.js'

const nextPow2 = n => { let p = 1; while (p < n) p *= 2; return p }

// 표준 시드 배치 순서(1번시드와 2번시드가 결승에서 만나도록)
function seedSlots(size) {
  let rounds = [[1, 2]]
  while (rounds[0].length < size) {
    const prev = rounds[0]
    const sum = prev.length * 2 + 1
    const next = []
    for (const s of prev) { next.push(s); next.push(sum - s) }
    rounds = [next]
  }
  return rounds[0] // 길이 size, 값은 시드번호(1-based)
}

export function generate(teams, settings) {
  const seeded = seedOrder(teams)
  const size = nextPow2(seeded.length)
  const slots = seedSlots(size).map(seedNo => seeded[seedNo - 1] || null) // null = bye 자리

  const matches = []
  const rounds = []
  let mid = 0
  const newId = () => `m${++mid}`

  // 1라운드: 인접한 두 슬롯끼리
  let round1 = []
  for (let i = 0; i < size; i += 2) {
    const a = slots[i], b = slots[i + 1]
    const m = {
      id: newId(), round: 1, slot: i / 2, court: null,
      teamA: a ? a.id : null, teamB: b ? b.id : null,
      games: [], status: 'pending', winner: null,
    }
    // 부전승: 한쪽이 비면 자동 done
    if (m.teamA && !m.teamB) { m.status = 'done'; m.winner = m.teamA }
    else if (!m.teamA && m.teamB) { m.status = 'done'; m.winner = m.teamB }
    matches.push(m); round1.push(m.id)
  }
  rounds.push(round1)

  // 이후 라운드: 빈 경기 칸 미리 생성(teamA/B는 진출 시 채움)
  let count = size / 2
  while (count > 1) {
    count = count / 2
    const r = []
    for (let i = 0; i < count; i++) {
      const m = { id: newId(), round: rounds.length + 1, slot: i, court: null,
        teamA: null, teamB: null, games: [], status: 'pending', winner: null }
      matches.push(m); r.push(m.id)
    }
    rounds.push(r)
  }

  const state = { structure: { rounds }, matches }
  return propagate(state, settings) // bye 승자를 다음 라운드로 전진
}

// 결과로부터 다음 라운드 teamA/teamB를 다시 채움(멱등) — recompute의 핵심
export function propagate(state, settings = { bestOf: 1 }) {
  const { rounds } = state.structure
  const byId = id => state.matches.find(m => m.id === id)
  for (let r = 0; r < rounds.length - 1; r++) {
    for (let i = 0; i < rounds[r].length; i++) {
      const m = byId(rounds[r][i])
      const parent = byId(rounds[r + 1][Math.floor(i / 2)])
      const slotKey = i % 2 === 0 ? 'teamA' : 'teamB'
      // 승자 재판정
      m.winner = m.status === 'done' && m.teamA && m.teamB
        ? (matchWinner(m.games, settings.bestOf) === 'A' ? m.teamA : m.teamB)
        : (m.teamA && !m.teamB ? m.teamA : (!m.teamA && m.teamB ? m.teamB : m.winner))
      parent[slotKey] = m.winner || null
      // 부모가 양쪽 다 차고 bye면 자동 done
      if (parent.teamA && !parent.teamB && isByeContext(parent, byId, rounds, r + 1)) { /* 다음 루프에서 처리 */ }
    }
  }
  return state
}

function isByeContext() { return false } // 단순화: bye는 1라운드에서만 발생

export default { generate, propagate }
```

> 메모: `isByeContext`는 1라운드에서만 bye가 생기는 구조라 항상 false로 둔다(2의 거듭제곱 정렬 덕분). 코드 단순화를 위한 의도적 스텁.

- [ ] **Step 4: 통과 확인** — Run: `npm test -- singleElim` → PASS

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: single elimination bracket generation with byes"
```

---

## Task 7: 싱글 엘리미네이션 - 결과 반영 / 되돌리기 (`applyResult` + `recompute`)

**Files:** Modify `src/formats/singleElim.js`, `src/formats/singleElim.test.js`

- [ ] **Step 1: 실패 테스트 추가**
```js
import { generate, applyResult, recompute, isComplete, standings } from './singleElim.js'

describe('singleElim.applyResult/recompute', () => {
  const start = () => generate(mkTeams(4), { bestOf: 1 })

  it('1라운드 결과 입력 시 승자가 결승에 진출', () => {
    let s = start()
    const r1 = s.matches.filter(m => m.round === 1)
    s = applyResult(s, r1[0].id, [{ a: 21, b: 10 }], { bestOf: 1 })
    s = applyResult(s, r1[1].id, [{ a: 21, b: 15 }], { bestOf: 1 })
    const final = s.matches.find(m => m.round === 2)
    expect(final.teamA).toBe(r1[0].teamA) // 각 1라운드 승자
    expect(final.teamB).toBe(r1[1].teamA)
  })

  it('되돌리기/수정: 1라운드 점수를 바꾸면 결승 진출자도 바뀜', () => {
    let s = start()
    const r1 = s.matches.filter(m => m.round === 1)
    s = applyResult(s, r1[0].id, [{ a: 21, b: 10 }], { bestOf: 1 }) // teamA 승
    s = applyResult(s, r1[0].id, [{ a: 10, b: 21 }], { bestOf: 1 }) // 수정 → teamB 승
    const final = s.matches.find(m => m.round === 2)
    expect(final.teamA).toBe(r1[0].teamB)
  })

  it('결승까지 끝나면 isComplete=true, 우승자 노출', () => {
    let s = start()
    const r1 = s.matches.filter(m => m.round === 1)
    s = applyResult(s, r1[0].id, [{ a: 21, b: 1 }], { bestOf: 1 })
    s = applyResult(s, r1[1].id, [{ a: 21, b: 1 }], { bestOf: 1 })
    const final = s.matches.find(m => m.round === 2)
    s = applyResult(s, final.id, [{ a: 21, b: 1 }], { bestOf: 1 })
    expect(isComplete(s)).toBe(true)
    expect(standings(s).champion).toBe(final.teamA)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- singleElim` → FAIL

- [ ] **Step 3: 구현 추가**
```js
// 점수 입력/수정: 해당 경기 games·status 갱신 후 전체 재전파(되돌리기 포함)
export function applyResult(state, matchId, games, settings) {
  const next = structuredClone(state)
  const m = next.matches.find(x => x.id === matchId)
  if (!m) return next
  m.games = games
  const w = matchWinner(games, settings.bestOf)
  m.status = w ? 'done' : 'pending'
  return recompute(next, settings)
}

// 저장된 결과만으로 하류 대진 전부 재계산(멱등)
export function recompute(state, settings) {
  const next = structuredClone(state)
  // 2라운드 이상 teamA/B를 일단 비우고(결과로부터 다시 채움)
  for (const m of next.matches) {
    if (m.round > 1) { m.teamA = null; m.teamB = null; m.winner = null
      // 진출자가 사라지면 이미 입력된 점수도 무효화
      m.games = []; m.status = 'pending' }
  }
  return propagate(next, settings)
}

export function isComplete(state) {
  const last = state.structure.rounds[state.structure.rounds.length - 1]
  const finalMatch = state.matches.find(m => m.id === last[0])
  return finalMatch.status === 'done' && !!finalMatch.winner
}

export function standings(state) {
  const champion = isComplete(state)
    ? state.matches.find(m => m.id === state.structure.rounds.at(-1)[0]).winner
    : null
  return { champion }
}
```
> `default export`도 갱신: `export default { generate, propagate, applyResult, recompute, isComplete, standings }`

- [ ] **Step 4: 통과 확인** — Run: `npm test -- singleElim` → PASS (Task 6 테스트도 여전히 통과)

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: single elim result apply, edit/undo via recompute"
```

---

## Task 8: 포맷 레지스트리 (`src/formats/index.js`)

화면 코드가 포맷에 비의존하도록 단일 진입점 제공.

**Files:** Create `src/formats/index.js`, `src/formats/index.test.js`

- [ ] **Step 1: 실패 테스트**
```js
import { describe, it, expect } from 'vitest'
import { getFormat, FORMAT_LABELS } from './index.js'

describe('formats registry', () => {
  it('single_elim 모듈 반환', () => {
    const f = getFormat('single_elim')
    expect(typeof f.generate).toBe('function')
    expect(typeof f.recompute).toBe('function')
  })
  it('라벨 맵 존재', () => {
    expect(FORMAT_LABELS.single_elim).toBe('싱글 엘리미네이션')
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- formats/index` → FAIL

- [ ] **Step 3: 구현**
```js
import singleElim from './singleElim.js'

const REGISTRY = { single_elim: singleElim }

export const FORMAT_LABELS = {
  single_elim: '싱글 엘리미네이션',
  group_knockout: '조별리그 → 본선토너먼트', // 계획 2
  round_robin: '전체 풀리그',                 // 계획 2
  gameday: '게임데이 로테이션',               // 계획 2
}

export function getFormat(key) {
  const f = REGISTRY[key]
  if (!f) throw new Error(`미구현 포맷: ${key}`)
  return f
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- formats/index` → PASS

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat: format registry"
```

---

## Task 9: D1 스키마 + wrangler 설정

**Files:** Create `schema.sql`, `wrangler.toml`

- [ ] **Step 1: schema.sql 작성**
```sql
CREATE TABLE IF NOT EXISTS tournaments (
  id          TEXT PRIMARY KEY,
  admin_token TEXT NOT NULL,
  name        TEXT,
  data_json   TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
```

- [ ] **Step 2: wrangler.toml 작성**
```toml
name = "badminton-tournament"
compatibility_date = "2024-12-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "tournament-db"
database_id = "PLACEHOLDER_FILL_AFTER_CREATE"
```
> `database_id`는 Task 20에서 `wrangler d1 create` 후 실제 값으로 교체.

- [ ] **Step 3: 로컬 D1 생성 + 스키마 적용**

Run:
```bash
npx wrangler d1 create tournament-db
npx wrangler d1 execute tournament-db --local --file=schema.sql
```
Expected: 로컬 .wrangler에 DB 생성, 테이블 적용 성공 메시지. (출력된 `database_id`를 wrangler.toml에 기록)

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "chore: d1 schema and wrangler config"
```

---

## Task 10: API - 대회 생성 (`functions/api/tournament/index.js`)

**Files:** Create `functions/api/tournament/index.js`

- [ ] **Step 1: 구현 (POST 생성)**
```js
import { shortId, secretToken } from '../../../src/lib/id.js'

export async function onRequestPost({ request, env }) {
  const body = await request.json()
  const id = shortId()
  const admin_token = secretToken()
  const now = Date.now()
  const data = {
    format: body.format, matchType: body.matchType, pairingMode: body.pairingMode,
    status: 'setup', settings: body.settings || {},
    participants: [], teams: [], structure: {}, matches: [],
  }
  await env.DB.prepare(
    'INSERT INTO tournaments (id, admin_token, name, data_json, updated_at, created_at) VALUES (?,?,?,?,?,?)'
  ).bind(id, admin_token, body.name || '', JSON.stringify(data), now, now).run()
  return Response.json({ id, adminToken: admin_token })
}
```

- [ ] **Step 2: 수동 검증** (Task 12에서 클라이언트 붙인 뒤 함께 확인) — 일단 빌드 깨지지 않는지 확인:

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: api create tournament"
```

---

## Task 11: API - 조회/저장 (`functions/api/tournament/[id].js`)

**Files:** Create `functions/api/tournament/[id].js`

- [ ] **Step 1: 구현 (GET with since, PUT with token + 낙관적 동시성)**
```js
export async function onRequestGet({ params, request, env }) {
  const url = new URL(request.url)
  const since = Number(url.searchParams.get('since') || 0)
  const row = await env.DB.prepare('SELECT * FROM tournaments WHERE id=?').bind(params.id).first()
  if (!row) return new Response('not found', { status: 404 })
  if (since && row.updated_at <= since) return new Response(null, { status: 304 })
  return Response.json({
    id: row.id, name: row.name, updatedAt: row.updated_at,
    data: JSON.parse(row.data_json),
    // admin_token은 절대 내려보내지 않음
  })
}

export async function onRequestPut({ params, request, env }) {
  const row = await env.DB.prepare('SELECT * FROM tournaments WHERE id=?').bind(params.id).first()
  if (!row) return new Response('not found', { status: 404 })
  const token = request.headers.get('x-admin-token')
  if (token !== row.admin_token) return new Response('forbidden', { status: 403 })
  const body = await request.json()
  // 낙관적 동시성: 클라이언트가 본 버전이 더 오래됐으면 거부
  if (body.baseUpdatedAt && body.baseUpdatedAt < row.updated_at) {
    return new Response(JSON.stringify({ conflict: true, updatedAt: row.updated_at, data: JSON.parse(row.data_json) }),
      { status: 409, headers: { 'content-type': 'application/json' } })
  }
  const now = Date.now()
  await env.DB.prepare('UPDATE tournaments SET data_json=?, name=?, updated_at=? WHERE id=?')
    .bind(JSON.stringify(body.data), body.name ?? row.name, now, params.id).run()
  return Response.json({ updatedAt: now })
}
```

- [ ] **Step 2: 빌드 확인** — Run: `npm run build` → 성공

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: api get/put tournament with polling + optimistic concurrency"
```

---

## Task 12: API 클라이언트 + 폴링 훅 (`src/lib/api.js`)

**Files:** Create `src/lib/api.js`

- [ ] **Step 1: 구현**
```js
import { useEffect, useRef, useState } from 'react'

export async function createTournament(payload) {
  const r = await fetch('/api/tournament', { method: 'POST', body: JSON.stringify(payload) })
  if (!r.ok) throw new Error('생성 실패')
  return r.json() // { id, adminToken }
}

export async function getTournament(id, since = 0) {
  const r = await fetch(`/api/tournament/${id}?since=${since}`)
  if (r.status === 304) return null // 변경 없음
  if (r.status === 404) throw new Error('대회를 찾을 수 없습니다')
  return r.json() // { id, name, updatedAt, data }
}

export async function putTournament(id, token, data, name, baseUpdatedAt) {
  const r = await fetch(`/api/tournament/${id}`, {
    method: 'PUT',
    headers: { 'x-admin-token': token },
    body: JSON.stringify({ data, name, baseUpdatedAt }),
  })
  if (r.status === 409) { const c = await r.json(); const e = new Error('conflict'); e.conflict = c; throw e }
  if (!r.ok) throw new Error('저장 실패')
  return r.json() // { updatedAt }
}

// 4초 폴링 훅: 변경 시에만 state 갱신
export function usePolling(id, intervalMs = 4000) {
  const [state, setState] = useState(null)   // { name, updatedAt, data }
  const [error, setError] = useState(null)
  const sinceRef = useRef(0)

  useEffect(() => {
    let alive = true
    let timer
    const tick = async () => {
      try {
        const res = await getTournament(id, sinceRef.current)
        if (alive && res) { sinceRef.current = res.updatedAt; setState(res); setError(null) }
      } catch (e) { if (alive) setError(e.message) }
      timer = setTimeout(tick, intervalMs)
    }
    tick()
    return () => { alive = false; clearTimeout(timer) }
  }, [id, intervalMs])

  return { state, error, setState, sinceRef }
}
```

- [ ] **Step 2: 빌드 확인** — Run: `npm run build` → 성공

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: api client and polling hook"
```

---

## Task 13: 라우터 (`src/App.jsx`)

**Files:** Modify `src/App.jsx`

- [ ] **Step 1: 구현**
```jsx
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import AdminView from './pages/AdminView.jsx'
import PublicView from './pages/PublicView.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/t/:id/admin" element={<AdminView />} />
      <Route path="/t/:id" element={<PublicView />} />
      {/* /t/:id/board (전광판) 은 계획 3 */}
    </Routes>
  )
}
```
> 이 단계에서는 Home/AdminView/PublicView 최소 stub을 먼저 만들어 빌드가 통과하게 한다(다음 Task들에서 채움). 각 파일에 `export default function X(){ return <div className="app">X</div> }` 스텁 생성.

- [ ] **Step 2: 빌드 확인** — Run: `npm run build` → 성공

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: app router with page stubs"
```

---

## Task 14: 참가자 관리 컴포넌트 (`src/components/ParticipantManager.jsx`)

일괄 입력(줄단위) + ★티어 + 체크인(출결) + 성별(혼복용).

**Files:** Create `src/components/ParticipantManager.jsx`

- [ ] **Step 1: 구현**
```jsx
import { useState } from 'react'

let _pid = 0
const pid = () => `p${Date.now()}_${++_pid}`

export default function ParticipantManager({ participants, setParticipants, matchType }) {
  const [bulk, setBulk] = useState('')

  const addBulk = () => {
    const names = bulk.split('\n').map(s => s.trim()).filter(Boolean)
    const added = names.map(name => ({ id: pid(), name, tier: 3, gender: 'M', checkedIn: true }))
    setParticipants([...participants, ...added])
    setBulk('')
  }
  const update = (id, patch) => setParticipants(participants.map(p => p.id === id ? { ...p, ...patch } : p))
  const remove = id => setParticipants(participants.filter(p => p.id !== id))

  return (
    <div className="card">
      <h3>참가자 ({participants.filter(p => p.checkedIn).length}명 체크인)</h3>
      <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={4}
        placeholder="이름을 줄단위로 붙여넣기 (한 줄에 한 명)" style={{ width: '100%' }} />
      <button className="btn-primary" onClick={addBulk}>일괄 추가</button>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {participants.map(p => (
          <li key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
            <input type="checkbox" checked={p.checkedIn} onChange={e => update(p.id, { checkedIn: e.target.checked })} />
            <span style={{ flex: 1 }}>{p.name}</span>
            {matchType === 'mixed' && (
              <select value={p.gender} onChange={e => update(p.id, { gender: e.target.value })}>
                <option value="M">남</option><option value="F">여</option>
              </select>
            )}
            <span>
              {[1,2,3,4,5].map(s => (
                <span key={s} onClick={() => update(p.id, { tier: s })}
                  style={{ cursor: 'pointer', color: p.tier >= s ? '#f59e0b' : '#cbd5e1' }}>★</span>
              ))}
            </span>
            <button onClick={() => remove(p.id)}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```
> `.btn-primary` 스타일은 index.css에 추가: `.btn-primary{background:var(--primary);color:#fff;padding:10px 16px;}`

- [ ] **Step 2: 빌드 확인** — Run: `npm run build` → 성공

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: participant manager (bulk add, tier, check-in)"
```

---

## Task 15: 홈 화면 (`src/pages/Home.jsx`)

새 대회 생성(설정 입력) + 최근 대회 이어하기.

**Files:** Modify `src/pages/Home.jsx`

- [ ] **Step 1: 구현**
```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTournament } from '../lib/api.js'

export default function Home() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    name: '', format: 'single_elim', matchType: 'doubles', pairingMode: 'auto',
    settings: { pointsToWin: 21, bestOf: 1, courts: 2 },
  })
  const recent = JSON.parse(localStorage.getItem('recent_tournaments') || '[]')

  const create = async () => {
    const { id, adminToken } = await createTournament(form)
    const list = [{ id, name: form.name, token: adminToken }, ...recent].slice(0, 10)
    localStorage.setItem('recent_tournaments', JSON.stringify(list))
    nav(`/t/${id}/admin?token=${adminToken}`)
  }
  const set = patch => setForm({ ...form, ...patch })
  const setS = patch => setForm({ ...form, settings: { ...form.settings, ...patch } })

  return (
    <div className="app">
      <h1>🏸 배드민턴 토너먼트</h1>
      <div className="card">
        <h3>새 대회 만들기</h3>
        <input placeholder="대회 이름" value={form.name} onChange={e => set({ name: e.target.value })} style={{ width: '100%' }} />
        <label>방식 <select value={form.format} onChange={e => set({ format: e.target.value })}>
          <option value="single_elim">싱글 엘리미네이션</option>
        </select></label>
        <label>경기 <select value={form.matchType} onChange={e => set({ matchType: e.target.value })}>
          <option value="doubles">복식</option><option value="singles">단식</option><option value="mixed">혼복</option>
        </select></label>
        <label>페어링 <select value={form.pairingMode} onChange={e => set({ pairingMode: e.target.value })}>
          <option value="auto">자동 밸런싱</option><option value="manual">직접 입력</option>
        </select></label>
        <label>세트 <select value={form.settings.bestOf} onChange={e => setS({ bestOf: Number(e.target.value) })}>
          <option value={1}>단판</option><option value={3}>3판2선승</option><option value={5}>5판3선승</option>
        </select></label>
        <label>코트 수 <input type="number" min={1} value={form.settings.courts} onChange={e => setS({ courts: Number(e.target.value) })} /></label>
        <button className="btn-primary" onClick={create}>대회 생성</button>
      </div>
      {recent.length > 0 && (
        <div className="card">
          <h3>최근 대회 (운영자)</h3>
          {recent.map(r => (
            <div key={r.id}><a href={`/t/${r.id}/admin?token=${r.token}`}>{r.name || r.id}</a></div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 빌드 확인** — Run: `npm run build` → 성공

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: home page create/resume tournament"
```

---

## Task 16: 경기 카드 + 브라켓 (`src/components/MatchCard.jsx`, `Bracket.jsx`)

**Files:** Create `src/components/MatchCard.jsx`, `src/components/Bracket.jsx`

- [ ] **Step 1: MatchCard 구현 (운영자=입력, 참가자=표시)**
```jsx
import { useState } from 'react'

const teamLabel = (teams, id) => teams.find(t => t.id === id)?.label || (id ? id : '부전승')

export default function MatchCard({ match, teams, bestOf, editable, onSubmit, highlightTeamIds = [] }) {
  const sets = bestOf
  const [games, setGames] = useState(
    match.games.length ? match.games : Array.from({ length: sets }, () => ({ a: '', b: '' }))
  )
  const hl = id => highlightTeamIds.includes(id) ? { fontWeight: 800, color: 'var(--primary)' } : {}
  const setScore = (i, side, v) => { const g = [...games]; g[i] = { ...g[i], [side]: v }; setGames(g) }

  const submit = () => {
    const cleaned = games
      .map(g => ({ a: Number(g.a), b: Number(g.b) }))
      .filter(g => Number.isFinite(g.a) && Number.isFinite(g.b) && (g.a > 0 || g.b > 0))
    onSubmit(cleaned)
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={hl(match.teamA)}>{teamLabel(teams, match.teamA)}</span>
        <span>vs</span>
        <span style={hl(match.teamB)}>{teamLabel(teams, match.teamB)}</span>
      </div>
      {match.court != null && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>코트 {match.court}</div>}
      {editable && match.teamA && match.teamB ? (
        <>
          {games.map((g, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input type="number" value={g.a} onChange={e => setScore(i, 'a', e.target.value)} style={{ width: 56 }} />
              <input type="number" value={g.b} onChange={e => setScore(i, 'b', e.target.value)} style={{ width: 56 }} />
            </div>
          ))}
          <button className="btn-primary" style={{ marginTop: 6 }} onClick={submit}>
            {match.status === 'done' ? '점수 수정' : '결과 저장'}
          </button>
        </>
      ) : (
        <div style={{ marginTop: 4 }}>
          {match.games.map((g, i) => <span key={i} style={{ marginRight: 8 }}>{g.a}:{g.b}</span>)}
          {match.status === 'done' && <strong> → {teamLabel(teams, match.winner)} 승</strong>}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Bracket 구현 (라운드별 경기 나열)**
```jsx
import MatchCard from './MatchCard.jsx'

const ROUND_NAME = (idx, total) => {
  const fromEnd = total - idx
  if (fromEnd === 1) return '결승'
  if (fromEnd === 2) return '4강'
  if (fromEnd === 3) return '8강'
  return `${idx + 1}라운드`
}

export default function Bracket({ state, teams, bestOf, editable, onResult, highlightTeamIds }) {
  const { rounds } = state.structure
  const byId = id => state.matches.find(m => m.id === id)
  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
      {rounds.map((round, ri) => (
        <div key={ri} style={{ minWidth: 200 }}>
          <h4>{ROUND_NAME(ri, rounds.length)}</h4>
          {round.map(mid => {
            const m = byId(mid)
            return <MatchCard key={mid} match={m} teams={teams} bestOf={bestOf}
              editable={editable} highlightTeamIds={highlightTeamIds}
              onSubmit={games => onResult(m.id, games)} />
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 빌드 확인** — Run: `npm run build` → 성공

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat: match card and bracket components"
```

---

## Task 17: 진행 대시보드 + 공유바 (`ProgressDashboard.jsx`, `ShareBar.jsx`)

**Files:** Create `src/components/ProgressDashboard.jsx`, `src/components/ShareBar.jsx`

- [ ] **Step 1: ProgressDashboard 구현**
```jsx
export default function ProgressDashboard({ state }) {
  const matches = state.matches.filter(m => m.teamA && m.teamB) // 부전승 제외
  const done = matches.filter(m => m.status === 'done').length
  const total = matches.length
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>진행률</strong><span>{done}/{total} 경기 ({pct}%)</span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 6, height: 10, marginTop: 6 }}>
        <div style={{ width: `${pct}%`, background: 'var(--success)', height: 10, borderRadius: 6 }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: ShareBar 구현 (링크 복사 + QR)**
```jsx
import { QRCodeCanvas } from 'qrcode.react'

export default function ShareBar({ id }) {
  const url = `${window.location.origin}/t/${id}`
  const copy = () => navigator.clipboard.writeText(url)
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h3>참가자 공유</h3>
      <QRCodeCanvas value={url} size={140} />
      <div style={{ marginTop: 8, wordBreak: 'break-all' }}>{url}</div>
      <button className="btn-primary" onClick={copy}>링크 복사</button>
    </div>
  )
}
```

- [ ] **Step 3: 빌드 확인** — Run: `npm run build` → 성공

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat: progress dashboard and share bar"
```

---

## Task 18: 운영자 화면 (`src/pages/AdminView.jsx`)

setup(참가자→페어링→대진생성) → 진행(점수 입력·수정) 전체 흐름.

**Files:** Modify `src/pages/AdminView.jsx`

- [ ] **Step 1: 구현**
```jsx
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { getTournament, putTournament } from '../lib/api.js'
import { getFormat } from '../formats/index.js'
import { pairTeams } from '../lib/balancer.js'
import ParticipantManager from '../components/ParticipantManager.jsx'
import Bracket from '../components/Bracket.jsx'
import ProgressDashboard from '../components/ProgressDashboard.jsx'
import ShareBar from '../components/ShareBar.jsx'

export default function AdminView() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const token = sp.get('token')
  const [t, setT] = useState(null)          // { name, updatedAt, data }
  const [participants, setParticipants] = useState([])
  const [err, setErr] = useState(null)

  useEffect(() => { getTournament(id).then(setT).catch(e => setErr(e.message)) }, [id])
  useEffect(() => { if (t) setParticipants(t.data.participants || []) }, [t?.updatedAt])

  if (err) return <div className="app">⚠️ {err}</div>
  if (!t) return <div className="app">불러오는 중…</div>
  const data = t.data
  const fmt = getFormat(data.format)

  const save = async (newData) => {
    const res = await putTournament(id, token, newData, t.name, t.updatedAt)
    setT({ ...t, data: newData, updatedAt: res.updatedAt })
  }

  const startTournament = async () => {
    const active = participants.filter(p => p.checkedIn)
    const teams = pairTeams(active, { matchType: data.matchType, mode: data.pairingMode })
    const gen = fmt.generate(teams, data.settings)
    await save({ ...data, participants, teams, status: 'in_progress',
      structure: gen.structure, matches: gen.matches })
  }

  const onResult = async (matchId, games) => {
    const updated = fmt.applyResult({ structure: data.structure, matches: data.matches }, matchId, games, data.settings)
    await save({ ...data, structure: updated.structure, matches: updated.matches,
      status: fmt.isComplete(updated) ? 'done' : 'in_progress' })
  }

  return (
    <div className="app">
      <h2>{t.name || '대회'} (운영자)</h2>
      <ShareBar id={id} />
      {data.status === 'setup' ? (
        <>
          <ParticipantManager participants={participants} setParticipants={setParticipants} matchType={data.matchType} />
          <button className="btn-primary" onClick={startTournament}>대진 생성 & 시작</button>
        </>
      ) : (
        <>
          <ProgressDashboard state={data} />
          <Bracket state={data} teams={data.teams} bestOf={data.settings.bestOf}
            editable onResult={onResult} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 빌드 확인** — Run: `npm run build` → 성공

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: admin view (setup, generate, score entry)"
```

---

## Task 19: 참가자 화면 (`src/pages/PublicView.jsx`)

읽기 전용 + 4초 폴링 + 내 이름 하이라이트 + 우승 카드.

**Files:** Modify `src/pages/PublicView.jsx`

- [ ] **Step 1: 구현**
```jsx
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePolling } from '../lib/api.js'
import { getFormat } from '../formats/index.js'
import Bracket from '../components/Bracket.jsx'
import ProgressDashboard from '../components/ProgressDashboard.jsx'

export default function PublicView() {
  const { id } = useParams()
  const { state, error } = usePolling(id)
  const [query, setQuery] = useState('')

  const highlightTeamIds = useMemo(() => {
    if (!state || !query.trim()) return []
    const q = query.trim()
    const matchPlayer = pid => (state.data.participants.find(p => p.id === pid)?.name || '').includes(q)
    return state.data.teams.filter(t => t.playerIds.some(matchPlayer)).map(t => t.id)
  }, [state, query])

  if (error) return <div className="app">⚠️ {error}</div>
  if (!state) return <div className="app">불러오는 중…</div>
  const data = state.data
  const fmt = getFormat(data.format)

  if (data.status === 'setup') return <div className="app"><h2>{state.name}</h2><p>아직 대진이 생성되지 않았습니다.</p></div>

  const champion = fmt.isComplete(data) ? fmt.standings(data).champion : null
  const champLabel = champion && data.teams.find(t => t.id === champion)?.label

  return (
    <div className="app">
      <h2>{state.name}</h2>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>실시간 갱신 중 · 4초마다</div>
      {champLabel && <div className="card" style={{ textAlign: 'center', fontSize: 20 }}>🏆 우승: <strong>{champLabel}</strong></div>}
      <input placeholder="내 이름 검색" value={query} onChange={e => setQuery(e.target.value)} style={{ width: '100%' }} />
      <ProgressDashboard state={data} />
      <Bracket state={data} teams={data.teams} bestOf={data.settings.bestOf}
        editable={false} onResult={() => {}} highlightTeamIds={highlightTeamIds} />
    </div>
  )
}
```

- [ ] **Step 2: 로컬 통합 E2E (운영자→참가자 흐름)**

Run:
```bash
npm run build
npx wrangler pages dev dist --d1 DB=tournament-db
```
브라우저에서:
1. `http://localhost:8788/` → 새 대회 생성(복식/자동/단판) → 운영자 화면 이동
2. 참가자 일괄 추가(이름 4~6개) → 체크인 확인 → "대진 생성 & 시작"
3. 경기 점수 입력 → 진출 확인, 점수 수정 시 재계산 확인
4. 다른 탭에서 참가자 링크(`/t/:id`) 열기 → 4초 내 점수 반영 확인, 이름 검색 하이라이트
Expected: 전 과정 정상 동작.

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "feat: public live view with polling and name highlight"
```

---

## Task 20: 다크모드 토글 (`src/components/ThemeToggle.jsx`)

**Files:** Create `src/components/ThemeToggle.jsx`, Modify `src/App.jsx`

- [ ] **Step 1: ThemeToggle 구현**
```jsx
import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light') // 다크 기본
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])
  return <button onClick={() => setDark(d => !d)} style={{ position: 'fixed', top: 8, right: 8 }}>{dark ? '☀️' : '🌙'}</button>
}
```

- [ ] **Step 2: App.jsx에 추가** — `<Routes>` 위에 `<ThemeToggle />` 렌더.

- [ ] **Step 3: 빌드 확인** — Run: `npm run build` → 성공

- [ ] **Step 4: Commit**
```bash
git add -A && git commit -m "feat: dark mode toggle"
```

---

## Task 21: README + Cloudflare 배포

**Files:** Create `README.md`

- [ ] **Step 1: README 작성 (로컬 + 배포 절차)**
```markdown
# 배드민턴 토너먼트

## 로컬 개발
npm install
npm run dev                 # 프런트만 (API 없이 UI 확인)
npm test                    # 로직 테스트
# 풀스택(D1 포함):
npx wrangler d1 execute tournament-db --local --file=schema.sql
npm run build && npx wrangler pages dev dist --d1 DB=tournament-db

## Cloudflare 배포
1. GitHub 레포 생성 후 push
2. Cloudflare Dashboard → Pages → 레포 연결 (빌드: `npm run build`, 출력: `dist`)
3. 원격 D1 생성: `npx wrangler d1 create tournament-db` → 출력 database_id를 wrangler.toml에 기록
4. 원격 스키마: `npx wrangler d1 execute tournament-db --remote --file=schema.sql`
5. Pages 프로젝트 Settings → Functions → D1 바인딩 `DB` 연결
6. 이후 git push 시 자동 배포
```

- [ ] **Step 2: 원격 배포 실행** (사용자와 함께)

Run:
```bash
npx wrangler d1 create tournament-db
# database_id를 wrangler.toml에 반영 후
npx wrangler d1 execute tournament-db --remote --file=schema.sql
```
그리고 GitHub push + Cloudflare Pages 연결(README 절차).
Expected: `*.pages.dev` URL에서 동작.

- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "docs: readme and deploy guide"
```

---

## 알려진 보류 (계획 1 범위 밖 → 이후 계획)
- **직접(manual) 페어링 UI**: Home에 `manual` 옵션은 있으나 팀 직접 구성 화면은 계획 3. 계획 1 검증은 `auto`로 진행. (`pairTeams`의 `mode` 인자는 확장 대비 시그니처만 유지.)
- **409 충돌 사용자 친화 처리**: `putTournament`가 충돌 시 `e.conflict`를 던짐. 단일 운영자(A)라 드물어 계획 1에선 단순 throw. 재조회·재반영 UX는 계획 3.
- **전광판 `/t/:id/board`**: 계획 3.

## 완료 기준 (계획 1)
- `npm test` 전부 통과(id/match/balancer/singleElim/formats).
- 로컬 `wrangler pages dev`에서 싱글 엘리미네이션 대회 생성→진행→실시간 관전 동작.
- 점수 수정 시 하류 대진 자동 재계산.
- Cloudflare Pages에 배포되어 공개 URL로 접속 가능.
- 다음: 계획 2(포맷 3종), 계획 3(전광판·체크인 고도화 등).
