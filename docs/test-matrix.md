# 요구사항–테스트 추적성 매트릭스

| 요구사항 ID     | 명세                                       | 구현 파일                         | 단위/속성 테스트           | E2E  | 접근성/시각       | 수동             | 상태    |
| --------------- | ------------------------------------------ | --------------------------------- | -------------------------- | ---- | ----------------- | ---------------- | ------- |
| DAT-BOARD-001   | 25칸, 중앙 C4 MIDI 60, 흰칸 15             | src/domain/data.ts                | tests/unit/domain.test.ts  | 예정 | board DOM         | 실제 기기        | PASS    |
| DAT-DECK-001    | 48장·12/24/12 분포와 연속 ID               | src/domain/data.ts                | tests/unit/domain.test.ts  | 예정 | card visual       | -                | PASS    |
| ENG-GREEN-001   | 출발음을 1로 세는 흰칸 도수                | src/domain/engine.ts              | tests/unit/domain.test.ts  | 예정 | board a11y        | -                | PASS    |
| ENG-YEL-001     | 옥타브 환승 후 전체 반음 재계산            | src/domain/engine.ts              | tests/unit/domain.test.ts  | 예정 | transfer feedback | -                | PASS    |
| ENG-RED-001     | redMoveTarget 상행 우선, 끝에서는 하행     | src/domain/engine.ts              | tests/unit/domain.test.ts  | 예정 | -                 | -                | PASS    |
| MOD-ROUTES-001  | 다섯 노선·잠금·승리 조건                   | src/main.ts, src/domain/engine.ts | tests/unit/domain.test.ts  | 예정 | route cards       | -                | PASS    |
| UI-SCREENS-001  | title/routes/game/notebook/result/settings | src/main.ts                       | -                          | 예정 | keyboard smoke    | -                | PASS    |
| RED-LEAK-001    | 청음 진행 중 정답 필드 공개 금지           | src/main.ts                       | public red render contract | 예정 | aria audit        | -                | PASS    |
| RED-LOCK-001    | basic 클리어 전 청음 노선 잠금             | src/main.ts                       | -                          | 예정 | route a11y        | -                | PASS    |
| COR-RETRY-001   | 첫 오답 교정·재도전 흐름                   | src/main.ts                       | -                          | 예정 | live status       | -                | PASS    |
| NBK-MERGE-001   | full 우선 redAux 정규화, merge 멱등        | src/domain/engine.ts              | tests/unit/domain.test.ts  | 예정 | notebook          | -                | PASS    |
| SAV-V2-001      | 손상·미래 버전 sanitize                    | src/infra/storage.ts              | tests/unit/storage.test.ts | 예정 | -                 | -                | PASS    |
| SAV-MIG-001     | v1→v2 migration                            | src/infra/storage.ts              | tests/unit/storage.test.ts | 예정 | -                 | -                | PASS    |
| A11Y-TARGET-001 | 주요 터치 target 44px 이상                 | src/styles.css                    | -                          | 예정 | geometry review   | 모바일 수동      | PASS    |
| A11Y-MOTION-001 | reduced motion 존중                        | src/styles.css                    | -                          | 예정 | visual            | 모바일 수동      | PASS    |
| PWA-MAN-001     | manifest·icon 제공                         | public/manifest.webmanifest       | -                          | 예정 | install UI        | Android 수동     | PASS    |
| PWA-OFF-001     | service worker app shell cache             | public/sw.js                      | -                          | 예정 | offline reload    | Android/iOS 수동 | PASS    |
| AUD-UNLOCK-001  | 사용자 액션에서 audio unlock               | src/infra/audio.ts                | -                          | 예정 | -                 | iOS 수동         | PARTIAL |
| AUD-PITCH-001   | MIDI→Hz 수학 계약                          | src/domain/engine.ts              | tests/unit/domain.test.ts  | 예정 | -                 | 실제 청취        | PASS    |
| OPS-TRACE-001   | 추적성 행 검사                             | scripts/verify-traceability.mjs   | npm run test:traceability  | -    | -                 | -                | PASS    |

`예정`은 현재 구현에 포함된 브라우저 자동화가 아직 이 저장소에 추가되지 않았다는 뜻이다. 자동화되지 않은 항목을 통과로 가장하지 않는다.
