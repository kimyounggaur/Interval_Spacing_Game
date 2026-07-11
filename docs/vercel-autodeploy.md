# Vercel 자동 배포

`.github/workflows/vercel-deploy.yml`은 다음 규칙으로 동작한다.

- `main`에 push: production 배포
- 다른 branch push 또는 Pull Request: preview 배포
- 모든 배포 전 `npm run test:quick` 실행
- Vercel 프로젝트 ID와 조직 ID는 workflow에 고정하고, 인증 토큰은 GitHub Secret만 사용

## 최초 1회 설정

GitHub 저장소 `kimyounggaur/Interval_Spacing_Game`의 Settings → Secrets and variables → Actions에 다음 Secret을 추가한다.

```text
VERCEL_TOKEN=<Vercel Personal Access Token>
```

토큰은 저장소 파일, 로그, 커밋 메시지에 기록하지 않는다. Secret이 추가되면 이후 `main` push는 `https://interval-spacing-game.vercel.app` production으로 자동 배포된다.
