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
  // 홈 묶음: 글 frontmatter의 group 값 → 홈에서 보이는 묶음 이름. 적힌 순서대로 홈에 나온다.
  // '글' 탭(/posts/)은 이 묶음 순서대로 접히는 목록을 만든다. group이 없거나 여기에 없는 글은 맨 아래 '그 밖의 글'로 모인다.
  // 홈은 '중요한 글'(frontmatter featured: true)과 '최근 글'만 보여 주고, 월간 회고(monthly)는 홈 목록에서 뺀다.
  groups: {
    ai: { name: 'AI와 일하기' },
    learning: { name: '배움과 지식' },
    retro: { name: '회고' },
    monthly: { name: '월간 회고' },
  },
  // 화면 틀: 'sidebar'(왼쪽 사이드바) · 'topnav'(상단 메뉴) · 'hybrid'(상단 메뉴 + 넓은 화면에서만 사이드바)
  layout: 'topnav',
  // 연재: 글 frontmatter에 series: <아이디>, part: <번호>를 적는다.
  series: {
    'ai-native-note': {
      title: 'AI-native note',
      description: 'AI 시대에 지식 습득의 병목이 어디로 옮겨 갔는지 살피고, 그 병목을 다루는 노트가 어떤 모습이어야 하는지 묻는 연재.',
    },
    'monthly-retro': {
      title: '월간 회고',
      description: '매달 남긴 메모를 한두 줄씩 돌아보는 회고.',
    },
  },
};
