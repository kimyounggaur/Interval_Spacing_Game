# DRIVE 자동 검사 운영

Node.js 22~24에서 `npm ci` 후 실행한다.

- `npm run test:quick`: strict TypeScript, ESLint, 단위·속성 검사, 프로덕션 빌드, 단일 파일·외부 자원·용량 검사.
- `npm run format:check`: 소스·검사·문서 서식 검사.
- `npm run test:traceability`: 62개 요구사항 ID, 실제 구현·검사 파일, PASS의 날짜 증거 확인.
- `npm run test:e2e`: Chromium 모바일 3종의 66개 시나리오. 일반 환경에서는 프로덕션 미리보기를 시작하며, 관리형 환경에서는 준비된 `E2E_BASE_URL`을 받는다.
- `npm run verify`: 빠른 검사 + 추적성 + E2E.

GitHub Actions는 브라우저 설치 후 위 게이트를 실행한다. `test-results/drive-e2e.json`, 실패 캡처, 8개 화면 × 3종 캡처를 항상 아티팩트로 보관한다. 모든 게이트가 성공한 뒤 기존 Vercel 배포를 실행한다.

서비스 워커 캐시 이름은 빌드 문서 해시를 포함한다. 첫 방문 뒤 전체 문서 캐시와 오프라인 재실행을 검사하고 운행 중 강제 새로고침하지 않는다. 기다리는 업데이트는 다음 실행 때 적용한다.

검사 삭제·skip·임계값 하향으로 실패를 숨기지 않는다. 제품의 원인을 수정하고 다시 실행한다. 실제 기기 전용 항목은 자동 브라우저 결과와 분리해 `manual-device-checklist.md` 및 `drive-gate-report.md`에 기록한다.
