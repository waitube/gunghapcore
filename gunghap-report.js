/* ============================================================
   gunghap-report.js — 무료 결과 / 상세 리포트 / 신청 코드 로직
   로드 순서: config.js → saju-core.js → gunghap-core.js → (이 파일)
   ============================================================ */
(function (root) {
  const SC = root.SajuCore, GC = root.GunghapCore;
  const { STEMS, BRANCHES, STEMS_HAN, BRANCHES_HAN, STEM_ELEM, BRANCH_ELEM } = SC;
  const JASI_MODE = 'unified';

  /* ---------- 신청 코드: 두 사람 입력값을 짧은 문자열로 ---------- */
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  // 사람 입력: { name, date:'YYYY-MM-DD', time:'HH:MM' | '' }
  function encodeOrder(A, B, rel) {
    const pack = p => [p.name, p.date.replace(/-/g, ''), (p.time || '').replace(':', '')];
    const o = { v: 1, a: pack(A), b: pack(B) };
    if (rel && rel !== 'love') o.r = rel;
    return b64urlEncode(JSON.stringify(o));
  }
  function decodeOrder(code) {
    try {
      const o = JSON.parse(b64urlDecode(code));
      const unpack = x => ({
        name: x[0],
        date: `${x[1].slice(0, 4)}-${x[1].slice(4, 6)}-${x[1].slice(6, 8)}`,
        time: x[2] ? `${x[2].slice(0, 2)}:${x[2].slice(2, 4)}` : '',
      });
      if (!o || o.v !== 1) return null;
      return { A: unpack(o.a), B: unpack(o.b), rel: RELATIONS[o.r] ? o.r : 'love' };
    } catch (e) { return null; }
  }
  async function unlockKey(code) {
    const salt = (root.GUNGHAP_CONFIG && root.GUNGHAP_CONFIG.unlockSalt) || '';
    const data = new TextEncoder().encode(code + '|' + salt);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).slice(0, 5).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- 서머타임·옛 표준시 자동 보정 ----------
     출처: IANA tz 데이터베이스 Asia/Seoul (Rule ROK, Zone Asia/Seoul)
     · 1908.4.1~1911.12.31, 1954.3.21~1961.8.9: 표준시가 UTC+8:30 (지금보다 30분 늦음)
     · 아래 기간: 서머타임(+1시간). 시계 기준 시작 시각 ~ 끝 시각
     출생 기록 시각을 지금의 한국 표준시(UTC+9) 기준으로 바꾼 뒤 사주를 계산합니다. */
  const KR_DST = [
    ['1948-06-01T00:00', '1948-09-13T00:00'], ['1949-04-03T00:00', '1949-09-11T00:00'],
    ['1950-04-01T00:00', '1950-09-10T00:00'], ['1951-05-06T00:00', '1951-09-09T00:00'],
    ['1955-05-05T00:00', '1955-09-09T00:00'], ['1956-05-20T00:00', '1956-09-30T00:00'],
    ['1957-05-05T00:00', '1957-09-22T00:00'], ['1958-05-04T00:00', '1958-09-21T00:00'],
    ['1959-05-03T00:00', '1959-09-20T00:00'], ['1960-05-01T00:00', '1960-09-18T00:00'],
    ['1987-05-10T02:00', '1987-10-11T03:00'], ['1988-05-08T02:00', '1988-10-09T03:00'],
  ];
  const p2 = n => String(n).padStart(2, '0');
  // date 'YYYY-MM-DD', time 'HH:MM' (기록된 시계 시각) → 한국 표준시(UTC+9) 기준 날짜·시각과 보정 설명
  function toKST(date, time) {
    if (!date || !time) return { date, time, shift: 0, reasons: [] };
    const key = `${date}T${time}`;
    const reasons = [];
    let shift = 0; // 더할 분
    if ((key >= '1908-04-01T00:00' && key < '1912-01-01T00:00') || (key >= '1954-03-21T00:00' && key < '1961-08-10T00:00')) {
      shift += 30; reasons.push('당시 표준시(UTC+8:30) 30분 보정');
    }
    if (KR_DST.some(([a, b]) => key >= a && key < b)) { shift -= 60; reasons.push('서머타임 1시간 보정'); }
    if (!shift) return { date, time, shift: 0, reasons };
    const [y, m, d] = date.split('-').map(Number), [h, mi] = time.split(':').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d, h, mi) + shift * 60000);
    return {
      date: `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`,
      time: `${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())}`, shift, reasons,
    };
  }

  /* ---------- 관계 종류 ----------
     ctx: love(연인) · work(일) · family(가족) · friend(친구)
     a/b: 입력칸 이름표, 이름을 비워 두면 그대로 이름으로 씀 */
  const RELATIONS = {
    love:    { label: '연인·부부',        ctx: 'love',   a: '나', b: '상대' },
    some:    { label: '썸·소개팅',        ctx: 'love',   a: '나', b: '그 사람' },
    boss:    { label: '상사와 나',        ctx: 'work',   a: '나', b: '상사' },
    junior:  { label: '부하직원과 나',    ctx: 'work',   a: '나', b: '부하직원' },
    ceo:     { label: '대표와 직원',      ctx: 'work',   a: '대표', b: '직원' },
    peer:    { label: '함께 일하는 동료', ctx: 'work',   a: '나', b: '동료' },
    partner: { label: '동업·함께 일할 사람', ctx: 'work', a: '나', b: '파트너' },
    parent:  { label: '부모와 자녀',      ctx: 'family', a: '부모', b: '자녀' },
    friend:  { label: '친구',             ctx: 'friend', a: '나', b: '친구' },
  };

  /* ---------- 계산 ---------- */
  function personSaju(p) {
    const hasTime = !!p.time;
    const k = toKST(p.date, p.time);
    const [y, m, d] = k.date.split('-').map(Number);
    let hour = 12, minute = 0;
    if (hasTime) { [hour, minute] = k.time.split(':').map(Number); }
    const saju = SC.computeSaju(y, m, d, hour, minute, hasTime, 'M', JASI_MODE);
    const ys = SC.computeYongsin(saju, hasTime);
    return { ...p, saju, ys, hasTime, kst: k };
  }
  function analyze(Ain, Bin, relKey) {
    const rel = RELATIONS[relKey] ? relKey : 'love';
    const ctx = RELATIONS[rel].ctx;
    const A = personSaju(Ain), B = personSaju(Bin);
    const result = GC.analyzeGunghap(A.saju, B.saju, {
      nameA: A.name, nameB: B.name, hasTimeA: A.hasTime, hasTimeB: B.hasTime,
    });
    if (ctx !== 'love') {
      result.axes.forEach(ax => {
        if (ax.key === 'sibsinIlgan') ax.title = '② 십신궁합 (일간 기준 — 나에게 상대는 어떤 사람인가)';
        if (ax.key === 'sibsinYeongan') ax.note = '일간 기준(②)이 두 사람이 직접 마주할 때의 관계라면, 연간 기준은 주변 사람들 눈에 비치는 두 사람의 관계를 보는 보조 지표입니다.';
      });
    }
    return { A, B, result, rel, ctx, years: yearFlow(A, B, ctx) };
  }

  /* ---------- 관계별 읽는 법 ---------- */
  // 십신: 상대가 나에게 어떤 사람으로 다가오는가 [이름표, 설명]
  const GOD_WORK = {
    '비견': ['대등한 동료형', '눈높이가 같아 손발이 잘 맞습니다. 역할이 겹치면 서로 양보하지 않으니 담당 범위를 처음부터 나눠 두세요.'],
    '겁재': ['자극을 주는 라이벌형', '함께하면 속도가 붙지만 성과와 자원을 두고 신경전이 생기기 쉽습니다. 공과를 나누는 기준을 미리 정해 두세요.'],
    '식신': ['실력을 편하게 꺼내 주는 사람', '이 사람 앞에서는 생각과 실력이 자연스럽게 나옵니다. 실무를 함께 맡기 좋은 관계입니다.'],
    '상관': ['표현을 자극하는 사람', '새로운 발상이 잘 나오지만 말이 앞서면 부딪힙니다. 의견은 글로 정리해 주고받으면 마찰이 줄어듭니다.'],
    '정재': ['성과를 함께 쌓는 실무형', '약속과 숫자를 지키는 관계입니다. 역할과 보상이 분명할수록 오래 갑니다.'],
    '편재': ['판을 넓혀 주는 기회형', '새로운 기회와 사람을 몰고 오지만 변동이 큽니다. 큰 결정은 기록을 남기고 진행하세요.'],
    '정관': ['기준을 세워 주는 리더형', '책임과 원칙을 일깨워 주는 상대입니다. 보고와 마감을 정확히 지키면 신뢰가 빨리 쌓입니다.'],
    '편관': ['강하게 밀어붙이는 압박형', '긴장감 속에서 크게 성장하지만 통제받는다고 느끼기 쉽습니다. 기대치를 숫자로 확인해 두면 부담이 줄어듭니다.'],
    '정인': ['끌어 주는 멘토형', '조언과 지지를 얻는 상대입니다. 먼저 묻고 배우는 자세가 관계를 키웁니다.'],
    '편인': ['다른 관점을 주는 조언자형', '독특한 시각을 얻지만 속마음을 읽기 어렵습니다. 의도를 한 번 더 확인하는 습관이 필요합니다.'],
  };
  const GOD_PERSONAL = {
    '비견': ['친구 같은 사이', '눈높이가 같아 편하지만, 자존심이 부딪히면 둘 다 물러서지 않습니다.'],
    '겁재': ['서로 자극하는 사이', '함께 있으면 의욕이 커지지만, 경쟁심이 섭섭함으로 번지지 않게 조심하세요.'],
    '식신': ['마음을 편하게 여는 사이', '이 사람 앞에서는 꾸밈없이 나를 드러낼 수 있습니다.'],
    '상관': ['솔직하게 부딪히는 사이', '재미와 자극이 크지만 말 한마디에 서운함이 생기기 쉽습니다.'],
    '정재': ['꾸준히 챙겨 주는 사이', '생활을 함께 꾸려 가기에 든든한 관계입니다.'],
    '편재': ['활력을 불어넣는 사이', '함께 있으면 활동 반경이 넓어지지만 마음을 붙잡아 두기는 어렵습니다.'],
    '정관': ['든든하게 잡아 주는 사이', '믿음이 가지만 규칙과 체면을 중시해 답답하게 느낄 수도 있습니다.'],
    '편관': ['긴장감을 주는 사이', '강하게 끌리지만 간섭받는다고 느끼지 않도록 거리 조절이 필요합니다.'],
    '정인': ['보살펴 주는 사이', '기대고 쉴 수 있는 울타리가 되어 주는 관계입니다.'],
    '편인': ['다른 세계를 보여 주는 사이', '깊은 대화가 가능하지만 속을 알기 어려워 거리감이 생길 수 있습니다.'],
  };
  // 일간 오행 관계: 누가 끌어주고 누가 누르는가
  const FLOW_TEXT = {
    bihwa: (a, b) => `두 사람의 일간이 같은 오행입니다. 생각과 속도가 비슷해 손발이 잘 맞지만, 둘 다 물러서지 않을 때는 역할을 나눠야 합니다.`,
    aGenB: (a, b) => `${a}의 기운이 ${eulReul(b)} 살려 주는 흐름입니다. ${iGa(a)} 먼저 정보를 나누고 기회를 열어 줄 때 관계가 단단해집니다.`,
    bGenA: (a, b) => `${b}의 기운이 ${a}에게 힘을 실어 주는 흐름입니다. ${eunNeun(a)} 필요한 도움을 먼저 청해도 괜찮은 관계입니다.`,
    aCtrlB: (a, b) => `${a}의 기운이 ${eulReul(b)} 누르는 흐름입니다. ${iGa(a)} 주도권을 쥐기 쉬우니 지시보다 질문으로 대화를 여세요.`,
    bCtrlA: (a, b) => `${b}의 기운이 ${eulReul(a)} 누르는 흐름입니다. ${iGa(a)} 압박을 느끼기 쉬우니 기대치와 마감을 미리 확인해 두면 부담이 줄어듭니다.`,
  };
  const REL_TIP = {
    boss: '보고는 결론부터 짧게, 자주. 상사가 나를 어떻게 보는지(아래 두 번째 줄)를 먼저 읽어 보세요.',
    junior: '지시는 이유와 함께, 피드백은 바로. 부하직원이 나를 어떤 사람으로 느끼는지가 일하는 방식을 좌우합니다.',
    ceo: '대표는 방향을, 직원은 실행을 맡을 때 이 궁합의 장점이 살아납니다. 역할 경계가 흐려지는 지점을 조심하세요.',
    peer: '함께 일하는 동료는 하루 대부분을 같이 보냅니다. 업무를 나눌 때 서로의 강점이 겹치지 않게 배치하세요.',
    partner: '동업이나 공동 프로젝트를 시작하기 전에, 아래 \'조심할 해\'와 주의 축을 꼭 함께 확인하세요. 지분과 역할은 문서로 남기세요.',
    parent: '부모와 자녀는 기대가 큰 만큼 서운함도 큽니다. 자녀가 부모를 어떻게 느끼는지 먼저 읽어 보세요.',
    friend: '오래 갈 친구인지보다, 어떤 때 서로 힘이 되는지 보는 데 쓰세요.',
    love: '', some: '',
  };
  function relationReading(an) {
    const { A, B, result, rel, ctx } = an;
    const il = result.axes.find(x => x.key === 'sibsinIlgan');
    const godBtoA = il.detail[0].god, godAtoB = il.detail[1].god;
    const T = ctx === 'work' ? GOD_WORK : GOD_PERSONAL;
    const cat = GC.pairRelation(STEM_ELEM[A.saju.day.stem], STEM_ELEM[B.saju.day.stem]);
    const SHORT = { cheongan: '천간', sibsinIlgan: '십신(일간)', complement: '오행보완', effect: '오행영향', twelveStage: '12운성', sibsinYeongan: '십신(연간)', napeum: '납음오행', dayPillar: '일주' };
    const cautions = result.axes.concat(result.auxAxes).filter(x => x.tier === '주의').map(x => SHORT[x.key] || x.title);
    return {
      label: RELATIONS[rel].label,
      rows: [
        { head: `${eunNeun(B.name)} ${A.name}에게`, tag: T[godBtoA][0], god: godBtoA, text: T[godBtoA][1] },
        { head: `${eunNeun(A.name)} ${B.name}에게`, tag: T[godAtoB][0], god: godAtoB, text: T[godAtoB][1] },
        { head: '기운의 흐름', tag: { bihwa: '나란히 가는 관계', aGenB: `${iGa(A.name)} 살려 주는 관계`, bGenA: `${iGa(B.name)} 살려 주는 관계`, aCtrlB: `${iGa(A.name)} 이끄는 관계`, bCtrlA: `${iGa(B.name)} 이끄는 관계` }[cat], text: FLOW_TEXT[cat](A.name, B.name) },
      ],
      cautions,
      tip: REL_TIP[rel],
    };
  }
  function relationHTML(an) {
    const r = relationReading(an);
    return `<section class="panel rel-panel">
      <h3 class="sec">${esc(r.label)} — 이 관계에서 읽는 법</h3>
      ${r.tip ? `<p class="small rel-tip">${esc(r.tip)}</p>` : ''}
      <div class="rel-rows">${r.rows.map(x => `<div class="rel-row"><div class="rel-head">${esc(x.head)}</div>
        <div class="rel-tag">${esc(x.tag)}${x.god ? ` <span class="rel-god">${esc(x.god)}</span>` : ''}</div>
        <p>${esc(x.text)}</p></div>`).join('')}</div>
      ${r.cautions.length ? `<p class="small rel-caution"><b>함께할 때 조심할 축</b> ${esc(r.cautions.join(' · '))}</p>` : ''}
    </section>`;
  }

  /* ---------- 앞으로 10년 함께 보는 흐름 ---------- */
  function personYearScore(row) {
    let s = 0;
    if (row.alignment.startsWith('길함')) s += 1;
    if (row.alignment.startsWith('주의')) s -= 1;
    if (row.tier === '강') s += 0.5;
    if (row.tier === '약') s -= 0.5;
    return s;
  }
  const CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
  const isChung = (a, b) => CHUNG.some(p => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a));

  const GOOD_YEAR = {
    love: '두 사람 모두 기운이 차오르는 해입니다. 이사·결혼·창업처럼 함께 내리는 큰 결정을 실행하기 좋은 시기입니다.',
    work: '두 사람 모두 기운이 차오르는 해입니다. 새 프로젝트·사업 확장·투자처럼 함께 내리는 큰 결정을 실행하기 좋은 시기입니다.',
    family: '두 사람 모두 기운이 차오르는 해입니다. 이사·진학·가족 행사처럼 함께 정하는 일을 추진하기 좋은 시기입니다.',
    friend: '두 사람 모두 기운이 차오르는 해입니다. 여행이나 새로운 도전을 함께 시작하기 좋은 시기입니다.',
  };
  function yearFlow(A, B, ctx) {
    const start = new Date().getFullYear();
    const ra = SC.analyzeSewoonFlow(A.saju, A.ys, start, 10);
    const rb = SC.analyzeSewoonFlow(B.saju, B.ys, start, 10);
    return ra.map((a, i) => {
      const b = rb[i];
      const sa = personYearScore(a), sb = personYearScore(b);
      let kind, label, text;
      if (sa >= 0.5 && sb >= 0.5) {
        kind = 'good'; label = '함께 힘이 나는 해';
        text = GOOD_YEAR[ctx] || GOOD_YEAR.love;
      } else if (sa <= -0.5 && sb <= -0.5) {
        kind = 'care'; label = '서로 조심할 해';
        text = '두 사람 모두 기운이 가라앉기 쉬운 해입니다. 큰 결정은 미루고, 서로 날을 세우기보다 쉬어가는 시간을 함께 가지세요.';
      } else if (Math.abs(sa - sb) >= 1) {
        const strong = sa > sb ? A.name : B.name, weak = sa > sb ? B.name : A.name;
        kind = 'lean'; label = `${iGa(strong)} 받쳐줄 해`;
        text = `${strong} 쪽은 기운이 좋고 ${weak} 쪽은 지치기 쉬운 해입니다. ${iGa(strong)} 먼저 챙기고 기다려 주면 관계가 단단해집니다.`;
      } else {
        kind = 'even'; label = '무난히 흐르는 해';
        text = '큰 기복 없이 흘러가는 해입니다. 일상의 리듬을 맞추고 작은 약속을 꾸준히 지키는 것이 관계를 키웁니다.';
      }
      const chungWith = [];
      if (isChung(a.branch, A.saju.day.branch)) chungWith.push(A.name);
      if (isChung(b.branch, B.saju.day.branch)) chungWith.push(B.name);
      return { yr: a.yr, gz: a.gzText, a, b, sa, sb, kind, label, text, chungWith };
    });
  }

  /* ---------- 관계 처방 (용신 오행 기준 함께 하면 좋은 것) ---------- */
  const ELEM_CARE = {
    '목': { act: '함께 걷는 산책, 식물 기르기, 새로운 것을 같이 배우기', place: '숲길·공원처럼 푸른 곳', talk: '계획과 꿈을 이야기할 때 힘이 납니다.' },
    '화': { act: '공연·전시 관람, 함께 하는 운동, 밝은 곳에서의 데이트', place: '햇볕 좋은 곳, 활기 있는 거리', talk: '칭찬과 감정 표현을 아끼지 않을 때 힘이 납니다.' },
    '토': { act: '집밥 해 먹기, 집 정리, 정해진 요일의 고정 루틴', place: '집과 익숙한 단골 공간', talk: '약속을 지키고 꾸준히 곁에 있어 줄 때 힘이 납니다.' },
    '금': { act: '함께 계획 세우기, 정리정돈, 규칙 있는 취미(등산 코스 완주 등)', place: '정돈된 공간, 산', talk: '분명하고 솔직하게 말해 줄 때 힘이 납니다.' },
    '수': { act: '깊은 대화, 여행, 물가 산책, 함께 책 읽기', place: '바다·강·호수 근처', talk: '충분히 들어주고 생각할 시간을 줄 때 힘이 납니다.' },
  };

  const ELEM_CARE_WORK = {
    '목': { act: '새 프로젝트 기획, 함께 공부하는 스터디', place: '탁 트인 회의실, 산책하며 나누는 짧은 회의', talk: '앞으로의 계획과 성장 방향을 이야기할 때 힘이 납니다.' },
    '화': { act: '발표·홍보처럼 성과가 드러나는 일', place: '활기 있는 공간, 사람들 앞', talk: '공개적인 칭찬과 인정을 받을 때 힘이 납니다.' },
    '토': { act: '정기 회의, 정해진 업무 루틴', place: '늘 쓰던 익숙한 자리', talk: '약속한 일정과 말을 꾸준히 지켜 줄 때 힘이 납니다.' },
    '금': { act: '역할·기준을 문서로 정리하기, 명확한 피드백', place: '정돈된 공간, 조용한 집중석', talk: '분명하고 솔직하게, 근거를 들어 말해 줄 때 힘이 납니다.' },
    '수': { act: '1:1 대화, 자료 공유, 충분한 검토 시간', place: '조용한 카페나 회의실', talk: '충분히 들어주고 생각할 시간을 줄 때 힘이 납니다.' },
  };

  /* ---------- 공통 렌더 조각 ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ELEM_CLASS = { '목': 'mok', '화': 'hwa', '토': 'to', '금': 'geum', '수': 'su' };
  function hasBatchim(w){ if(!w) return false; const c=w.charCodeAt(w.length-1); if(c<0xAC00||c>0xD7A3) return false; return (c-0xAC00)%28!==0; }
  const iGa = w => w === '나' ? '내가' : w + (hasBatchim(w) ? '이' : '가');
  const eulReul = w => w + (hasBatchim(w) ? '을' : '를');
  // 엔진 문장 속 '나가'를 '내가'로 (이름을 '나'로 쓴 경우)
  const fixNa = t => String(t).replace(/(^|[\s(,·])나가(?=\s)/g, '$1내가');
  const eunNeun = w => w + (hasBatchim(w) ? '은' : '는');
  const won = n => n.toLocaleString('ko-KR') + '원';

  function axisCard(axis, locked) {
    const stems = axis.stemsText ? `<div class="axis-stems">${esc(axis.stemsText)}</div>` : '';
    const nap = axis.napeumText ? `<div class="axis-sub">${esc(axis.napeumText)}</div>` : '';
    const note = axis.note && !locked ? `<div class="axis-note">${esc(axis.note)}</div>` : '';
    const body = locked
      ? `<div class="axis-locked"><span class="lock-ico" aria-hidden="true">鎖</span>상세 리포트에서 풀이 전문을 볼 수 있습니다</div>`
      : `<div class="axis-text">${esc(fixNa(axis.text))}</div>`;
    return `<article class="axis-card${locked ? ' is-locked' : ''}">
      <div class="axis-head"><h3>${esc(axis.title)}</h3><span class="tier-badge tier-${axis.tier}">${axis.tier}</span></div>
      ${locked ? '' : stems + nap}${note}${body}</article>`;
  }

  function tallyHTML(result) {
    return `<div class="tally-strip">
      <div class="tally-item hoho"><span class="num">${result.tally['우호']}</span><span class="label">우호</span></div>
      <div class="tally-item jungrip"><span class="num">${result.tally['중립']}</span><span class="label">중립</span></div>
      <div class="tally-item juui"><span class="num">${result.tally['주의']}</span><span class="label">주의</span></div>
    </div><p class="overall">${esc(fixNa(result.overallNote))}</p>`;
  }

  function pillarsHTML(P) {
    const s = P.saju;
    const cols = [['시', s.hour], ['일', s.day], ['월', s.month], ['년', s.year]];
    return `<div class="pillars">${cols.map(([lab, p]) => {
      if (!p) return `<div class="pillar empty"><div class="p-lab">${lab}주</div><div class="gz">?</div><div class="p-sub">시각 모름</div></div>`;
      const se = STEM_ELEM[p.stem], be = BRANCH_ELEM[p.branch];
      return `<div class="pillar${lab === '일' ? ' day' : ''}"><div class="p-lab">${lab}주</div>
        <div class="gz"><span class="e-${ELEM_CLASS[se]}">${STEMS_HAN[p.stem]}</span><span class="e-${ELEM_CLASS[be]}">${BRANCHES_HAN[p.branch]}</span></div>
        <div class="p-sub">${STEMS[p.stem]}${BRANCHES[p.branch]}</div></div>`;
    }).join('')}</div>`;
  }

  function elemBarsHTML(P) {
    const c = P.ys.counts, total = P.ys.total || 1;
    return `<div class="elem-rows">${['목', '화', '토', '금', '수'].map(e => {
      const pct = Math.round(c[e] / total * 100);
      const tag = e === P.ys.yongsin ? '<em class="yong">용신</em>' : e === P.ys.huisin ? '<em class="hui">희신</em>' : '';
      return `<div class="elem-row"><span class="e-name e-${ELEM_CLASS[e]}">${e}</span>
        <span class="bar"><span class="fill bg-${ELEM_CLASS[e]}" style="width:${pct}%"></span></span>
        <span class="e-val">${c[e].toFixed(1).replace('.0', '')}</span>${tag}</div>`;
    }).join('')}</div>`;
  }

  function yearRowHTML(y, A, B) {
    const chung = y.chungWith.length ? `<div class="yr-chung">${esc(y.chungWith.join('·'))}의 일지와 충(沖) — 생활 환경·리듬이 바뀌기 쉬운 해</div>` : '';
    return `<li class="yr yr-${y.kind}">
      <div class="yr-head"><span class="yr-num">${y.yr}</span><span class="yr-gz">${esc(y.gz)}년</span><span class="yr-label">${esc(y.label)}</span></div>
      <div class="yr-who"><span>${esc(A.name)} · ${esc(y.a.stage)} · ${esc(y.a.alignment.split('(')[0])}</span><span>${esc(B.name)} · ${esc(y.b.stage)} · ${esc(y.b.alignment.split('(')[0])}</span></div>
      <p>${esc(y.text)}</p>${chung}</li>`;
  }

  /* ---------- 무료 결과 ---------- */
  const FREE_OPEN = ['cheongan', 'dayPillar'];
  function renderFree(an) {
    const { A, B, result, years } = an;
    const all = result.axes.concat(result.auxAxes);
    const open = all.filter(a => FREE_OPEN.includes(a.key));
    const locked = all.filter(a => !FREE_OPEN.includes(a.key));
    const thisYear = years[0];
    return `
    <section class="panel">
      <p class="eyebrow">무료 궁합 결과 · ${esc(RELATIONS[an.rel].label)}</p>
      <h2 class="pair-title">${esc(A.name)} <span class="x">×</span> ${esc(B.name)}</h2>
      <div class="chips">
        <span class="chip bg-${ELEM_CLASS[STEM_ELEM[A.saju.day.stem]]}">${esc(A.name)} · ${STEMS[A.saju.day.stem]}${BRANCHES[A.saju.day.branch]}일주 · ${STEM_ELEM[A.saju.day.stem]}</span>
        <span class="chip bg-${ELEM_CLASS[STEM_ELEM[B.saju.day.stem]]}">${esc(B.name)} · ${STEMS[B.saju.day.stem]}${BRANCHES[B.saju.day.branch]}일주 · ${STEM_ELEM[B.saju.day.stem]}</span>
      </div>
      ${tallyHTML(result)}
    </section>
    ${relationHTML(an)}
    <section class="panel">
      <h3 class="sec">지금 바로 볼 수 있는 2개 축</h3>
      <div class="axis-list">${open.map(a => axisCard(a, false)).join('')}</div>
    </section>
    <section class="panel">
      <h3 class="sec">나머지 6개 축 — 등급만 공개</h3>
      <div class="axis-list">${locked.map(a => axisCard(a, true)).join('')}</div>
    </section>
    <section class="panel">
      <h3 class="sec">두 사람의 앞으로 10년</h3>
      <ol class="years">${yearRowHTML(thisYear, A, B)}
        ${years.slice(1, 4).map(y => `<li class="yr yr-locked"><div class="yr-head"><span class="yr-num">${y.yr}</span><span class="yr-gz">${esc(y.gz)}년</span><span class="yr-label">상세 리포트에서 공개</span></div></li>`).join('')}
      </ol>
      <p class="muted small">올해만 무료로 보여드립니다. 10년 전체 흐름은 상세 리포트에 들어 있습니다.</p>
    </section>`;
  }

  /* ---------- 상세 리포트 ---------- */
  function renderFull(an) {
    const { A, B, result, years } = an;
    const today = new Date();
    const issued = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
    const goodYears = years.filter(y => y.kind === 'good').map(y => y.yr);
    const careYears = years.filter(y => y.kind === 'care').map(y => y.yr);
    const person = P => `
      <div class="person">
        <h4>${esc(P.name)} <span class="muted">${esc(P.date.replace(/-/g, '.'))}${P.time ? ' ' + esc(P.time) : ' (시각 모름)'}</span></h4>
        ${P.kst && P.kst.shift ? `<p class="kst-note">${esc(P.kst.reasons.join(' · '))} → 표준시 ${esc(P.kst.date.replace(/-/g, '.'))} ${esc(P.kst.time)} 기준으로 계산</p>` : ''}
        ${pillarsHTML(P)}
        ${elemBarsHTML(P)}
        <p class="narr">${esc(SC.buildOverviewNarrative(P.saju, P.ys))}</p>
      </div>`;
    const care = (P, other) => {
      const c = (an.ctx === 'work' ? ELEM_CARE_WORK : ELEM_CARE)[P.ys.yongsin];
      return `<div class="care"><h4>${esc(P.name)}에게 힘이 되는 것 <span class="tag">용신 ${P.ys.yongsin}</span></h4>
        <dl><dt>${an.ctx === 'work' ? '함께 맡으면 좋은 일' : '함께 하면 좋은 일'}</dt><dd>${esc(c.act)}</dd>
        <dt>잘 맞는 장소</dt><dd>${esc(c.place)}</dd>
        <dt>${esc(iGa(other.name))} 기억할 것</dt><dd>${esc(eunNeun(P.name))} ${esc(c.talk)}</dd></dl></div>`;
    };
    return `
    <section class="panel report-cover">
      <p class="eyebrow">상세 궁합 리포트 · ${esc(RELATIONS[an.rel].label)}</p>
      <h2 class="pair-title">${esc(A.name)} <span class="x">×</span> ${esc(B.name)}</h2>
      <p class="muted small">발행일 ${issued} · 와이튜브 사주코어 엔진 · 정자시 기준</p>
      ${tallyHTML(result)}
      <div class="key-years">
        <div><b>함께 힘이 나는 해</b><span>${goodYears.length ? goodYears.join(', ') : '10년 안에 뚜렷한 해 없음'}</span></div>
        <div><b>서로 조심할 해</b><span>${careYears.length ? careYears.join(', ') : '10년 안에 뚜렷한 해 없음'}</span></div>
      </div>
    </section>
    ${relationHTML(an)}
    <section class="panel"><h3 class="sec">1. 두 사람의 사주 원국</h3><div class="persons">${person(A)}${person(B)}</div></section>
    <section class="panel"><h3 class="sec">2. 핵심 6축 풀이</h3><div class="axis-list">${result.axes.map(a => axisCard(a, false)).join('')}</div></section>
    <section class="panel"><h3 class="sec">3. 보조 전통기법 2종</h3><div class="axis-list">${result.auxAxes.map(a => axisCard(a, false)).join('')}</div></section>
    <section class="panel"><h3 class="sec">4. 앞으로 10년, 함께 보는 흐름</h3>
      <p class="muted small">해마다 두 사람의 세운(그해의 기운)을 각자의 용신·12운성에 대입해 견줘 본 결과입니다.</p>
      <ol class="years">${years.map(y => yearRowHTML(y, A, B)).join('')}</ol></section>
    <section class="panel"><h3 class="sec">5. 관계 처방</h3><div class="persons">${care(A, B)}${care(B, A)}</div></section>
    <section class="panel note-panel"><p class="small">이 리포트는 명리학 이론(오행 상생상극·십신·12운성·합충·용신)에 따른 참고용 해설이며, 두 사람 관계의 결과를 보장하지 않습니다. 실제 관계는 서로의 대화와 노력이 가장 중요합니다.</p></section>`;
  }

  root.GunghapReport = { RELATIONS, toKST, encodeOrder, decodeOrder, unlockKey, analyze, renderFree, renderFull, won, esc };
})(typeof window !== 'undefined' ? window : globalThis);
