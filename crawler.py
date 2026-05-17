import os
import time
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

import requests
from bs4 import BeautifulSoup
from dateutil import parser as date_parser
from pymongo import MongoClient, UpdateOne
from pymongo.errors import PyMongoError

# ============ 설정 ============

YEARS_OF_EXPERIENCE = 0  # 0 = 신입

INCLUDE_KEYWORDS = [
    "ML Engineer", "AI Engineer", "Machine Learning Engineer",
    "머신러닝 엔지니어", "AI 엔지니어", "인공지능 엔지니어",
    "Algorithm Engineer", "알고리즘 엔지니어",
    "Research Engineer", "리서치 엔지니어",
    "Deep Learning", "딥러닝",
    "AI Researcher", "AI 연구원", "ML 연구원",
    "모델 개발", "모델 최적화",
    "Edge AI", "임베디드 AI", "온디바이스",
    "신호처리", "signal processing",
]

EXCLUDE_KEYWORDS = [
    # 인프라/플랫폼/운영
    "MLOps", "ML Ops", "서빙", "Serving", "인프라", "Infrastructure",
    "DevOps", "SRE", "Platform Engineer", "Site Reliability",
    "DBA", "Database Administrator", "데이터베이스 관리자",
    # 데이터 인접 직군 (사용자 직무와 다름)
    "Data Engineer", "데이터 엔지니어", "데이터엔지니어",
    "Data Analyst", "데이터 분석가", "데이터분석가",
    "BI ", "비즈니스 분석", "Business Analyst",
    # 비개발 직무
    "PM", "Product Manager", "프로덕트 매니저", "프로젝트 매니저", "TPM",
    "마케팅", "Marketing", "영업", "Sales", "BD", "Business Development",
    "기획", "Planner", "컨설턴트", "Consultant", "Consulting",
    "디자이너", "Designer", "UX ", "UI ", "그래픽",
    "HR", "인사", "리쿠르터", "Recruiter", "재무", "회계",
    "교사", "강사", "Teacher", "Instructor", "튜터",
    "고객", "CS", "Customer Success",
    # 다른 개발 도메인
    "백엔드", "Backend", "프론트엔드", "Frontend",
    "풀스택", "Fullstack", "Full-stack", "Web 개발", "웹 개발자",
    "iOS", "안드로이드", "Android", "모바일 개발",
    "게임", "Game", "Unity", "Unreal",
    "Firmware", "펌웨어", "회로", "전자회로",
    "보안", "Security", "정보보안",
    "Solution Architect", "솔루션 컨설팅", "솔루션 아키텍트",
    "QA", "테스터", "Tester", "Quality Assurance",
    # 영상/콘텐츠
    "영상편집", "Video Editor", "콘텐츠 마케팅",
]

# 강한 매칭용 핵심 키워드 (이 중 하나는 반드시 포함되어야 함)
CORE_KEYWORDS = [
    "ai", "ml", "machine learning", "deep learning", "머신러닝", "딥러닝",
    "인공지능", "algorithm engineer", "알고리즘", "research engineer",
    "리서치 엔지니어", "edge ai", "온디바이스", "신호처리",
    "모델 개발", "모델 최적화", "ai researcher", "ml engineer", "ai engineer",
]

TARGET_COMPANIES = [
    "퓨리오사", "Furiosa", "퓨리오사AI", "FuriosaAI",
    "리벨리온", "Rebellions",
    "사피온", "Sapeon",
    "딥엑스", "DeepX",
    "모빌린트", "Mobilint",
    "애널로그에이아이", "AnalogAI", "Analog AI",
    "인디스워크", "inthiswork", "InThisWork",
]

SEARCH_QUERIES = [
    "ML Engineer",
    "AI Engineer",
    "머신러닝",
    "딥러닝",
    "Algorithm Engineer",
    "Research Engineer",
    "Edge AI",
    "신입 AI",
    "신입 머신러닝",
]

def _clean_env(name: str, default: str = "") -> str:
    value = os.environ.get(name, default) or default
    return value.strip().strip('"').strip("'").strip()


