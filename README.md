
# Job Crawler

원티드/잡코리아/인디스워크에서 ML·AI 관련 신입 채용공고를 수집해
**MongoDB Atlas**에 적재하고, **Next.js 대시보드**(Vercel 배포 가능)에서 필터링·지원 체크할 수 있는 프로젝트입니다.

```
.
├── crawler.py                    # 크롤러 (GitHub Actions에서 실행)
├── requirements.txt
├── .github/workflows/crawl.yml   # 하루 2회 자동 실행
└── web/                          # Next.js 14 (App Router) 대시보드
    ├── app/
    ├── components/
    └── lib/mongodb.ts
```

## 1. 크롤러 (Python)

### GitHub Secrets
Repository → Settings → Secrets and variables → Actions

| Name | Required | 설명 |
|---|---|---|
| `MONGODB_URI` | ✅ | Atlas 접속 문자열 (`mongodb+srv://…`) |
| `MONGODB_DB` |  | 기본값 `job_crawler` |
| `MONGODB_COLLECTION` |  | 기본값 `jobs` |

### 실행
- **자동**: 한국시간 매일 09:00 / 18:00 (`.github/workflows/crawl.yml`)
- **수동**: Actions 탭 → "Job Crawler" → "Run workflow"

### 저장 스키마 (`jobs` 컬렉션)

| 필드 | 타입 | 비고 |
|---|---|---|
| `job_id` | string | unique. 예: `wanted_12345` |
| `title` | string | 직무명 |
| `company` | string | 회사명 |
| `url` | string | 공고 링크 |
| `platform` | string | `원티드` / `잡코리아` / `인디스워크` |
| `matched_keywords` | string[] | 매칭된 키워드 |
| `employee_count` | int? | 직원 수 (원티드 detail에서 수집) |
| `industry` | string? | 업종 |
| `due_date` | Date? | 마감일 |
| `collected_at` | Date | 최초 수집 시각 |
| `updated_at` | Date | 최근 업데이트 시각 |
| `status` | string | `new` / `interested` / `applied` / `rejected` / `expired` |
| `applied` | bool | 지원 여부 |
| `applied_at` | Date? | 지원 시각 |

중복 방지는 `job_id` upsert로 처리되며, 이미 저장된 문서의 `applied` / `status`는 크롤러가 덮어쓰지 않습니다 (`$setOnInsert`).

### 키워드/기업 수정
`crawler.py` 상단의 `INCLUDE_KEYWORDS`, `EXCLUDE_KEYWORDS`, `TARGET_COMPANIES`, `SEARCH_QUERIES`를 수정하세요.

## 2. 웹 대시보드 (Next.js)

### 로컬 실행
```bash
cd web
cp .env.local.example .env.local      # MONGODB_URI 채우기
npm install
npm run dev                            # http://localhost:3000
```

### 주요 기능
- 카드 리스트: 회사 / 직무 / 마감일 / 직원 수 / 업종 / 키워드 / 링크
- 필터: 키워드(부분일치) · 플랫폼 · 회사 규모(스타트업/중소/중견/대기업/미상) · 지원 상태
- 지원 체크박스: `PATCH /api/jobs/[job_id]` → MongoDB `applied`/`applied_at`/`status` 업데이트
- 마감일 임박(≤3일) / 마감 지난 공고 시각화

### Vercel 배포
1. 이 레포를 Vercel 프로젝트로 import
2. **Root Directory**를 `web` 으로 지정
3. Environment Variables에 `MONGODB_URI` (필수), 필요 시 `MONGODB_DB` / `MONGODB_COLLECTION` 추가
4. MongoDB Atlas Network Access에 `0.0.0.0/0` 또는 [Vercel 출구 IP](https://vercel.com/guides/how-to-allowlist-deployment-ip-address) 등록

Vercel 빌드는 `npm run build`로 실행됩니다.

## 3. 의존성

### Python
```
requests, beautifulsoup4, python-dateutil, pymongo[srv]
```
(`requirements.txt` 참고)

### Node
`web/package.json` 참고 (Next 14, React 18, mongodb 6, Tailwind 3)
