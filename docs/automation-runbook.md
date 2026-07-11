# 자동화 운영 런북

## 빠른 품질 게이트

`npm run test:quick`은 타입 검사, ESLint, 도메인/저장 단위 테스트, production build를 실행한다.

## traceability

`npm run test:traceability`는 필수 요구사항 ID가 test matrix에 존재하는지 확인한다. 상태를 PASS로 바꿀 때는 실제 실행 명령과 증거를 같이 기록한다.

## 정적 PWA 확인

`npm run build` 후 `npm run preview -- --host 127.0.0.1`로 열고 manifest, service worker, 오프라인 app shell을 확인한다. 테스트는 진행 중 운행을 강제 새로고침하지 않는지 함께 본다.

## 실패 원칙

테스트 삭제, skip, 임계값 하향, 정답 규칙 변경으로 실패를 숨기지 않는다. 실패 원인과 영향 범위를 decision log에 남기고, 실제 기기 전용 항목은 PARTIAL로 분리한다.
