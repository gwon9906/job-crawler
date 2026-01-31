import os
import requests
from datetime import datetime, timezone
from dateutil import parser as date_parser
from bs4 import BeautifulSoup
import json
import hashlib

# ============ 설정 ============

# 경력 필터 (0 = 신입)
YEARS_OF_EXPERIENCE = 0

# 포함 키워드 (제목에 이 중 하나라도 있으면 관심 대상)
INCLUDE_KEYWORDS = [
    # 직무명
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

# 제외 키워드 (제목에 이 중 하나라도 있으면 제외)
EXCLUDE_KEYWORDS = [
    # 인프라/서빙
    "MLOps", "ML Ops", "서빙", "Serving", "인프라", "Infrastructure",
    "DevOps", "SRE", "Platform",
    # 비개발 직무
    "PM", "Product Manager", "프로덕트 매니저",
    "마케팅", "Marketing", "영업", "Sales",
    "기획", "Planner", "컨설턴트", "Consultant",
    # 기타 개발 (순수 백엔드/프론트)
    "백엔드", "Backend", "프론트엔드", "Frontend",
    "풀스택", "Fullstack", "Full-stack",
    "QA", "테스터", "Tester",
]

# 관심 회사 (이 회사들은 키워드 체크 후 수집)
TARGET_COMPANIES = [
    "퓨리오사", "Furiosa", "퓨리오사AI", "FuriosaAI",
    "리벨리온", "Rebellions",
    "사피온", "Sapeon",
    "딥엑스", "DeepX",
    "모빌린트", "Mobilint",
    "애널로그에이아이", "AnalogAI", "Analog AI",
    "인디스워크", "inthiswork", "InThisWork",
]

# 검색 쿼리 (원티드에서 검색할 키워드들)
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

NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
NOTION_DATABASE_ID = os.environ.get("NOTION_DATABASE_ID")

# ============ Notion API ============
def get_existing_job_ids():
    """이미 저장된 공고의 ID들을 가져옴 (중복 방지)"""
    url = f"https://api.notion.com/v1/databases/{NOTION_DATABASE_ID}/query"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    existing_ids = set()
    has_more = True
    start_cursor = None
    
    while has_more:
        payload = {"page_size": 100}
        if start_cursor:
            payload["start_cursor"] = start_cursor
            
        response = requests.post(url, headers=headers, json=payload)
        if response.status_code != 200:
            print(f"Notion 쿼리 실패: {response.text}")
            return existing_ids
            
        data = response.json()
        for page in data.get("results", []):
            props = page.get("properties", {})
            job_id_prop = props.get("JobID", {})
            if job_id_prop.get("rich_text"):
                job_id = job_id_prop["rich_text"][0]["plain_text"]
                existing_ids.add(job_id)
        
        has_more = data.get("has_more", False)
        start_cursor = data.get("next_cursor")
    
    return existing_ids

def save_to_notion(job):
    """Notion에 공고 저장"""
    url = "https://api.notion.com/v1/pages"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28"
    }
    
    # 매칭된 키워드들
    matched_keywords = job.get("matched_keywords", [])
    
    payload = {
        "parent": {"database_id": NOTION_DATABASE_ID},
        "properties": {
            "제목": {
                "title": [{"text": {"content": job["title"][:100]}}]
            },
            "회사": {
                "rich_text": [{"text": {"content": job["company"][:100]}}]
            },
            "링크": {
                "url": job["url"]
            },
            "플랫폼": {
                "select": {"name": job["platform"]}
            },
            "수집일": {
                "date": {"start": datetime.now(timezone.utc).isoformat()}
            },
            "키워드": {
                "multi_select": [{"name": kw[:100]} for kw in matched_keywords[:5]]
            },
            "JobID": {
                "rich_text": [{"text": {"content": job["id"]}}]
            }
        }
    }
    
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        print(f"✅ 저장: {job['company']} - {job['title']}")
        return True
    else:
        print(f"❌ 저장 실패: {response.text}")
        return False

# ============ 잡코리아 크롤링 ============
def search_jobkorea():
    """잡코리아 검색"""
    jobs = []
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    for query in SEARCH_QUERIES:
        try:
            # 잡코리아 검색 URL (신입 필터: careerType=1)
            url = f"https://www.jobkorea.co.kr/Search/?stext={query}&careerType=1"
            
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code != 200:
                print(f"잡코리아 검색 실패 ({query}): {response.status_code}")
                continue
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 채용공고 목록 찾기
            job_items = soup.select('.list-default .list-post')
            
            for item in job_items:
                try:
                    # 회사명
                    company_elem = item.select_one('.post-list-corp a.name')
                    company = company_elem.get_text(strip=True) if company_elem else ""
                    
                    # 포지션
                    title_elem = item.select_one('.post-list-info a.title')
                    title = title_elem.get_text(strip=True) if title_elem else ""
                    
                    # 링크
                    link = title_elem.get('href', '') if title_elem else ""
                    if link and not link.startswith('http'):
                        link = f"https://www.jobkorea.co.kr{link}"
                    
                    if not title or not company:
                        continue
                    
                    # 키워드 체크
                    matched = check_keywords(title, company)
                    
                    if matched is None:
                        continue
                    
                    if matched or is_target_company(company):
                        job_id = hashlib.md5(f"{company}_{title}".encode()).hexdigest()[:12]
                        
                        jobs.append({
                            "id": f"jobkorea_{job_id}",
                            "title": title,
                            "company": company,
                            "url": link,
                            "platform": "잡코리아",
                            "matched_keywords": matched if matched else ["관심기업"]
                        })
                        
                except Exception as e:
                    continue
                    
        except Exception as e:
            print(f"잡코리아 크롤링 에러 ({query}): {e}")
    
    return jobs

