# 배드민턴 토너먼트 프로그램 — 설계 스펙

- **작성일**: 2026-06-22
- **개발 폴더**: `C:\Users\UserPC\Desktop\Tournament`
- **참고 폴더**: `C:\Users\UserPC\Desktop\tournament-main\team-splitter` (밸런싱 알고리즘 재활용 대상)
- **상태**: 설계 승인 완료, 구현 계획 작성 예정

---

## 1. 개요 / 목표

배드민턴 동호회 토너먼트를 운영하는 웹앱. **운영자가 점수를 입력하면 참가자들이 각자 폰으로 대진표·점수·순위를 실시간으로 확인**한다.

- 배포: 로컬 개발 → GitHub 레포 → Cloudflare Pages 연결 → `git push` 시 자동 재배포.
- 규모: 소규모, 참가자 ~40명 내외, 동시 시청 소수. → **폴링 기반 실시간**으로 충분.
- 1차 구현 범위(MVP): **참가자는 보기 전용(A)**. 이후 확장으로 B(참가자 셀프 입력), C(다중/코트별 운영자)를 염두에 둔 구조.

### 비목표 (현재 범위 밖, 추후)
- 참가자 셀프 점수 보고·셀프 체크인 (B)
- 코트별 서브 운영자 다중 입력 (C)
- 로그인/계정 시스템 (현재는 링크+토큰 기반)
- 실시간 푸시(WebSocket/Durable Objects) — 폴링으로 대체

---

## 2. 아키텍처 (접근 ①: Cloudflare Pages + D1 + 폴링)

```
[운영자]                       [Cloudflare]                    [참가자 폰들]
 운영자 화면(React) ─API 쓰기─▶ Pages Functions ◀─API 읽기(폴링)─ 보기 화면(React)
                                    │
                                    ▼
                                D1 (SQLite)  ─ tournaments 테이블(JSON 상태)
```

- **프런트엔드**: React 19 + Vite (참고 프로젝트와 동일 스택, `balancer.js` 재활용). 정적 빌드 → Cloudflare Pages.
- **백엔드 API**: Cloudflare Pages Functions(Workers).
- **저장소**: D1(SQLite). 대회 상태 전체를 JSON 한 칸에 저장 → 마이그레이션 부담 없이 데이터 모델 자유 변경 + DB의 강한 일관성/`updated_at` 확보.
- **실시간**: 참가자 화면이 `updated_at` 기준 4초 폴링, 변경 시에만 새 상태 수신.

### 라우팅 (단일 React 앱)
- `/` — 홈(새 대회 만들기 / 최근 대회 이어하기)
- `/t/:id/admin?token=...` — 운영자 화면(비밀 토큰 필요, 입력·진행)
- `/t/:id` — 참가자 보기 화면(읽기 전용, 공개 링크 + QR)
- `/t/:id/board` — 전광판/현황판 모드(TV·프로젝터용 코트별 현재경기 大화면, 읽기 전용)

### 프로젝트 구조
```
Tournament/
├─ src/
│  ├─ pages/           # Home, AdminView, PublicView
│  ├─ components/      # 대진표(Bracket), 순위표(Standings), 리더보드, 점수입력, 참가자관리, QR, 결과카드
│  ├─ formats/         # 대회 포맷 4종 (포맷별 1파일, 공통 인터페이스)
│  ├─ lib/balancer.js  # team-splitter 밸런싱 알고리즘 이식 + 페어링 확장
│  ├─ lib/api.js       # 백엔드 호출 + 폴링 훅
│  └─ App.jsx, main.jsx
├─ functions/api/tournament/[[path]].js   # Pages Functions(API)
├─ schema.sql          # D1 테이블 정의
├─ wrangler.toml       # Cloudflare 설정(D1 바인딩)
├─ package.json, vite.config.js
└─ README.md           # 배포 가이드
```

### 배포 흐름
1. `Tournament`를 git 초기화 → GitHub 새 레포 푸시.
2. Cloudflare Pages 프로젝트를 그 레포에 연결(빌드 `npm run build`, 출력 `dist`).
3. D1 DB 생성 후 Pages 프로젝트에 바인딩.
4. 이후 `git push` 시 Cloudflare 자동 빌드·배포 → `*.pages.dev` 링크로 접속.
5. 로컬 개발: `npm run dev` + `wrangler pages dev`(D1 포함)로 실제처럼 띄워 화면 보며 피드백.

---

## 3. 데이터 모델

### D1 테이블
```sql
CREATE TABLE tournaments (
  id          TEXT PRIMARY KEY,   -- 짧은 공개 ID (예: "k7m2qp")
  admin_token TEXT NOT NULL,      -- 긴 비밀 토큰 (운영자만 소유)
  name        TEXT,
  data_json   TEXT NOT NULL,      -- 대회 상태 전체 (아래 JSON)
  updated_at  INTEGER NOT NULL,   -- 폴링 비교용 타임스탬프(ms)
  created_at  INTEGER NOT NULL
);
```

