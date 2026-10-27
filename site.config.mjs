// 블로그 전체 설정. 글은 posts/, 고정 페이지는 pages/ 에 둔다.
export default {
  title: '김영인의 블로그',
  author: '김영인',
  url: 'https://blog.youngin.kim', // 끝에 / 없이
  description: '배움과 지식, 그리고 그것을 돕는 도구에 대한 기록',
  lang: 'ko',
  github: 'https://github.com/ynginkim',
  // 분류: frontmatter의 category 값 → 화면 이름, 색(kit의 --cat-1..8 중 하나)
  categories: {
    essay: { name: '에세이', color: 1 },
    note: { name: '노트', color: 2 },
  },
  sidebarPostsPerCategory: 6,
};
