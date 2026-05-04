# 매일 기술 뉴스 PWA (Vercel) — 무료 운영판

매일 한국시간 오전 7시에 개발 트렌드 / AI / 전기차·자율주행 뉴스를 자동 수집하고
모바일에 푸시 알림까지 보내는 풀스택 PWA. **LLM API 키 없이 100% 무료**로 운영됩니다.

## 무엇을 하는가

- Google News의 한국어 RSS를 카테고리별로 가져옵니다 (개발/AI/전기차)
- 중복을 제거하고 매체 이름을 정리해서 카테고리당 최대 7건을 추립니다
- Vercel KV에 캐시한 뒤, 등록된 휴대폰에 Web Push 알림을 보냅니다
- 사용자는 PWA로 설치된 앱에서 헤드라인 + RSS 요약 + 원문 링크를 봅니다

## 비용 (전부 무료 티어)

| 서비스 | 사용 용도 | 무료 한도 | 이 앱이 쓰는 양 |
|---|---|---|---|
| Vercel Hobby | 호스팅 + Functions + Cron | 100GB 대역, 100K 호출/월, 1 cron | 하루 ~5호출 |
| Vercel KV (Upstash) | 캐시 + 푸시 구독 | 10K 명령/일 | 하루 ~10명령 |
| GitHub | 코드 저장소 | 무제한 (public) | — |

월 비용: **$0**.

## 1. 사전 준비물

| 항목 | 어디서 |
|---|---|
| Vercel 계정 | https://vercel.com |
| GitHub 계정 | https://github.com |
| Node 20+ (로컬 VAPID 생성용) | https://nodejs.org |

## 2. 로컬 준비 (5분)

```bash
cd news-pwa
npm install

# VAPID 키 생성 → 출력값 메모해 둡니다 (나중에 Vercel 환경변수에 넣음)
npm run vapid

# CRON_SECRET 무작위 문자열 생성
openssl rand -hex 32
# Windows PowerShell: -join ((48..57)+(97..122) | Get-Random -Count 64 | %{[char]$_})
```

## 3. GitHub에 올리기

```bash
git init
git add -A
git commit -m "initial: daily tech news PWA"
git branch -M main
gh repo create news-pwa --public --source=. --push
# 또는: GitHub 웹에서 빈 리포 만들고 git remote add → git push
```

## 4. Vercel 배포

1. https://vercel.com/new → "Import Git Repository" → 방금 만든 `news-pwa` 선택
2. Framework Preset = **Other**
3. **Deploy** 버튼 — 첫 배포 (실패해도 됨, 환경변수 아직 없음)

## 5. Vercel KV 연결

1. 프로젝트 대시보드 → **Storage** 탭
2. **Create Database** → **KV** 선택 → 이름 아무거나 → **Create**
3. **Connect Project** → 현재 프로젝트 선택 → 모든 환경 체크 → **Connect**
4. `KV_REST_API_URL`, `KV_REST_API_TOKEN` 자동 주입됨

## 6. 환경변수 채우기

프로젝트 → **Settings** → **Environment Variables** 에서 아래 추가
(Production / Preview / Development 모두 체크):

```
VAPID_PUBLIC_KEY      = B...                              ← `npm run vapid` 출력
VAPID_PRIVATE_KEY     = ...                               ← `npm run vapid` 출력
VAPID_SUBJECT         = mailto:junghun.lee@itcen.com     ← 본인 이메일
CRON_SECRET           = <openssl rand -hex 32 결과>       ← Cron 인증용
```

KV 변수는 5단계에서 자동으로 들어가니 따로 넣을 필요 없습니다.

## 7. 재배포 + 첫 갱신

1. **Deployments** 탭 → 최신 배포의 ⋯ → **Redeploy** (환경변수 반영)
2. 한 번 수동으로 다이제스트 생성:

```bash
curl -X POST https://<your-project>.vercel.app/api/refresh \
  -H "Authorization: Bearer <CRON_SECRET>"
```

10초 뒤 JSON 응답이 오면 성공.

## 8. 휴대폰에 설치

1. Android Chrome으로 `https://<your-project>.vercel.app` 접속
2. 주소창 옆 **⋮** → **앱 설치** (또는 자동 배너)
3. 홈화면 아이콘 생성 — 탭하면 풀스크린 앱처럼 실행
4. 우상단 🔔 버튼 → 알림 권한 허용 → 끝

이제 매일 한국시간 7시에 푸시가 도착합니다.

## 9. iOS Safari 사용자 안내

- iOS 16.4+ 부터 PWA 푸시 지원되지만, **반드시 홈화면에 추가한 상태**여야 합니다.
- Safari에서 사이트 열기 → 공유 버튼 → "홈 화면에 추가" → 홈에서 앱 실행 → 🔔 탭

## 10. 운영 팁

- **로그 확인**: Vercel 대시보드 → Functions → `api/refresh` → 최근 호출 클릭
- **Cron 동작 확인**: Settings → Cron Jobs 에서 다음 실행 시각·최근 실행 결과
- **수동 갱신**: 위 7번의 curl 명령 재사용
- **카테고리 추가/변경**: `lib/rss.js` 의 `QUERIES` / `CATEGORIES` 수정 후 재배포
- **시간 변경**: `vercel.json` 의 cron 표현식 수정 (UTC 기준! `0 22 * * *` = 한국시간 7시)
- **나중에 AI 요약 추가**: `lib/summarize.js` 를 LLM 호출 버전으로 교체 (반환 형태 동일하게 유지)

## 11. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `/api/news` 가 `아직 첫 갱신이 실행되지 않았습니다` 반환 | 7번 단계의 수동 curl 한 번 실행 |
| `/api/refresh` 가 401 | Authorization 헤더의 CRON_SECRET 확인 |
| 갱신은 되는데 푸시가 안 옴 | VAPID 키 3종 모두 설정됐는지 확인. 🔔로 한 번 구독했는지 확인 |
| Cron이 실행 안 됨 | Vercel Hobby는 daily cron만 1개 허용. `0 22 * * *` 형식 OK |
| RSS는 비었는데 에러 없음 | Google News가 한국어 결과를 적게 반환. `lib/rss.js`의 `QUERIES` 키워드 조정 |

## 12. 디렉토리 구조

```
news-pwa/
├── api/
│   ├── news.js              GET /api/news — 캐시된 다이제스트 반환
│   ├── refresh.js           POST /api/refresh — 수집·요약·푸시 (Cron 호출)
│   ├── subscribe.js         POST /api/subscribe — 푸시 구독 저장
│   └── vapid-public-key.js  GET /api/vapid-public-key — 공개키 노출
├── lib/
│   ├── kv.js                Upstash Redis 클라이언트
│   ├── rss.js               한국어 Google News 수집·파싱
│   ├── summarize.js         LLM 없는 큐레이터 (중복 제거 + 정리)
│   └── push.js              web-push 발송 + 죽은 구독 정리
├── public/
│   ├── index.html           PWA 앱 셸 (인라인 CSS/JS)
│   ├── manifest.json        PWA 매니페스트
│   ├── sw.js                Service Worker
│   └── icon-{192,512,maskable}.png
├── scripts/
│   └── gen-vapid.mjs        VAPID 키 생성기
├── package.json
├── vercel.json              Cron 설정
├── .env.example
└── README.md (이 파일)
```

## 라이선스

자유롭게 수정·배포하세요.