### 대회 상태 JSON (`data_json`)
```jsonc
{
  "format": "single_elim | group_knockout | round_robin | gameday",
  "matchType": "doubles | singles | mixed",
  "pairingMode": "auto | manual",
  "status": "setup | in_progress | done",
  "settings": {
    "pointsToWin": 21,   // 한 세트 목표 점수
    "bestOf": 1,         // 1=단판, 3=3판2선승, 5=5판3선승 ...
    "courts": 2,         // 코트 수
    "groupCount": 4,     // (조별리그) 조 개수
    "advancersPerGroup": 2, // (조별리그) 조별 진출 인원
    "rounds": 5          // (게임데이) 라운드 수
  },
  "participants": [ { "id": "p1", "name": "철수", "tier": 4, "gender": "M", "checkedIn": true } ],
  "teams":        [ { "id": "t1", "label": "철수+영희", "playerIds": ["p1","p2"], "tierSum": 7 } ],
  "structure": { /* 포맷별 구조: 브라켓 / 조편성 / 일정표 (4장 참조) */ },
  "matches": [
    {
      "id": "m1", "round": 1, "court": 1,
      "teamA": "t1", "teamB": "t2",
      "games": [ { "a": 21, "b": 18 }, { "a": 19, "b": 21 }, { "a": 21, "b": 15 } ],
      "status": "pending | live | done",
      "winner": "t1"   // 과반 세트 승리 팀
    }
  ]
}
```
- 단식: `playerIds` 1명. 복식/혼복: 2명.
- 승자 판정: `games`에서 먼저 `ceil(bestOf/2)` 세트를 이긴 팀.

---

## 4. 대회 포맷 4종 · 페어링 · 점수/진출 로직

### 4.1 페어링(조 구성) — 대진 생성 전 단계
참가자 → 팀(team) 변환. 단식 1인=1팀, 복식/혼복 2인=1팀.
- **auto(자동 밸런싱)**: ★티어 정렬 후 고수+하수 양끝 페어링(1위+꼴찌 …)으로 팀 전력 균형. 혼복은 "남1+여1" 제약 추가. `balancer.js` 확장.
- **manual(직접 입력)**: 운영자가 팀 이름/구성원 직접 입력 또는 참가자 2명 선택.
- 생성된 팀은 `tierSum`으로 시드 배정 → 강팀 분산.
- *(복식·혼복 자동 밸런싱 세부 알고리즘은 전 기능 완성 후 별도 논의·조정)*

### 4.2 포맷별 동작
| 포맷 | structure | 경기 생성 / 진출 규칙 | 순위 결정 | 설정 |
|---|---|---|---|---|
| **싱글 엘리미네이션** | 브라켓 트리(라운드) | 2의 거듭제곱 보정 + 상위시드 부전승(bye). 점수 입력→승자 자동 다음 경기 진출 | 결승 승자=우승 | — |
| **조별리그→본선** | 조 N개(조별 풀리그)+본선 브라켓 | 조 안 전원 맞대결 → 각 조 상위 K팀 본선 진출 | 조별: 승수→득실차 / 본선: 토너먼트 | `groupCount`, `advancersPerGroup` |
| **전체 풀리그** | 전 팀 라운드로빈 일정 | 모든 팀 서로 한 번씩 | 승수→득실차→직접대결 | — |
| **게임데이 로테이션** | R개 라운드 일정 | 매 라운드 파트너/상대 섞어 재편성(최근 중복 최소화+티어 균형), 코트 수만큼 동시 진행 | 개인 승률 리더보드 | `rounds` |

### 4.3 점수 / 코트
- `bestOf` 세트 단위 입력, 과반 세트 승리 팀이 승자.
- 경기를 코트 수만큼 배정 → "내 다음 경기 = X코트" 표시.
- 점수 약검증(승자 점수 `pointsToWin` 도달 등) — 경고하되 강제 저장 허용.

### 4.4 포맷 공통 인터페이스 (격리 설계)
`src/formats/<format>.js` 각각이 동일한 함수를 노출 → 화면 코드는 포맷에 비의존:
```js
generate(teams, settings)          // 초기 structure + 첫 경기 생성
applyResult(state, matchId, games) // 점수 반영 → 진출/순위 갱신 + 다음 경기 생성
recompute(state)                   // 저장된 경기 결과만으로 structure/진출/순위 전체 재계산 (수정·되돌리기용)
standings(state)                   // 화면용 순위/리더보드
isComplete(state)                  // 종료 여부
```
> **수정·되돌리기 설계**: 진출/순위를 결과로부터 항상 재유도 가능하게 `recompute`로 일원화. 운영자가 완료 경기 점수를 고치면 `recompute(state)`가 하류 대진·순위를 자동 재계산(다운스트림 경기가 이미 진행됐다면 영향 경기만 초기화 후 재배치).

---

## 5. 접근 권한 · API · 실시간

### 권한 (로그인 없이 링크 기반)
- 생성 시 서버가 `id`(공개) + `admin_token`(비밀) 발급.
- 운영자 링크 `/t/:id/admin?token=...` → 쓰기 가능(요청마다 토큰 검증).
- 참가자 링크 `/t/:id` → 읽기 전용. 응답에 `admin_token` 미포함. QR로 표시.

