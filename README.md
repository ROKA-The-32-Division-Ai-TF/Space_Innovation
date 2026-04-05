# 32사단 공간 배치 검토 도구

GitHub Pages에서 동작하는 2D 공간 배치 검토 웹앱입니다.  
사용자는 모바일이나 데스크톱 브라우저에서 공간을 그리고, 문·창문·가구를 배치한 뒤, Windows GUI 분석 서버에 현재 배치를 보내 검토 결과를 확인할 수 있습니다.

이 프로젝트의 핵심은 `정적 프론트엔드가 서비스 본체`이고, `Windows GUI 서버는 분석 엔진`이라는 점입니다.

## 현재 서비스 성격

- 2D 선형 도면 스타일의 공간 배치 편집기
- GitHub Pages에서 배포되는 정적 프론트엔드
- 모바일 우선 UI
- 분석은 별도 Windows GUI 서버가 담당
- 결과는 점수, 이슈, 제안, 요약으로 시각화
- PNG export 지원

이 서비스는 다음과 같은 앱이 아닙니다.

- 클라우드 SaaS 백엔드 중심 서비스
- 사진 기반 리모델링 앱
- 감성 인테리어 추천 앱
- 실사형 3D 인테리어 툴

## 운영 구조

```text
GitHub Pages Frontend
  - 공간 유형 선택
  - 방 외곽선 작성
  - 문/창문/가구 배치
  - 배치 JSON 생성
  - /health 확인
  - /analyze 호출
  - 결과 시각화
  - PNG export

Windows GUI Analysis Server
  - SpaceLayoutServerLauncher.exe
  - GET /health
  - POST /analyze
  - 점수 / 세부점수 / 이슈 / 제안 / 요약 반환
```

## 현재 사용자 흐름

1. 공간 유형 선택
2. 방 구조 생성
3. 문/창문 배치
4. 가구 배치
5. GUI 서버 연결 확인
6. 분석 실행
7. 결과 확인 및 PNG 저장

## Windows GUI 서버 연결

이 프론트는 항상 자체적으로 판단하지 않습니다.  
검토는 Windows GUI 서버가 수행하고, 프론트는 결과를 그대로 시각화합니다.

### 기본 연결 방식

Windows PC에서:

1. `SpaceLayoutServerLauncher.exe` 실행
2. `Host = 0.0.0.0`
3. `Port = 8000`
4. `서버 공유 시작` 클릭

GUI에는 보통 다음 주소가 표시됩니다.

- `Public`: 외부망/5G/GitHub Pages용 HTTPS 주소
- `LAN`: 같은 Wi-Fi 내부망용 주소
- `Local`: Windows 로컬 테스트용 주소

프론트에서는 기본적으로 `Public URL`을 API Base URL로 사용합니다.

예:

```text
https://join-matt-herald-slide.trycloudflare.com
```

프론트가 실제로 호출하는 엔드포인트:

- `GET {baseUrl}/health`
- `POST {baseUrl}/analyze`

### 중요한 점

- `trycloudflare` 퍼블릭 주소는 실행할 때마다 바뀔 수 있습니다.
- 하드코딩하면 안 됩니다.
- 프론트는 사용자가 입력한 마지막 주소를 `localStorage`에 저장합니다.
- 앱을 다시 열면 마지막 주소로 자동 재연결을 시도합니다.
- `?server=` 쿼리 파라미터로도 바로 연결할 수 있습니다.

예:

```text
https://roka-the-32-division-ai-tf.github.io/Space_Innovation/?server=https%3A%2F%2Fjoin-matt-herald-slide.trycloudflare.com
```

## 기능 요약

- 공간 유형 선택: 생활관, 지휘통제실, 간부휴게실, 창고, 사용자 정의
- 기본 도형: 사각형, L자, U자
- 고급 도면 수정: 직선 벽, 곡선 벽
- 객체 배치: 문, 창문, 기둥, 침상, 관물대, 책상, 의자, 보관함, 장비함, 상황판
- 모바일 확대/이동: 확대 후 빈 공간 드래그로 pan
- 검토 시각화:
  - 검토 점수
  - 세부 점수
  - 이슈 목록
  - 제안 목록
  - `issues[].region` 오버레이
- PNG export

## 분석 계약

프론트는 현재 배치를 서버 계약에 맞게 변환해 전송합니다.

요청 핵심 필드:

- `space_type`
- `layout_id`
- `unit`
- `room`
  - `width`
  - `height`
  - `outline`
  - `boundary_segments`
- `objects`
  - `id`
  - `name`
  - `type`
  - `category`
  - `x`
  - `y`
  - `w`
  - `h`
  - `rotation`
  - `metadata`

응답 핵심 필드:

- `score`
- `subscores`
- `issues`
- `suggestions`
- `summary`

프론트는 응답을 해석해서 재판정하지 않고, 그대로 보여줍니다.

## 기술 스택

- Frontend: React 18 + TypeScript + Vite
- Deployment: GitHub Pages
- External analysis engine: Windows GUI server

## 로컬 개발

```bash
npm install
npm run dev
```

기본 개발 서버:

```text
http://127.0.0.1:5173
```

포트가 사용 중이면 다른 포트로 자동 변경됩니다.

## 빌드

```bash
npm run build
```

## 배포

이 저장소는 GitHub Pages용 워크플로를 포함합니다.

- Workflow: [`deploy-pages.yml`](/Users/jeongdongho/Desktop/space%20inovaition/.github/workflows/deploy-pages.yml)
- Base path: `/Space_Innovation/`
- Production URL:
  [https://roka-the-32-division-ai-tf.github.io/Space_Innovation/](https://roka-the-32-division-ai-tf.github.io/Space_Innovation/)

## 현재 구현 메모

- 헤더의 부대 마크 아래에서 서버 연결 상태를 바로 확인할 수 있습니다.
- GUI 서버 연결 상태는 `연결 안 됨 / 확인 중 / 연결됨 / 오류`로 표시됩니다.
- 검토 단계에서는 서버 결과가 최신이 아닐 경우 다시 분석을 유도합니다.
- PNG는 현재 캔버스와 검토 오버레이 기준으로 생성됩니다.

## 참고

- 이 프로젝트의 본체는 프론트엔드입니다.
- Windows GUI 서버는 분석 기능만 제공하는 외부 계산 엔진입니다.
- 아키텍처를 서버 중심 SaaS로 바꾸는 방향은 현재 범위가 아닙니다.
