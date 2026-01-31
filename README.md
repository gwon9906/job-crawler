
# Job Crawler

GitHub Actions로 자동 실행되는 채용공고 크롤러입니다.  
원티드에서 관심 키워드/기업의 공고를 수집하여 Notion에 저장합니다.

## 설정 방법

### 1. GitHub Secrets 등록
Repository → Settings → Secrets and variables → Actions

| Name | Value |
|------|-------|
| `NOTION_TOKEN` | Notion Integration 시크릿 키 |
| `NOTION_DATABASE_ID` | Notion 데이터베이스 ID |

### 2. Notion 데이터베이스 컬럼 구성

| 컬럼명 | 타입 |
|--------|------|
| 제목 | Title |
| 회사 | Text |
| 링크 | URL |
| 플랫폼 | Select |
| 수집일 | Date |
| 키워드 | Multi-select |
| JobID | Text |

> ⚠️ **JobID** 컬럼을 꼭 추가해주세요! (중복 방지용)

### 3. 키워드/기업 수정
`crawler.py`에서 `KEYWORDS`, `TARGET_COMPANIES`, `SEARCH_QUERIES`를 수정하세요.

## 실행

- **자동**: 매일 한국시간 오전 9시, 오후 6시
- **수동**: Actions 탭 → "Job Crawler" → "Run workflow"

## 구조

```
.
├── .github/workflows/crawl.yml  # GitHub Actions 설정
├── crawler.py                    # 메인 크롤러
└── README.md
```
