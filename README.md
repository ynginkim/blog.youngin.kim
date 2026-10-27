# blog.youngin.kim

김영인의 블로그. 마크다운으로 글을 쓰면 `scripts/build.mjs`가 정적 HTML로 바꾸고, Cloudflare Workers(정적 자산)가 https://blog.youngin.kim 으로 내보낸다.

디자인은 artifact-report kit(`kit/`)의 본문 스타일에 D1 시안(타이포 머리 + 은은한 격자, 사이드바)을 얹은 것이다.

## 새 글 쓰기

1. `posts/`에 `영문-슬러그.md` 파일을 만든다. 파일 이름이 주소가 된다: `posts/my-post.md` → `/posts/my-post/`.
2. 맨 위에 frontmatter를 쓴다.

   ```markdown
   ---
   title: "글 제목"
   date: 2026-11-01          # YYYY-MM-DD
   category: essay           # essay(에세이) 또는 note(노트). site.config.mjs에서 바꿀 수 있다
   tags: [AI, PKM]
   summary: "한 줄 요약. 글 머리, 홈 카드, RSS에 쓰인다"
   draft: false              # true면 빌드·RSS·사이트맵에서 빠진다
   # 선택
   short: "사이드바에 보일 짧은 제목"
   featured: true            # 홈 '대표 글' 카드에 올린다
   order: 1                  # 같은 날짜 글의 순서(클수록 나중 글)
   slug: custom-slug         # 파일 이름 대신 쓸 주소
   ---

   본문은 일반 마크다운.
   ```

3. 본문에서 쓸 수 있는 것
   - `##`, `###` 제목은 오른쪽 목차에 자동으로 들어간다.
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
5. `git commit` 후 `git push`하면 자동으로 배포된다(아래).

홈의 글 목록, 대표 글, 사이드바의 분류(개수)·태그, 분류/태그 페이지, `rss.xml`, `sitemap.xml`은 모두 글에서 자동으로 만들어진다. 소개 페이지는 `pages/about.md`를 고치면 된다(`pages/` 안의 다른 `.md`도 `/<파일이름>/`로 나간다).

## 배포

- **자동 배포**: Cloudflare Workers Builds가 이 저장소에 연결되어 있다. `main`에 push하면 `npm run build` → `npx wrangler deploy`가 돌아 몇십 초 안에 반영된다. 진행 상황은 Cloudflare 대시보드 > Workers & Pages > `blog` > Deployments에서 본다.
- **손으로 배포**: `npx wrangler login` 후 `npm run deploy`.

## 구조

```
posts/              글(마크다운)
pages/              고정 페이지(about.md 등)
public/             그대로 복사되는 파일(favicon 등)
kit/                artifact-report kit(블록 함수, 머메이드 렌더러, 템플릿)
  template.html     HTML 껍데기 + CSS + JS (D1 디자인)
scripts/build.mjs   빌드: posts/pages → dist/
scripts/serve.mjs   로컬 미리보기 서버
site.config.mjs     제목, 주소, 분류, GitHub 링크
wrangler.jsonc      Cloudflare Worker 설정
```