MONGODB_URI = _clean_env("MONGODB_URI")
MONGODB_DB = _clean_env("MONGODB_DB", "job_crawler")
MONGODB_COLLECTION = _clean_env("MONGODB_COLLECTION", "jobs")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
HEADERS = {"User-Agent": UA}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("crawler")


# ============ 키워드 매칭 ============
def check_keywords(title: str, company: str):
    """EXCLUDE 매칭 시 None, 아니면 INCLUDE 매칭 결과(빈 리스트 가능) 반환."""
    title_lower = title.lower()
    for keyword in EXCLUDE_KEYWORDS:
        if keyword.lower() in title_lower:
            return None
    return [kw for kw in INCLUDE_KEYWORDS if kw.lower() in title_lower]


def has_core_keyword(title: str) -> bool:
    title_lower = title.lower()
    return any(core in title_lower for core in CORE_KEYWORDS)


def keep_job(title: str, company: str):
    """수집 대상이면 매칭 키워드 리스트(또는 ['관심기업'])를 반환, 아니면 None."""
    matched = check_keywords(title, company)
    if matched is None:
        return None  # EXCLUDE
    is_target = is_target_company(company)
    if is_target:
        return matched if matched else ["관심기업"]
    # 비-타깃 회사: CORE 키워드 + INCLUDE 매칭 둘 다 필요
    if not has_core_keyword(title):
        return None
    if not matched:
        return None
    return matched


def is_target_company(company: str) -> bool:
    company_lower = company.lower()
    return any(t.lower() in company_lower for t in TARGET_COMPANIES)


# ============ 원티드 ============
WANTED_SEARCH_URL = "https://www.wanted.co.kr/api/v4/jobs"
WANTED_DETAIL_URL = "https://www.wanted.co.kr/api/chaos/jobs/v4/{job_id}/details"
WANTED_COMPANY_URL = "https://www.wanted.co.kr/api/chaos/companies/v4/{company_id}"


def _parse_date(value) -> Optional[datetime]:
    if not value:
        return None
    try:
        if isinstance(value, dict):
            value = value.get("date") or value.get("end_at") or value.get("until")
        if not value:
            return None
        dt = date_parser.parse(str(value))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _extract_employee_count(company_obj: dict) -> Optional[int]:
    if not isinstance(company_obj, dict):
        return None
    for key in ("employee_count", "employee", "employee_size", "size"):
        value = company_obj.get(key)
        if isinstance(value, int) and value > 0:
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
        if isinstance(value, dict):
            inner = value.get("count") or value.get("value")
            if isinstance(inner, int):
                return inner
    return None


def fetch_wanted_detail(job_id: str) -> dict:
    """원티드 단건 상세 (직원 수/업종/마감일 등)."""
    detail = {"employee_count": None, "industry": None, "due_date": None}
    try:
        resp = requests.get(
            WANTED_DETAIL_URL.format(job_id=job_id),
            headers=HEADERS,
            timeout=10,
        )
        if resp.status_code != 200:
            return detail
        payload = resp.json().get("data", {})
        job_data = payload.get("job") if isinstance(payload, dict) else None
        if not isinstance(job_data, dict):
            return detail

        company_obj = job_data.get("company", {}) or {}
        detail["industry"] = (
            company_obj.get("industry_name")
            or company_obj.get("industry")
            or (company_obj.get("industry_v2") or {}).get("name")
        )
        detail["due_date"] = _parse_date(job_data.get("due_time"))
        detail["employee_count"] = _extract_employee_count(company_obj)

        if detail["employee_count"] is None and company_obj.get("id"):
            company_id = company_obj.get("id")
            try:
                c_resp = requests.get(
                    WANTED_COMPANY_URL.format(company_id=company_id),
                    headers=HEADERS,
                    timeout=10,
                )
                if c_resp.status_code == 200:
                    c_data = c_resp.json().get("data", {})
                    inner = c_data.get("company") if isinstance(c_data, dict) else None
                    detail["employee_count"] = _extract_employee_count(inner or c_data)
            except (requests.RequestException, ValueError):
                pass
    except (requests.RequestException, ValueError) as e:
        log.warning("원티드 상세 조회 실패 (%s): %s", job_id, e)
    return detail


