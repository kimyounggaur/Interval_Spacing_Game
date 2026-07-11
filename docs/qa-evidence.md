# QA 증거

## 로컬 자동 검사

실행 명령과 결과는 다음과 같다.

```text
npm run format:check       PASS
npm run test:quick         PASS (typecheck, lint, 13 unit tests, build)
npm run test:traceability  PASS (9 required contracts)
production preview PWA    PASS (manifest 200, service worker registered)
```

## 브라우저 수동 확인 항목

- title에서 출발하기를 누르면 routes로 이동
- 입문 노선에서 초록 카드·흰칸 선택·정답/오답 교정·다음 카드가 동작
- 기본/완주/청음/통합 노선 카드가 잠금 조건에 따라 바뀜
- 청음 진행 중에는 카드 번호·음정명·곡명이 보이지 않음
- 수첩과 설정은 게임 중에도 열리고 되돌아옴
- 360px 폭에서 가로 페이지 overflow가 생기지 않음
- service worker는 production preview에서만 확인

브라우저 smoke 결과: title→route-map→intro game, green wrong/correction/retry, red ear public view, 360/390/430 layout, console/page error 0.

## 수동 게이트

현재 실행하지 않은 항목: 실제 iPhone Safari 오디오 정책, Android TalkBack, VoiceOver, 물리 진동, 설치 후 update defer.
