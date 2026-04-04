# 32사단 공간력 혁신 AI 인테리어

군 생활관, 사무실, 창고, 대기실 등의 실내 공간을 대상으로  
`규정 준수 + 동선 효율 + 공간 활용`을 함께 검토하는 웹 기반 공간배치 서비스입니다.

## 주요 기능

- 2D 평면도 기반 방 생성 및 가구 배치
- 직선 벽, 곡선 벽 기반 도면 작성
- 문, 창문, 기둥, 침상, 관물대, 책상, 의자, 장비함 배치
- 군 규정 JSON 기반 자동 검토
- 위반 항목, 개선 권고, 자동 배치안 비교
- 3D 배치 미리보기

## 기술 스택

- Frontend: React + TypeScript + Vite
- Rule Engine: TypeScript 모듈
- Deployment: GitHub Pages

## 로컬 실행

```bash
npm install
npm run dev
```

## 프로덕션 빌드

```bash
npm run build
```

## 배포

이 저장소는 GitHub Pages용 워크플로를 포함합니다.

- Workflow: `.github/workflows/deploy-pages.yml`
- Production base path: `/Space_Innovation/`

배포 주소 예상값:

`https://roka-the-32-division-ai-tf.github.io/Space_Innovation/`

## 참고

실제 규정 판정은 LLM이 아니라 룰 엔진이 담당하고,  
AI는 설명, 요약, 배치 제안 역할만 수행하도록 분리 설계되어 있습니다.