# ============ 인디스워크 크롤링 ============
def search_inthiswork():
    """인디스워크 크롤링 (IT/개발 카테고리)"""
    jobs = []
    
    # IT/개발, 데이터분석 페이지 크롤링
    urls = [
        "https://inthiswork.com/it",
        "https://inthiswork.com/data",
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    for page_url in urls:
        try:
            response = requests.get(page_url, headers=headers, timeout=10)
            if response.status_code != 200:
                print(f"인디스워크 접속 실패: {response.status_code}")
                continue
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 채용공고 링크 찾기
            for link in soup.find_all('a', href=True):
                href = link.get('href', '')
                text = link.get_text(strip=True)
                
                # 채용공고 링크 패턴 (보통 회사명|포지션 형태)
                if '｜' in text and ('채용' in text or any(kw.lower() in text.lower() for kw in INCLUDE_KEYWORDS)):
                    parts = text.split('｜')
                    if len(parts) >= 2:
                        company = parts[0].strip()
                        title = parts[1].strip()
                        
                        # 키워드 체크
                        matched = check_keywords(title, company)
                        
                        if matched is None:
                            continue
                        
                        if matched or is_target_company(company):
                            # URL 생성
                            if href.startswith('http'):
                                job_url = href
                            else:
                                job_url = f"https://inthiswork.com{href}"
                            
                            job_id = hashlib.md5(f"{company}_{title}".encode()).hexdigest()[:12]
                            
                            jobs.append({
                                "id": f"inthiswork_{job_id}",
                                "title": title,
                                "company": company,
                                "url": job_url,
                                "platform": "인디스워크",
                                "matched_keywords": matched if matched else ["관심기업"]
                            })
                            
        except Exception as e:
            print(f"인디스워크 크롤링 에러: {e}")
    
    return jobs

# ============ 원티드 크롤링 ============
def search_wanted(query):
    """원티드 검색 API"""
    jobs = []
    
    url = "https://www.wanted.co.kr/api/v4/jobs"
    params = {
        "country": "kr",
        "job_sort": "job.latest_order",
        "locations": "all",
        "years": YEARS_OF_EXPERIENCE,  # 신입 필터
        "query": query,
        "limit": 20,
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"원티드 검색 실패 ({query}): {response.status_code}")
            return jobs
            
        data = response.json()
        
        for item in data.get("data", []):
            job_id = str(item.get("id", ""))
            title = item.get("position", "")
            company = item.get("company", {}).get("name", "")
            
            # 키워드 매칭 체크
            matched = check_keywords(title, company)
            
            # matched가 None이면 제외 대상
            if matched is None:
                # 관심 기업이어도 제외 키워드 있으면 제외
                continue
            
            # 포함 키워드 매칭되었거나, 관심 기업이면 수집
            if matched or is_target_company(company):
                jobs.append({
                    "id": f"wanted_{job_id}",
                    "title": title,
                    "company": company,
                    "url": f"https://www.wanted.co.kr/wd/{job_id}",
                    "platform": "원티드",
                    "matched_keywords": matched if matched else ["관심기업"]
                })
                
    except Exception as e:
        print(f"원티드 크롤링 에러 ({query}): {e}")
    
    return jobs

def check_keywords(title, company):
    """제목에서 포함 키워드 체크 + 제외 키워드 필터링"""
    title_lower = title.lower()
    
    # 제외 키워드가 있으면 바로 제외
    for keyword in EXCLUDE_KEYWORDS:
        if keyword.lower() in title_lower:
            return None  # 제외 대상
    
    # 포함 키워드 매칭
    matched = []
    for keyword in INCLUDE_KEYWORDS:
        if keyword.lower() in title_lower:
            matched.append(keyword)
    
    return matched if matched else None

def is_target_company(company):
    """관심 기업인지 체크"""
    company_lower = company.lower()
    for target in TARGET_COMPANIES:
        if target.lower() in company_lower:
            return True
    return False

# ============ 메인 ============
def main():
    print("=" * 50)
    print(f"채용공고 크롤링 시작: {datetime.now()}")
    print("=" * 50)
    
    if not NOTION_TOKEN or not NOTION_DATABASE_ID:
        print("❌ NOTION_TOKEN 또는 NOTION_DATABASE_ID가 설정되지 않았습니다.")
        return
    
    # 기존 공고 ID 가져오기
    existing_ids = get_existing_job_ids()
    print(f"기존 저장된 공고 수: {len(existing_ids)}")
    
    # 원티드 크롤링
    all_jobs = []
    seen_ids = set()
    
    for query in SEARCH_QUERIES:
        print(f"\n🔍 원티드 검색: {query}")
        jobs = search_wanted(query)
        
        for job in jobs:
            if job["id"] not in seen_ids:
                seen_ids.add(job["id"])
                all_jobs.append(job)
    
    # 인디스워크 크롤링
    print(f"\n🔍 인디스워크 크롤링...")
    inthiswork_jobs = search_inthiswork()
    for job in inthiswork_jobs:
        if job["id"] not in seen_ids:
            seen_ids.add(job["id"])
            all_jobs.append(job)
    
    # 잡코리아 크롤링
    print(f"\n🔍 잡코리아 크롤링...")
    jobkorea_jobs = search_jobkorea()
    for job in jobkorea_jobs:
        if job["id"] not in seen_ids:
            seen_ids.add(job["id"])
            all_jobs.append(job)
    
    print(f"\n수집된 공고 수: {len(all_jobs)}")
    
    # 새 공고만 저장
    new_count = 0
    for job in all_jobs:
        if job["id"] not in existing_ids:
            if save_to_notion(job):
                new_count += 1
    
    print(f"\n✨ 새로 저장된 공고: {new_count}개")
    print("=" * 50)

if __name__ == "__main__":
    main()