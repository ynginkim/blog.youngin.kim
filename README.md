# blog.youngin.kim

김영인의 블로그. 마크다운으로 글을 쓰면 `scripts/build.mjs`가 정적 HTML로 바꾸고, Cloudflare Workers(정적 자산)가 https://blog.youngin.kim 으로 내보낸다.

디자인은 `theme/`에 있다. 읽기를 우선한 한 단 구성(Pretendard 17px, 줄 간격 1.75, 본문 폭 640px)이고, 라이트/다크 토글(기본 라이트)과 오른쪽 호버 목차가 있다. 화면 틀은 `site.config.mjs`의 `layout`으로 고른다: `sidebar`(왼쪽 사이드바) · `topnav`(상단 메뉴) · `hybrid`(상단 메뉴 + 넓은 화면에서만 사이드바).

## 새 글 쓰기

1. `posts/`에 `영문-슬러그.md` 파일을 만든다. 파일 이름이 주소가 된다: `posts/my-post.md` → `/posts/my-post/`.
2. 맨 위에 frontmatter를 쓴다.

   ```markdown
   ---
   title: "글 제목"
   date: 2026-11-01          # YYYY-MM-DD
   category: essay           # essay(에세이) 또는 note(노트). site.config.mjs에서 바꿀 수 있다
   tags: [AI, PKM]
   summary: "한 줄 요약. 글 목록과 RSS에 쓰인다"
   draft: false              # true면 빌드·RSS·사이트맵에서 빠진다
   # 선택
   short: "사이드바에 보일 짧은 제목"
   series: ai-native-note    # 연재에 넣을 때: site.config.mjs의 series 아이디
   part: 1                   # 연재 안의 순서
   order: 1                  # 같은 날짜 글의 순서(클수록 나중 글)
   slug: custom-slug         # 파일 이름 대신 쓸 주소
   ---

   본문은 일반 마크다운.
   ```

3. 본문에서 쓸 수 있는 것
   - `##`, `###` 제목은 오른쪽 목차에 자동으로 들어간다(접는 블록은 한 항목으로).
   - 머메이드 도식: 코드 펜스 언어를 `mermaid`로 쓰고, 그 뒤에 캡션을 적는다. 빌드 때 SVG로 바뀐다.

     ````markdown
     ```mermaid 캡션 문장
     flowchart TD
     A[탐색] --> B[수집] --> C[구조화]
     ```
     ````
   - 접히는 블록: `<!-- toggle: 제목 -->` … `<!-- /toggle -->`
   - 표, 인용, 목록, 코드 블록은 GFM 그대로.
4. 미리 보기: `npm install` 후 `npm run dev` → http://localhost:4321 (초안도 함께 보인다).
   세 가지 화면 틀을 한꺼번에 보려면 `npm run build:variants` → `preview/v1`(sidebar) · `v2`(topnav) · `v3`(hybrid), 각각 `node scripts/serve.mjs 4401 preview/v1`처럼 띄운다.
5. `git commit` 후 `git push`하면 자동으로 배포된다(아래).

홈의 연재·글 목록, `/posts/`(연도별 글), `/series/`(연재), 사이드바, 분류/태그 페이지, `rss.xml`, `sitemap.xml`은 모두 글에서 자동으로 만들어진다. 소개 페이지는 `pages/about.md`를 고치면 된다(`pages/` 안의 다른 `.md`도 `/<파일이름>/`로 나간다).

## 배포

- **자동 배포 (Cloudflare Workers Builds)**: Worker `blog`에 이 저장소의 `main` 브랜치가 연결되어 있다. `main`에 push하면 `npm run build` → `npx wrangler deploy`가 자동으로 돌아 2~3분 안에 https://blog.youngin.kim 에 반영된다(2026-10-27 push 빌드로 확인). 다른 브랜치는 배포되지 않는다.
  - 빌드 상태와 로그: Cloudflare 대시보드 > Workers & Pages > `blog` > Deployments. 빌드를 직접 다시 돌릴 수도 있다.
  - push해도 빌드가 시작되지 않으면 GitHub Settings > Applications > Cloudflare Workers and Pages > Configure에서 이 저장소가 접근 목록에 있는지 확인한다.
- **손으로 배포**: `npx wrangler login` 후 `npm run deploy`.

## 구조

```
posts/              글(마크다운)
pages/              고정 페이지(about.md 등)
public/             그대로 복사되는 파일(favicon 등)
theme/              디자인
  layout.mjs        HTML 껍데기(sidebar · topnav · hybrid)
  style.css         타이포그래피·색(라이트/다크)·목차
  site.js           테마 토글, 사이드바 접기, 목차
kit/                머메이드 → SVG 렌더러(kit.mjs, vendor/pele.mjs)
scripts/build.mjs   빌드: posts/pages → dist/
scripts/serve.mjs   로컬 미리보기 서버
site.config.mjs     제목, 주소, 분류, 연재, 화면 틀(layout), GitHub 링크
wrangler.jsonc      Cloudflare Worker 설정
```
