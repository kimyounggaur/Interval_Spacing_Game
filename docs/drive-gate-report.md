# DRIVE 게이트 보고서

검사일: **2026-11-11 (KST)**. 상태는 구현 완료와 게이트 통과를 구분한다. 최종 브라우저 결과 반영 전의 기록이며 미실행 항목을 PASS로 쓰지 않는다.

현재 자동 실행: `npm run test:quick` 타입·lint·빌드·산출물 검사 PASS. `index.html` **131,111바이트**, gzip **63,704바이트**(최종 빌드가 바뀌면 갱신).

현재 테스트 실행: `npm run test:unit` **71/71 PASS**(10파일), `npm run test:property` **11/11 PASS**(2파일). 단계별 과거 버전을 각각 재실행한 값이 아니라 최종 통합 코드의 실행 결과다. GDR0의 원본 기준선만 별도로 실행했다.

| 게이트 | 상태    | 실행 증거와 범위                                                   | 남은 확인                                            |
| ------ | ------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| GDR0   | PARTIAL | 원본 `d3518cc`의 verify·단위 13/13·빌드 PASS (`drive-baseline.md`) | 구 화면 E-03·04·06 NOT_RUN                           |
| GDR1   | PASS    | TH-01~12 단위·속성 PASS, 잠금 정답표·철자·왕복·번호표              | 브라우저 통합은 아래 게이트                          |
| GDR2   | PARTIAL | AU-01~03 및 예약·취소·6종 언락 단위 PASS                           | 실제 폰 2대 청취 NOT_RUN; 브라우저 소리 PENDING      |
| GDR3   | PARTIAL | reducer 순수성·전이 단위 PASS, 단일 파일/PWA 구현                  | E-11·15 브라우저 PENDING                             |
| GDR4   | PARTIAL | GN-01~06·ST-03/04·TH-11 PASS                                       | 모바일 입력·화면 E2E PENDING; 실제 10장 운전 NOT_RUN |
| GDR5   | PARTIAL | RN-01~~06·SV-01~~06·ST-05 PASS, 다섯 노선 시드 완주 자동 검사 PASS | E-12 브라우저 PENDING                                |
| GDR6   | PARTIAL | AU-04·청음 단계 잠금·귀로 찾기 상태 전이 PASS                      | E-04·05 청음 보기/재생 브라우저 PENDING              |
| GDR7   | PARTIAL | CT-01 음쌍 계산 PASS, SVG 배경·기차·포포·튜토리얼 구현             | CT-02/03·7종 화면 캡처 PENDING; 강사 검수 NOT_RUN    |
| GDR8   | PARTIAL | 자동 검사·추적성 기록 정리                                         | iOS/Android·화면 읽기·130% 확대·폰 성능·대비 NOT_RUN |

## 브라우저 기록 — PENDING

로컬 Chromium 실행은 `Operation not permitted` 소켓 제한으로 **NOT_RUN**이다. CI에서 브라우저 검사를 실행할 예정이다. 데스크톱 브라우저 수동 확인은 타이틀→노선→입문 운전→정답 도착·안내·스탬프까지 관찰했다(2026-11-11). 이 관찰은 15개 E2E 또는 실제 폰 검증을 대신하지 않는다.

실행기: `scripts/drive-e2e.mjs` (`npm run test:e2e`). 기본 360×640, 390×664, 390×844와 터치 환경을 사용한다. 15개 핵심 시나리오×3=45건, 추가 노선 완주 12건, 준비 운행 3건, 화면 캡처 감사 3건이 등록되어 있다. 실제 결과 파일은 `test-results/drive-e2e.json`이다. 이 표의 PENDING은 실행 결과가 도착한 뒤 갱신한다.

- E-10은 320×568, 360×600, 360×640, 390×664, 390×844, 430×932를 추가 순회한다.
- 번들 검사는 외부 자산 참조 0·단일 HTML·PWA 필수 파일·크기 예산 PASS다. 실제 네트워크 외부 요청 수는 E-15 실행 전이므로 **PENDING**.
- 배포 성공과 수동 기기 게이트 통과는 별도 증거이며, 소스 코드만으로 완료를 선언하지 않는다.

## 실기기·강사 기록 — NOT_RUN

실제 iPhone Safari·Android Chrome은 제공되지 않았다. 무음 스위치·앱 복귀·손가락 밀기·진동·홈 화면 설치·VoiceOver/TalkBack·중급 폰 60fps를 직접 확인하지 못했다. 대표곡의 악보 위치와 수업 적합성에 대한 강사 검수도 실행하지 않았다. 체크리스트는 `manual-device-checklist.md`를 따른다.