def search_wanted(query: str):
    jobs = []
    params = {
        "country": "kr",
        "job_sort": "job.latest_order",
        "locations": "all",
        "years": YEARS_OF_EXPERIENCE,
        "query": query,
        "limit": 20,
    }
    try:
        resp = requests.get(WANTED_SEARCH_URL, params=params, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            log.warning("원티드 검색 실패 (%s): %s", query, resp.status_code)
            return jobs
        data = resp.json()
        for item in data.get("data", []):
            wanted_id = str(item.get("id", ""))
            if not wanted_id:
                continue
            title = item.get("position", "") or ""
            company_obj = item.get("company", {}) or {}
            company = company_obj.get("name", "") or ""

            matched = keep_job(title, company)
            if matched is None:
                continue

            jobs.append({
                "job_id": f"wanted_{wanted_id}",
                "wanted_id": wanted_id,
                "title": title,
                "company": company,
                "company_id": company_obj.get("id"),
                "url": f"https://www.wanted.co.kr/wd/{wanted_id}",
                "platform": "원티드",
                "matched_keywords": matched,
                "industry": company_obj.get("industry_name"),
                "due_date": _parse_date(item.get("due_time")),
                "employee_count": None,
            })
    except (requests.RequestException, ValueError) as e:
        log.warning("원티드 크롤링 에러 (%s): %s", query, e)
    return jobs


# ============ 잡코리아 ============
def search_jobkorea():
    jobs = []
    for query in SEARCH_QUERIES:
        try:
            url = f"https://www.jobkorea.co.kr/Search/?stext={query}&careerType=1"
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code != 200:
                continue
            soup = BeautifulSoup(resp.text, "html.parser")
            for item in soup.select(".list-default .list-post"):
                try:
                    company_elem = item.select_one(".post-list-corp a.name")
                    title_elem = item.select_one(".post-list-info a.title")
                    if not company_elem or not title_elem:
                        continue
                    company = company_elem.get_text(strip=True)
                    title = title_elem.get_text(strip=True)
                    link = title_elem.get("href", "")
                    if link and not link.startswith("http"):
                        link = f"https://www.jobkorea.co.kr{link}"

                    matched = keep_job(title, company)
                    if matched is None:
                        continue

                    short_id = hashlib.md5(f"{company}_{title}".encode()).hexdigest()[:12]
                    jobs.append({
                        "job_id": f"jobkorea_{short_id}",
                        "title": title,
                        "company": company,
                        "url": link,
                        "platform": "잡코리아",
                        "matched_keywords": matched,
                    })
                except Exception:
                    continue
        except requests.RequestException as e:
            log.warning("잡코리아 크롤링 에러 (%s): %s", query, e)
    return jobs


# ============ 인디스워크 ============
def search_inthiswork():
    jobs = []
    for page_url in ("https://inthiswork.com/it", "https://inthiswork.com/data"):
        try:
            resp = requests.get(page_url, headers=HEADERS, timeout=10)
            if resp.status_code != 200:
                continue
            soup = BeautifulSoup(resp.text, "html.parser")
            for link in soup.find_all("a", href=True):
                text = link.get_text(strip=True)
                if "｜" not in text:
                    continue
                if "채용" not in text and not any(
                    kw.lower() in text.lower() for kw in INCLUDE_KEYWORDS
                ):
                    continue
                parts = text.split("｜")
                if len(parts) < 2:
                    continue
                company, title = parts[0].strip(), parts[1].strip()

                matched = keep_job(title, company)
                if matched is None:
                    continue

                href = link.get("href", "")
                job_url = href if href.startswith("http") else f"https://inthiswork.com{href}"
                short_id = hashlib.md5(f"{company}_{title}".encode()).hexdigest()[:12]
                jobs.append({
                    "job_id": f"inthiswork_{short_id}",
                    "title": title,
                    "company": company,
                    "url": job_url,
                    "platform": "인디스워크",
                    "matched_keywords": matched,
                })
        except requests.RequestException as e:
            log.warning("인디스워크 크롤링 에러: %s", e)
    return jobs


# ============ MongoDB ============
def build_upsert_op(job: dict, now: datetime) -> UpdateOne:
    set_fields = {
        "job_id": job["job_id"],
        "title": job.get("title"),
        "company": job.get("company"),
        "url": job.get("url"),
        "platform": job.get("platform"),
        "matched_keywords": job.get("matched_keywords", []),
        "employee_count": job.get("employee_count"),
        "industry": job.get("industry"),
        "due_date": job.get("due_date"),
        "company_id": job.get("company_id"),
        "wanted_id": job.get("wanted_id"),
        "updated_at": now,
    }
    set_fields = {k: v for k, v in set_fields.items() if v is not None or k in {
        "matched_keywords", "title", "company", "url", "platform", "updated_at", "job_id"
    }}

    set_on_insert = {
        "collected_at": now,
        "status": "new",
        "applied": False,
        "applied_at": None,
    }

    return UpdateOne(
        {"job_id": job["job_id"]},
        {"$set": set_fields, "$setOnInsert": set_on_insert},
        upsert=True,
    )


def save_jobs(jobs: list) -> tuple:
    if not jobs:
        return 0, 0
    client = MongoClient(MONGODB_URI)
    try:
        coll = client[MONGODB_DB][MONGODB_COLLECTION]
        coll.create_index("job_id", unique=True)
        coll.create_index("platform")
        coll.create_index("due_date")
        coll.create_index("collected_at")

        now = datetime.now(timezone.utc)
        ops = [build_upsert_op(job, now) for job in jobs]
        result = coll.bulk_write(ops, ordered=False)
        return result.upserted_count, result.modified_count
    finally:
        client.close()


def existing_job_ids() -> set:
    client = MongoClient(MONGODB_URI)
    try:
        coll = client[MONGODB_DB][MONGODB_COLLECTION]
        return {doc["job_id"] for doc in coll.find({}, {"job_id": 1})}
    finally:
        client.close()


# ============ 메인 ============
def main():
    log.info("=" * 50)
    log.info("채용공고 크롤링 시작")
    log.info("=" * 50)

    if not MONGODB_URI:
        log.error("MONGODB_URI 환경변수가 설정되지 않았습니다.")
        return
    if not MONGODB_URI.startswith(("mongodb://", "mongodb+srv://")):
        log.error(
            "MONGODB_URI 형식이 잘못되었습니다 (시작 문자열: %r). "
            "GitHub Secret 값에 따옴표/공백이 포함되지 않았는지 확인하세요.",
            MONGODB_URI[:20],
        )
        return

    try:
        known_ids = existing_job_ids()
    except PyMongoError as e:
        log.error("MongoDB 연결 실패: %s", e)
        return
    log.info("기존 저장된 공고 수: %d", len(known_ids))

    all_jobs = []
    seen = set()
    platform_counts: dict = {}

    def add_jobs(source: str, jobs_list: list):
        before = len(all_jobs)
        for job in jobs_list:
            if job["job_id"] in seen:
                continue
            seen.add(job["job_id"])
            all_jobs.append(job)
        platform_counts[source] = platform_counts.get(source, 0) + (len(all_jobs) - before)

    for query in SEARCH_QUERIES:
        log.info("원티드 검색: %s", query)
        add_jobs("원티드", search_wanted(query))

    log.info("인디스워크 크롤링")
    add_jobs("인디스워크", search_inthiswork())

    log.info("잡코리아 크롤링")
    add_jobs("잡코리아", search_jobkorea())

    log.info("수집된 공고 수: %d (플랫폼별: %s)", len(all_jobs), platform_counts)

    new_wanted = [j for j in all_jobs if j["platform"] == "원티드" and j["job_id"] not in known_ids]
    log.info("원티드 신규 상세 조회: %d건", len(new_wanted))
    for idx, job in enumerate(new_wanted, 1):
        detail = fetch_wanted_detail(job["wanted_id"])
        job["employee_count"] = detail["employee_count"]
        if not job.get("industry"):
            job["industry"] = detail["industry"]
        if not job.get("due_date"):
            job["due_date"] = detail["due_date"]
        if idx % 5 == 0:
            time.sleep(1)  # 레이트 리밋 보호

    try:
        upserted, modified = save_jobs(all_jobs)
        log.info("신규 저장: %d건 / 업데이트: %d건", upserted, modified)
    except PyMongoError as e:
        log.error("MongoDB 저장 실패: %s", e)


if __name__ == "__main__":
    main()
