// 블로그 전체 설정. 글은 posts/, 고정 페이지는 pages/ 에 둔다.
export default {
  title: '김영인의 블로그',
  author: '김영인',
  url: 'https://blog.youngin.kim', // 끝에 / 없이
  description: '배움과 지식, 그리고 그것을 돕는 도구에 대한 기록',
  lang: 'ko',
  github: 'https://github.com/ynginkim',
  // 상단 워드마크: Dancing Script 부분 글꼴(theme/fonts/, OFL)
  wordmark: { text: 'blog.youngin.kim', font: 'dancing' },
  // 분류: frontmatter의 category 값 → 화면 이름, 색(kit의 --cat-1..8 중 하나)
  categories: {
    essay: { name: '에세이', color: 1 },
    note: { name: '노트', color: 2 },
  },
  // 홈은 세 꼭지 링크(homeLinks: 글 탭의 태그 목록으로 감)와 '최근 글'(월간 회고 제외)만 보여 준다.
  homeLinks: [['AI와 일하는 사람', 'AI와 일하기'], ['배우는 사람', '배움'], ['기록하는 사람', '기록']],
  // '글' 탭은 모든 글을 시간순으로 보여 주고, 태그(frontmatter tags)로 거른다.
  // 예전 태그 → 지금 태그(null이면 글 탭 전체). /tags/<옛 태그>/, /posts/tags/<옛 태그>/ 주소를 넘겨 준다.
  tagRedirects: {
    'AI': 'AI와 일하기',
    'AI슬롭': 'AI와 일하기',
    '의도공학': 'AI와 일하기',
    'AI시대': 'AI와 일하기',
    '창작': '커리어',
    '자아': '커리어',
    '바이브코딩': '커리어',
    '질문': null,
    'learning': '배움과 지식',
    'PKM': '배움과 지식',
    '학습': '배움과 지식',
    'ai-native-note': '배움과 지식',
    '멘탈 모델': '배움과 지식',
    '클로드코드': 'AI와 일하기',
    '클로드 코드': 'AI와 일하기',
    '개발': 'AI와 일하기',
    '컴퓨팅사고': '교육',
    '컴퓨팅 사고': '교육',
    '강의': '교육',
    'AI에이전트': '에이전트',
    '컨텍스트': '에이전트',
    '오케스트레이션': '에이전트',
    '에이전트 팀': '에이전트',
    '회고': '일상',
    'GitHub': '일상',
    '발표': '글과 말',
    '스토리텔링': '글과 말',
    '글쓰기': '글과 말',
    '로컬리티': '월간 회고',
    'AX': '월간 회고',
    '보험': '월간 회고',
    '현장': '월간 회고',
    '책임': '월간 회고',
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