### API (Pages Functions)
| 메서드 | 경로 | 용도 | 인증 |
|---|---|---|---|
| POST | `/api/tournament` | 새 대회 생성 → `{id, adminToken}` | 없음 |
| GET | `/api/tournament/:id?since=<ts>` | 상태 읽기. 변경 없으면 304 | 없음(공개) |
| PUT | `/api/tournament/:id` | 상태 전체 저장, `updated_at` 갱신 | admin_token |

### 실시간 (폴링)
- 참가자 화면: 4초마다 `GET ...?since=마지막ts` → 미변경 304, 변경 시 새 상태 리렌더.
- 운영자 화면: 입력 시 로컬 즉시 반영 + PUT. A단계 단일 운영자 → last-write-wins.
- 운영자 토큰/최근 대회를 localStorage 캐시 → 새로고침해도 운영 이어감.

---

## 6. 화면 구성

### 홈 `/`
- 새 대회 만들기: 포맷 → 경기종류 → 페어링 → 설정(`pointsToWin`, `bestOf`, 코트/조/라운드 수) → 생성.
- 최근 대회 이어하기(localStorage 토큰).

### 운영자 `/t/:id/admin?token=` — 진행 상황 한눈에
- 상단 대시보드: 전체 진행률(`12/20 경기 완료`), 현재 라운드, 코트 현황.
- 경기 카드 탭 → 세트별 점수 입력 → 확정 시 승자 자동 진출/순위 갱신.
- 뷰 전환: 브라켓 / 순위표 / 리더보드.
- 공유: 참가자 공개 링크 + QR.

### 참가자 `/t/:id` — 읽기 전용, 4초 자동 갱신
- 포맷별 브라켓 / 순위표 / 개인 승률 리더보드를 크고 읽기 쉽게.
- "진행 중인 경기" 강조 + "다음 경기" 안내 + 코트 표시.
- 내 이름 검색/하이라이트로 내 다음 경기·코트 찾기.
- "방금 업데이트됨" 표시. 종료 시 우승 결과 카드(PNG 다운로드, html2canvas 재활용).

---

## 7. 에러 처리

- 토큰 없음/틀림 → 쓰기 차단, 읽기 전용 표시. 대회 ID 없음 → 친절한 안내 화면.
- 폴링 네트워크 실패 → 마지막 상태 유지 + "연결 끊김, 재시도 중" 배지, 백오프 재시도.
- 저장 충돌 방지(낙관적 동시성): PUT 시 클라이언트가 본 `updated_at` 동봉 → 서버가 더 최신이면 거부 → 클라이언트 재조회 후 재반영.
- 점수 약검증: 경고하되 운영자 강제 저장 허용.

---

## 8. 테스트 (Vitest)

- 핵심: 포맷 4종 + 페어링의 순수 함수 단위 테스트 — `generate / applyResult / standings / isComplete`.
  - 비-2의거듭제곱 부전승, 조별 진출 계산, 풀리그 순위 동률 처리, 게임데이 중복 최소화 + 승률 집계, bestOf 세트 승패 판정.
- API 함수 가벼운 통합 테스트.
- 로컬 `wrangler pages dev`로 수동 E2E.

---

## 9. 1차 포함 추가 기능 (확정)

1차 구현 범위에 포함하기로 확정한 4가지.

### 9.1 결과 수정·되돌리기
- 운영자가 완료된 경기 점수를 수정하면 `recompute(state)`로 하류 대진·순위 자동 재계산(4.4 참조).
- 잘못 확정한 경기를 "되돌리기"하면 해당 경기 `status: pending`으로 복귀 + 영향받은 다운스트림 경기 초기화.

### 9.2 참가자 일괄 입력 + 체크인
- **일괄 입력**: 이름을 줄단위로 붙여넣기/CSV 텍스트로 한 번에 등록(티어는 일괄 등록 후 개별 조정).
- **체크인(출결)**: 각 참가자 `checkedIn` 플래그. 당일 출석한 인원만 체크 → **체크인된 참가자만으로 페어링·대진 생성**(노쇼 자동 제외).

### 9.3 다크모드 + 공유 버튼
- 라이트/다크 토글(참고 프로젝트 `index.css`의 다크모드 변수 재활용), 선택값 localStorage 저장.
- 참가자 공개 링크 옆 **"링크 복사"** 버튼(클립보드) + QR로 카톡 등 공유 용이.

### 9.4 전광판/현황판 모드 `/t/:id/board`
- TV·프로젝터에 띄우는 읽기 전용 大화면. **코트별 현재 진행 경기**(팀명·세트 점수)와 다음 대기 경기, 전체 진행률을 큰 글씨로.
- 참가자 화면과 동일한 4초 폴링 데이터 사용.

---

## 10. 향후 확장 (참고)
- B: 참가자 셀프 점수 보고 / 참가자 본인 셀프 체크인 → 토큰 역할 추가 + 충돌 검증.
- C: 코트별 서브 운영자 다중 입력 → 경기 단위 락/병합.
- bestOf 외 추가 규칙, 커스텀 도메인, 대회 히스토리/아카이브, 내 경기 호출 알림(소리·진동), 라이브 랠리 카운터.
