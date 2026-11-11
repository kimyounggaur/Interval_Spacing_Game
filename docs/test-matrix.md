# DRIVE 요구사항–검사 매트릭스

기준일: **2026-11-11 (KST)**. 설계서 11장의 유지 5 + 신규 42 + 브라우저 15 = **62개 계약**을 추적한다. 실제 테스트 함수 수와 계약 수는 다르다.

현재 실행 증거: `npm run test:unit` **71/71 PASS**(10파일), `npm run test:property` **11/11 PASS**(2파일). 이 결과는 2026-11-11 실행본이다. 이후 결과는 `drive-gate-report.md`와 함께 갱신한다.

`PASS`는 해당 행의 자동 검사 실행만 뜻한다. 브라우저·실기기까지 통과했다는 뜻이 아니다. `PENDING`은 구현/검사 코드는 있으나 해당 실행 증거가 아직 없다. 로컬 Chromium은 소켓 권한 제한으로 `NOT_RUN`이며 브라우저 행은 CI 결과를 기다린다. 실기기 청취·운전·화면 읽기와 대표곡 강사 검수는 `NOT_RUN`이다.

| ID          | 계약                                     | 구현                   | 검사 파일                        | 실행 증거                        | 상태    |
| ----------- | ---------------------------------------- | ---------------------- | -------------------------------- | -------------------------------- | ------- |
| BASE-BOARD  | 25칸·중앙 C4 MIDI 60·흰 역 15개 유지     | src/game/track.ts      | tests/unit/domain.test.ts        | 2026-11-11 단위 검사             | PASS    |
| BASE-SEED   | 동일 시드 셔플 계약 유지                 | src/game/random.ts     | tests/unit/domain.test.ts        | 2026-11-11 단위 검사             | PASS    |
| BASE-SAVE-1 | 손상·미래 저장은 기본값                  | src/infra/storage.ts   | tests/unit/storage.test.ts       | 2026-11-11 단위 검사             | PASS    |
| BASE-SAVE-2 | v1→v2 이전 계약 유지                     | src/infra/storage.ts   | tests/unit/storage.test.ts       | 2026-11-11 단위 검사             | PASS    |
| BASE-SAVE-3 | 기본 저장은 빈 진행                      | src/infra/storage.ts   | tests/unit/storage.test.ts       | 2026-11-11 단위 검사             | PASS    |
| TH-01       | 장음계 누적합으로 음높이 생성            | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| TH-02       | MIDI·주파수 기준값                       | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| TH-03       | 흰 역 7×7 정답표                         | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| TH-04       | 철자별 음정 9건                          | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| TH-05       | 만들기 정답 17건                         | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| TH-06       | 단순 이름표×13종×양방향 왕복             | src/theory/index.ts    | tests/property/theory.test.ts    | 2026-11-11 속성 검사             | PASS    |
| TH-07       | 자리바꿈 도수 합 9·반음 합 12            | src/theory/index.ts    | tests/property/theory.test.ts    | 2026-11-11 속성 검사             | PASS    |
| TH-08       | 0~12반음의 흔한 이름                     | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| TH-09       | 검은건반의 두 단순 이름                  | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| TH-10       | 겹변화표·흰건반 이명동음 출제 제외       | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| TH-11       | 글자 기준 번호표 6건                     | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| TH-12       | Unicode 변화표·한국어 이름               | src/theory/index.ts    | tests/unit/theory.test.ts        | 2026-11-11 단위 검사             | PASS    |
| GN-01       | 모든 흰 역에 도수 후보                   | src/game/generator.ts  | tests/property/generator.test.ts | 2026-11-11 속성 검사             | PASS    |
| GN-02       | 모든 칸·단순 이름표에 만들기 후보        | src/game/generator.ts  | tests/property/generator.test.ts | 2026-11-11 속성 검사             | PASS    |
| GN-03       | 흰 역에서 12종 모두 가능                 | src/game/generator.ts  | tests/property/generator.test.ts | 2026-11-11 속성 검사             | PASS    |
| GN-04       | 최대 이동 12칸                           | src/game/generator.ts  | tests/property/generator.test.ts | 2026-11-11 속성 검사             | PASS    |
| GN-05       | 수준과 MIDI 48~72 범위 준수              | src/game/generator.ts  | tests/property/generator.test.ts | 2026-11-11 속성 검사             | PASS    |
| GN-06       | 가능하면 출발 철자 유지, 필요할 때 교체  | src/game/generator.ts  | tests/property/generator.test.ts | 2026-11-11 속성 검사             | PASS    |
| RN-01       | 노선별 고정 K장·통합 3+3+3               | src/game/planner.ts    | tests/unit/planner.test.ts       | 2026-11-11 단위 검사             | PASS    |
| RN-02       | 미숙련 2/3·가중 복습                     | src/game/planner.ts    | tests/unit/planner.test.ts       | 2026-11-11 단위 검사             | PASS    |
| RN-03       | 동일 시드 동일 운행                      | src/game/planner.ts    | tests/unit/planner.test.ts       | 2026-11-11 단위 검사             | PASS    |
| RN-04       | 숙련 상자 전이·스탬프 보존               | src/game/planner.ts    | tests/unit/planner.test.ts       | 2026-11-11 단위 검사             | PASS    |
| RN-05       | 이번 운행 별 기준                        | src/game/planner.ts    | tests/unit/planner.test.ts       | 2026-11-11 단위 검사             | PASS    |
| RN-06       | 같은 항목 연속 방지·장단 짝 인접         | src/game/planner.ts    | tests/unit/planner.test.ts       | 2026-11-11 단위 검사             | PASS    |
| ST-01       | 허용 전이와 잘못된 액션 거부             | src/game/reducer.ts    | tests/unit/reducer.test.ts       | 2026-11-11 단위 검사             | PASS    |
| ST-02       | reducer 순수성·불변 입력                 | src/game/reducer.ts    | tests/unit/reducer.test.ts       | 2026-11-11 단위 검사             | PASS    |
| ST-03       | 2차 오답 검산과 반쪽 스탬프              | src/game/reducer.ts    | tests/unit/reducer.test.ts       | 2026-11-11 단위 검사             | PASS    |
| ST-04       | 깃발 도착 뒤 읽기 보기                   | src/game/reducer.ts    | tests/unit/reducer.test.ts       | 2026-11-11 단위 검사             | PASS    |
| ST-05       | 운행 상태 전체 이어하기                  | src/game/reducer.ts    | tests/unit/reducer.test.ts       | 2026-11-11 단위 검사             | PASS    |
| SV-01       | v2 별·스탬프·통계 이전                   | src/infra/storage.ts   | tests/unit/storage-v3.test.ts    | 2026-11-11 단위 검사             | PASS    |
| SV-02       | v1→v2→v3 이전                            | src/infra/storage.ts   | tests/unit/storage-v3.test.ts    | 2026-11-11 단위 검사             | PASS    |
| SV-03       | 손상·미래 버전 원문 보존                 | src/infra/storage.ts   | tests/unit/storage-v3.test.ts    | 2026-11-11 단위 검사             | PASS    |
| SV-04       | v1·v2 키 보존                            | src/infra/storage.ts   | tests/unit/storage-v3.test.ts    | 2026-11-11 단위 검사             | PASS    |
| SV-05       | 숙련도·운행 저장 왕복                    | src/infra/storage.ts   | tests/unit/storage-v3.test.ts    | 2026-11-11 단위 검사             | PASS    |
| SV-06       | 인메모리 폴백과 쓰기 거부 감지           | src/infra/storage.ts   | tests/unit/storage-v3.test.ts    | 2026-11-11 단위 검사             | PASS    |
| AU-01       | 주파수와 배음                            | src/audio/engine.ts    | tests/unit/audio.test.ts         | 2026-11-11 단위 검사             | PASS    |
| AU-02       | 0·+0.62·+1.42초 즉시 예약                | src/audio/engine.ts    | tests/unit/audio.test.ts         | 2026-11-11 단위 검사             | PASS    |
| AU-03       | 낮은 음 보정                             | src/audio/engine.ts    | tests/unit/audio.test.ts         | 2026-11-11 단위 검사             | PASS    |
| AU-04       | 청음 두 음 범위                          | src/game/generator.ts  | tests/property/generator.test.ts | 2026-11-11 속성 검사             | PASS    |
| CT-01       | 대표 소리 음쌍의 반음 수                 | src/theory/examples.ts | tests/unit/content.test.ts       | 2026-11-11 단위 검사             | PASS    |
| CT-02       | 약속 문구와 실제 동작 일치               | src/view/app.ts        | scripts/drive-e2e.mjs            | 브라우저·화면 문구 감사 대기     | PENDING |
| CT-03       | 화면 이름이 이론 엔진 출력과 일치        | src/view/stage.ts      | scripts/drive-e2e.mjs            | 브라우저 이름표·유도식 감사 대기 | PENDING |
| E-01        | 시작 기차가 화면 안                      | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-02        | 무대·알림 노드 유지, 입력 후 스크롤 없음 | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-03        | 출발음→도착음→화음 예약                  | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-04        | 청음 추측 중 다시 듣기                   | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-05        | 12개 청음 보기 화면 안                   | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-06        | 수첩 경유 후 첫 문제 소리                | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-07        | 연타 시 이전 묶음 취소                   | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-08        | 단3도 도착 이름표 미♭                    | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-09        | 12px 이상 글자·48px 주요 단추            | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-10        | 320×568~430×932 운행 스크롤 0            | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-11        | 첫 방문 후 오프라인 재실행               | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-12        | 숙련도·오답·운행 복원                    | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-13        | 키보드로 입문 완주                       | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-14        | 동작 줄이기 전환 0                       | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |
| E-15        | 외부 요청 0건                            | src/main.ts            | scripts/drive-e2e.mjs            | 브라우저 실행 결과 대기          | PENDING |

브라우저 기본 뷰포트는 360×640, 390×664, 390×844(터치)이며 E-10은 320×568~~430×932를 추가 검사한다. `npm run test:e2e`는 E-01~~E-15 외에 기본·완주·청음·통합 완주, 반음 준비 운행, 7종 화면 캡처도 실행한다. 결과 파일은 `test-results/drive-e2e.json`이다.

기존 검사 8개 대체 대응표와 대표 소리 검수 범위는 `decision-log.md`를 참조한다. 단위 AU/E 검사와 브라우저 E 검사는 서로 다른 증거다. 대비 4.5:1, 130% 확대, 모든 입력 방식으로 다섯 노선 완주, 실제 PWA 설치와 보조공학 확인은 브라우저 기본 검사만으로 확정하지 않는다.
