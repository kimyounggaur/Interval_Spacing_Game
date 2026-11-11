# DRIVE QA 증거

2026-11-11 (KST)의 최종 통합 코드 검사 기록은 `drive-gate-report.md`와 `test-matrix.md`를 정본으로 사용한다. 과거 v2 smoke 기록을 v3 운전형의 통과 증거로 재사용하지 않는다.

현재 확인된 증거:

- 원본 `d3518cc`: verify·단위 13/13·빌드 PASS (`drive-baseline.md`).
- DRIVE 통합본: 타입·lint·단위 71/71·속성 11/11·빌드·번들 예산 PASS.
- 번들: HTML 131,111바이트, gzip 63,704바이트. 외부 자산 참조 없는 단일 문서와 PWA 필수 파일 확인.
- 추적성: 유지 5·신규 42·브라우저 15의 62개 계약과 실제 파일 경로 확인.
- 데스크톱 브라우저 수동 관찰: 타이틀→노선→입문 운전→정답 도착·안내·스탬프(2026-11-11).
- 로컬 Chromium E2E: 소켓 권한 제한(`Operation not permitted`)으로 NOT_RUN. CI 실행 예정.

실제 iOS/Android 운전·청취·PWA 설치·앱 복귀·진동, VoiceOver/TalkBack, 글자 확대·대비·폰 성능과 대표곡 강사 검수는 NOT_RUN이다. 브라우저 자동화 결과는 실행 후 `test-results/drive-e2e.json`에 기록한다.
