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
  function encodeOrder(A, B) {
    const pack = p => [p.name, p.date.replace(/-/g, ''), (p.time || '').replace(':', '')];
    return b64urlEncode(JSON.stringify({ v: 1, a: pack(A), b: pack(B) }));
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
      return { A: unpack(o.a), B: unpack(o.b) };
    } catch (e) { return null; }
  }
  async function unlockKey(code) {
    const salt = (root.GUNGHAP_CONFIG && root.GUNGHAP_CONFIG.unlockSalt) || '';
    const data = new TextEncoder().encode(code + '|' + salt);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).slice(0, 5).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- 계산 ---------- */
  function personSaju(p) {
    const [y, m, d] = p.date.split('-').map(Number);
    let hour = 12, minute = 0;
    const hasTime = !!p.time;
    if (hasTime) { [hour, minute] = p.time.split(':').map(Number); }
    const saju = SC.computeSaju(y, m, d, hour, minute, hasTime, 'M', JASI_MODE);
    const ys = SC.computeYongsin(saju, hasTime);
    return { ...p, saju, ys, hasTime };
  }
  function analyze(Ain, Bin) {
    const A = personSaju(Ain), B = personSaju(Bin);
    const result = GC.analyzeGunghap(A.saju, B.saju, {
      nameA: A.name, nameB: B.name, hasTimeA: A.hasTime, hasTimeB: B.hasTime,
    });
    return { A, B, result, years: yearFlow(A, B) };
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

  function yearFlow(A, B) {
    const start = new Date().getFullYear();
    const ra = SC.analyzeSewoonFlow(A.saju, A.ys, start, 10);
    const rb = SC.analyzeSewoonFlow(B.saju, B.ys, start, 10);
    return ra.map((a, i) => {
      const b = rb[i];
      const sa = personYearScore(a), sb = personYearScore(b);
      let kind, label, text;
      if (sa >= 0.5 && sb >= 0.5) {
        kind = 'good'; label = '함께 힘이 나는 해';
        text = '두 사람 모두 기운이 차오르는 해입니다. 이사·결혼·창업처럼 함께 내리는 큰 결정을 실행하기 좋은 시기입니다.';
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

  /* ---------- 공통 렌더 조각 ---------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ELEM_CLASS = { '목': 'mok', '화': 'hwa', '토': 'to', '금': 'geum', '수': 'su' };
  function hasBatchim(w){ if(!w) return false; const c=w.charCodeAt(w.length-1); if(c<0xAC00||c>0xD7A3) return false; return (c-0xAC00)%28!==0; }
  const iGa = w => w + (hasBatchim(w) ? '이' : '가');
  const eunNeun = w => w + (hasBatchim(w) ? '은' : '는');
  const won = n => n.toLocaleString('ko-KR') + '원';

  function axisCard(axis, locked) {
    const stems = axis.stemsText ? `<div class="axis-stems">${esc(axis.stemsText)}</div>` : '';
    const nap = axis.napeumText ? `<div class="axis-sub">${esc(axis.napeumText)}</div>` : '';
    const note = axis.note && !locked ? `<div class="axis-note">${esc(axis.note)}</div>` : '';
    const body = locked
      ? `<div class="axis-locked"><span class="lock-ico" aria-hidden="true">鎖</span>상세 리포트에서 풀이 전문을 볼 수 있습니다</div>`
      : `<div class="axis-text">${esc(axis.text)}</div>`;
    return `<article class="axis-card${locked ? ' is-locked' : ''}">
      <div class="axis-head"><h3>${esc(axis.title)}</h3><span class="tier-badge tier-${axis.tier}">${axis.tier}</span></div>
      ${locked ? '' : stems + nap}${note}${body}</article>`;
  }

  function tallyHTML(result) {
    return `<div class="tally-strip">
      <div class="tally-item hoho"><span class="num">${result.tally['우호']}</span><span class="label">우호</span></div>
      <div class="tally-item jungrip"><span class="num">${result.tally['중립']}</span><span class="label">중립</span></div>
      <div class="tally-item juui"><span class="num">${result.tally['주의']}</span><span class="label">주의</span></div>
    </div><p class="overall">${esc(result.overallNote)}</p>`;
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
      <p class="eyebrow">무료 궁합 결과</p>
      <h2 class="pair-title">${esc(A.name)} <span class="x">×</span> ${esc(B.name)}</h2>
      <div class="chips">
        <span class="chip bg-${ELEM_CLASS[STEM_ELEM[A.saju.day.stem]]}">${esc(A.name)} · ${STEMS[A.saju.day.stem]}${BRANCHES[A.saju.day.branch]}일주 · ${STEM_ELEM[A.saju.day.stem]}</span>
        <span class="chip bg-${ELEM_CLASS[STEM_ELEM[B.saju.day.stem]]}">${esc(B.name)} · ${STEMS[B.saju.day.stem]}${BRANCHES[B.saju.day.branch]}일주 · ${STEM_ELEM[B.saju.day.stem]}</span>
      </div>
      ${tallyHTML(result)}
    </section>
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
        ${pillarsHTML(P)}
        ${elemBarsHTML(P)}
        <p class="narr">${esc(SC.buildOverviewNarrative(P.saju, P.ys))}</p>
      </div>`;
    const care = (P, other) => {
      const c = ELEM_CARE[P.ys.yongsin];
      return `<div class="care"><h4>${esc(P.name)}에게 힘이 되는 것 <span class="tag">용신 ${P.ys.yongsin}</span></h4>
        <dl><dt>함께 하면 좋은 일</dt><dd>${esc(c.act)}</dd>
        <dt>잘 맞는 장소</dt><dd>${esc(c.place)}</dd>
        <dt>${esc(iGa(other.name))} 기억할 것</dt><dd>${esc(eunNeun(P.name))} ${esc(c.talk)}</dd></dl></div>`;
    };
    return `
    <section class="panel report-cover">
      <p class="eyebrow">상세 궁합 리포트</p>
      <h2 class="pair-title">${esc(A.name)} <span class="x">×</span> ${esc(B.name)}</h2>
      <p class="muted small">발행일 ${issued} · 와이튜브 사주코어 엔진 · 정자시 기준</p>
      ${tallyHTML(result)}
      <div class="key-years">
        <div><b>함께 힘이 나는 해</b><span>${goodYears.length ? goodYears.join(', ') : '10년 안에 뚜렷한 해 없음'}</span></div>
        <div><b>서로 조심할 해</b><span>${careYears.length ? careYears.join(', ') : '10년 안에 뚜렷한 해 없음'}</span></div>
      </div>
    </section>
    <section class="panel"><h3 class="sec">1. 두 사람의 사주 원국</h3><div class="persons">${person(A)}${person(B)}</div></section>
    <section class="panel"><h3 class="sec">2. 핵심 6축 풀이</h3><div class="axis-list">${result.axes.map(a => axisCard(a, false)).join('')}</div></section>
    <section class="panel"><h3 class="sec">3. 보조 전통기법 2종</h3><div class="axis-list">${result.auxAxes.map(a => axisCard(a, false)).join('')}</div></section>
    <section class="panel"><h3 class="sec">4. 앞으로 10년, 함께 보는 흐름</h3>
      <p class="muted small">해마다 두 사람의 세운(그해의 기운)을 각자의 용신·12운성에 대입해 견줘 본 결과입니다.</p>
      <ol class="years">${years.map(y => yearRowHTML(y, A, B)).join('')}</ol></section>
    <section class="panel"><h3 class="sec">5. 관계 처방</h3><div class="persons">${care(A, B)}${care(B, A)}</div></section>
    <section class="panel note-panel"><p class="small">이 리포트는 명리학 이론(오행 상생상극·십신·12운성·합충·용신)에 따른 참고용 해설이며, 두 사람 관계의 결과를 보장하지 않습니다. 실제 관계는 서로의 대화와 노력이 가장 중요합니다.</p></section>`;
  }

  root.GunghapReport = { encodeOrder, decodeOrder, unlockKey, analyze, renderFree, renderFull, won, esc };
})(typeof window !== 'undefined' ? window : globalThis);
