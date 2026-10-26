/* ============================================================
   app.js — 화면 전환과 입력 처리
   주소 끝(#)에 따라 세 화면을 보여줍니다.
     (없음)          → 홈: 입력 + 무료 결과 + 상품 안내
     #<코드>.<열람키> → 상세 리포트 (입금 확인 후 운영자가 보내는 링크)
     #admin          → 운영자: 신청 코드로 리포트 링크 발급
   ============================================================ */
(function () {
  const CFG = window.GUNGHAP_CONFIG || {};
  const R = window.GunghapReport;
  const $ = id => document.getElementById(id);
  const won = R.won;

  /* ---------- 설정값 채우기 ---------- */
  ['pReport', 'pReport2', 'pReport3'].forEach(id => { $(id).textContent = won(CFG.reportPrice); });
  ['pConsult', 'pConsult2'].forEach(id => { $(id).textContent = won(CFG.consultPrice); });
  ['kakaoOrder', 'kakaoConsult', 'kakaoConsult2'].forEach(id => { $(id).href = CFG.kakaoUrl; });
  const bank = CFG.bank || {};
  $('bankLine').textContent = `${bank.name} ${bank.account} (예금주 ${bank.holder})`;
  const biz = CFG.business || {};
  $('bizLine1').textContent = `상호 ${biz.name} · 대표 ${biz.ceo} · 사업자등록번호 ${biz.regNo}`;
  $('bizLine2').textContent = `통신판매업 신고번호 ${biz.mailOrderNo} · 주소 ${biz.address}`;
  $('bizLine3').textContent = `고객센터 ${biz.phone} · ${biz.email}`;

  /* ---------- 복사 ---------- */
  async function copyText(text, input, toastEl) {
    try { await navigator.clipboard.writeText(text); toastEl.textContent = '복사했습니다.'; }
    catch (e) { if (input) { input.focus(); input.select(); } toastEl.textContent = '선택된 글자를 길게 눌러 복사해 주세요.'; }
  }

  /* ---------- 홈: 입력 (양력·음력, 시지 안내) ---------- */
  const BR = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const BR_RANGE = ['23:30~01:29', '01:30~03:29', '03:30~05:29', '05:30~07:29', '07:30~09:29', '09:30~11:29',
    '11:30~13:29', '13:30~15:29', '15:30~17:29', '17:30~19:29', '19:30~21:29', '21:30~23:29'];
  const pad = n => String(n).padStart(2, '0');
  const lunarCal = window.KoreanLunarCalendar ? new window.KoreanLunarCalendar() : null;
  const isLunar = s => $('cal' + s + 'Lunar').checked;

  function fillSelect(sel, from, to, unit, keep) {
    const prev = keep ? sel.value : '';
    sel.innerHTML = `<option value="">${unit}</option>` +
      Array.from({ length: to - from + 1 }, (_, i) => from + i).map(n => `<option value="${n}">${n}${unit}</option>`).join('');
    if (prev && Number(prev) >= from && Number(prev) <= to) sel.value = prev;
  }
  function daysInSolarMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  // 음력 → 양력. 존재하지 않는 날짜(작은달 30일, 없는 윤달)는 null
  function lunarToSolar(y, m, d, leap) {
    if (!lunarCal || !lunarCal.setLunarDate(y, m, d, leap)) return null;
    const sol = lunarCal.getSolarCalendar();
    if (!lunarCal.setSolarDate(sol.year, sol.month, sol.day)) return null;
    const back = lunarCal.getLunarCalendar();
    if (back.year !== y || back.month !== m || back.day !== d || !!back.intercalation !== !!leap) return null;
    return sol;
  }

  // 입력값을 양력 날짜로 읽기 → { ok, date:'YYYY-MM-DD', msg }
  function readDate(s) {
    const y = Number($('year' + s).value), m = Number($('month' + s).value), d = Number($('day' + s).value);
    if (!y || !m || !d) return { ok: false, msg: '' };
    if (!isLunar(s)) {
      if (d > daysInSolarMonth(y, m)) return { ok: false, msg: `${m}월에는 ${d}일이 없어요.` };
      return { ok: true, date: `${y}-${pad(m)}-${pad(d)}`, msg: '' };
    }
    const leap = $('leap' + s).checked;
    const sol = lunarToSolar(y, m, d, leap);
    if (!sol) return { ok: false, msg: leap ? `${y}년에는 윤${m}월이 없거나 ${d}일이 없는 달이에요.` : `음력 ${y}년 ${m}월에는 ${d}일이 없어요.` };
    return { ok: true, date: `${sol.year}-${pad(sol.month)}-${pad(sol.day)}`,
      msg: `양력 ${sol.year}년 ${sol.month}월 ${sol.day}일로 계산합니다.` };
  }

  function refreshDays(s) {
    const y = Number($('year' + s).value), m = Number($('month' + s).value);
    const max = isLunar(s) ? 30 : (y && m ? daysInSolarMonth(y, m) : 31);
    fillSelect($('day' + s), 1, max, '일', true);
  }
  function refreshConv(s) {
    $('leapWrap' + s).hidden = !isLunar(s);
    if (!isLunar(s)) $('leap' + s).checked = false;
    const r = readDate(s);
    $('conv' + s).textContent = r.msg;
    refreshSiji(s);
  }
  function refreshSiji(s) {
    const t = $('btime' + s).value, el = $('siji' + s);
    if (!t || $('timeUnknown' + s).checked) { el.textContent = ''; return; }
    const r = readDate(s);
    const k = r.ok ? R.toKST(r.date, t) : { time: t, shift: 0, reasons: [] };
    const [h, mi] = k.time.split(':').map(Number);
    const solarMin = ((h * 60 + mi - 30) % 1440 + 1440) % 1440;
    const b = Math.floor(((solarMin + 60) % 1440) / 120);
    const moved = r.ok && k.date !== r.date ? (k.date < r.date ? '전날 ' : '다음 날 ') : '';
    const pre = k.shift ? `${k.reasons.join(' · ')}으로 ${moved}${k.time} 기준, ` : '';
    el.textContent = `${pre}${BR[b]}시(${BR_RANGE[b]})로 계산합니다.` + (b === 0 && h >= 23 ? ' 날짜는 다음 날로 봅니다.' : '');
  }

  const thisYear = new Date().getFullYear();
  ['A', 'B'].forEach(s => {
    fillSelect($('year' + s), 1920, thisYear, '년');
    fillSelect($('month' + s), 1, 12, '월');
    fillSelect($('day' + s), 1, 31, '일');
    [('year' + s), ('month' + s)].forEach(id => $(id).addEventListener('change', () => { refreshDays(s); refreshConv(s); }));
    $('day' + s).addEventListener('change', () => refreshConv(s));
    $('leap' + s).addEventListener('change', () => refreshConv(s));
    document.querySelectorAll(`input[name="cal${s}"]`).forEach(r => r.addEventListener('change', () => { refreshDays(s); refreshConv(s); }));
    $('btime' + s).addEventListener('input', () => refreshSiji(s));
    $('btime' + s).addEventListener('change', () => refreshSiji(s));
    $('timeUnknown' + s).addEventListener('change', ev => { $('btime' + s).disabled = ev.target.checked; refreshSiji(s); });
  });

  /* ---------- 홈: 무료 결과 ---------- */
  let currentCode = null;
  function readPerson(s, fallbackName) {
    const r = readDate(s);
    if (!r.ok) return { error: r.msg };
    const unknown = $('timeUnknown' + s).checked;
    const time = unknown ? '' : ($('btime' + s).value || '');
    const name = ($('name' + s).value.trim() || fallbackName).slice(0, 10);
    return { name, date: r.date, time };
  }
  function showFree(A, B, isSample) {
    const an = R.analyze(A, B);
    $('freeResult').innerHTML = R.renderFree(an);
    $('sampleNote').hidden = !isSample;
    if (!isSample) {
      currentCode = R.encodeOrder(A, B);
      $('orderCode').value = currentCode;
      $('copyToast').textContent = '';
    }
  }
  $('gunghapForm').addEventListener('submit', e => {
    e.preventDefault();
    const A = readPerson('A', '첫 번째 분'), B = readPerson('B', '두 번째 분');
    const bad = [A, B].find(p => p.error !== undefined);
    if (bad) { $('formError').textContent = bad.error || '두 사람의 생년월일을 모두 골라 주세요.'; return; }
    $('formError').textContent = '';
    showFree(A, B, false);
    $('freeResult').classList.remove('reveal'); void $('freeResult').offsetWidth; $('freeResult').classList.add('reveal');
    $('freeResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('copyCode').addEventListener('click', () => {
    if (!currentCode) { $('copyToast').textContent = '먼저 위에서 두 사람의 무료 궁합을 확인해 주세요.'; return; }
    copyText(currentCode, $('orderCode'), $('copyToast'));
  });

  /* ---------- 상세 리포트 ---------- */
  async function showReport(token) {
    const dot = token.lastIndexOf('.');
    const code = token.slice(0, dot), key = token.slice(dot + 1);
    const order = R.decodeOrder(code);
    const ok = order && key && (await R.unlockKey(code)) === key;
    $('viewHome').hidden = true; $('viewAdmin').hidden = true;
    if (!ok) { $('viewBadLink').hidden = false; $('viewReport').hidden = true; return; }
    $('viewBadLink').hidden = true;
    $('fullReport').innerHTML = R.renderFull(R.analyze(order.A, order.B));
    $('viewReport').hidden = false;
    document.title = `${order.A.name} × ${order.B.name} 상세 궁합 리포트 | 궁합코어`;
  }

  /* ---------- 운영자 ---------- */
  function showAdmin() {
    $('viewHome').hidden = true; $('viewReport').hidden = true; $('viewBadLink').hidden = true;
    $('viewAdmin').hidden = false;
  }
  async function sha256Hex(t) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function tryAdmin() {
    if ((await sha256Hex($('adminPin').value)) === CFG.adminPinHash) { $('adminLock').hidden = true; $('adminBody').hidden = false; }
    else $('adminErr').textContent = '비밀번호가 맞지 않습니다.';
  }
  $('adminEnter').addEventListener('click', tryAdmin);
  $('adminPin').addEventListener('keydown', e => { if (e.key === 'Enter') tryAdmin(); });
  $('adminMake').addEventListener('click', async () => {
    const code = $('adminCode').value.replace(/\s+/g, '');
    const order = R.decodeOrder(code);
    const out = $('adminOut');
    if (!order) { out.innerHTML = '<p style="color:var(--hwa)">신청 코드를 읽을 수 없습니다. 고객이 보낸 코드 전체를 붙여넣었는지 확인해 주세요.</p>'; return; }
    const key = await R.unlockKey(code);
    const base = (CFG.siteUrl || location.href.split('#')[0]).replace(/#.*$/, '');
    const link = `${base}#${code}.${key}`;
    const p = x => `${R.esc(x.name)} · ${R.esc(x.date)} ${x.time ? R.esc(x.time) : '(시각 모름)'}`;
    const msg = `안녕하세요, 궁합코어입니다. 입금 확인되었습니다.\n${order.A.name}님 × ${order.B.name}님 상세 궁합 리포트를 보내 드립니다.\n${link}\n링크는 기간 제한 없이 다시 열어보실 수 있어요. 1:1 상담이 필요하시면 언제든 말씀해 주세요.`;
    out.innerHTML = `
      <p><b>주문 내용 확인</b><br>${p(order.A)}<br>${p(order.B)}</p>
      <label for="adminMsg">고객에게 보낼 메시지</label>
      <textarea id="adminMsg" rows="6" readonly>${R.esc(msg)}</textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button type="button" class="btn-line" id="copyMsg">메시지 복사</button>
        <a class="btn-line" href="${R.esc(link)}" target="_blank" rel="noopener">리포트 미리 열기</a>
      </div><div class="toast" id="adminToast"></div>`;
    $('copyMsg').addEventListener('click', () => copyText(msg, $('adminMsg'), $('adminToast')));
  });

  /* ---------- 약관 ---------- */
  const POLICY = {
    terms: `<h4>이용약관 및 환불 규정</h4>
      <ol>
        <li>궁합코어는 두 사람의 생년월일시를 명리학 이론으로 풀이한 참고용 해설을 제공합니다. 결과는 관계의 성패나 미래를 보장하지 않으며, 중요한 결정은 이용자 본인의 판단에 따릅니다.</li>
        <li>기본 궁합 결과는 무료입니다. 상세 리포트(${won(CFG.reportPrice)})와 1:1 상담(${won(CFG.consultPrice)})은 유료입니다.</li>
        <li>상세 리포트는 입금 확인 후 카카오톡으로 개인 링크를 보내 드리는 디지털 콘텐츠입니다. 링크를 받기 전에는 전액 환불되며, 링크를 받은 뒤에는 전자상거래법 제17조 제2항에 따라 청약철회가 제한됩니다. 이용자의 입력 오류로 리포트가 잘못 만들어진 경우 1회 무료로 다시 만들어 드립니다.</li>
        <li>1:1 상담은 상담일 하루 전까지 취소하면 전액 환불, 당일 취소는 50% 환불됩니다.</li>
        <li>리포트 링크는 구매자 본인만 사용해야 하며, 무단 배포·판매를 금지합니다.</li>
      </ol>`,
    privacy: `<h4>개인정보 처리방침</h4>
      <ul>
        <li>무료 궁합 계산은 이용자 기기 안에서만 이뤄지며, 입력한 이름·생년월일시는 서버로 전송되거나 저장되지 않습니다.</li>
        <li>상세 리포트를 신청하면 신청 코드(두 사람의 이름 또는 별명, 생년월일시)와 입금자명을 카카오톡으로 받습니다. 이는 리포트 제작과 발송, 고객 문의 응대에만 사용합니다.</li>
        <li>보관 기간: 전자상거래법에 따라 대금 결제 기록은 5년, 소비자 불만·분쟁 처리 기록은 3년 보관한 뒤 파기합니다.</li>
        <li>이름 대신 별명을 넣어도 리포트를 받는 데 문제가 없습니다. 다른 사람의 정보는 그분이 동의한 경우에만 넣어 주세요.</li>
        <li>개인정보 보호 책임자: ${R.esc(CFG.business.ceo)} (${R.esc(CFG.business.email)})</li>
      </ul>`,
  };
  function showPolicy(which) {
    const box = $('policyBox');
    box.innerHTML = POLICY[which]; box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('lnkTerms').addEventListener('click', e => { e.preventDefault(); showPolicy('terms'); });
  $('lnkPrivacy').addEventListener('click', e => { e.preventDefault(); showPolicy('privacy'); });

  /* ---------- 시작 ---------- */
  function route() {
    const h = decodeURIComponent((location.hash || '').slice(1));
    if (h === 'admin') return showAdmin();
    if (h === 'terms' || h === 'privacy') { showSample(); return showPolicy(h); }
    if (h && h.includes('.') && h.length > 20) return showReport(h);
    showSample();
  }
  function showSample() {
    showFree({ name: '지민', date: '1992-05-14', time: '07:30' }, { name: '서준', date: '1990-11-03', time: '22:10' }, true);
  }
  route();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
