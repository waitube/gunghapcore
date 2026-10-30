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
  ['pReport', 'pReport2', 'pReport3', 'pReport4'].forEach(id => { $(id).textContent = won(CFG.reportPrice); });
  ['pConsult', 'pConsult2', 'pConsult3'].forEach(id => { $(id).textContent = won(CFG.consultPrice); });
  ['kakaoOrder', 'kakaoConsult3'].forEach(id => { $(id).href = CFG.kakaoUrl; });
  const bank = CFG.bank || {};
  $('bankLine').textContent = `${bank.name} ${bank.account} (예금주 ${bank.holder})`;
  const biz = CFG.business || {};
  $('bizLine1').textContent = `상호 ${biz.name} · 대표 ${biz.ceo} · 사업자등록번호 ${biz.regNo}`;
  $('bizLine2').textContent = `통신판매업 신고번호 ${biz.mailOrderNo} · 주소 ${biz.address}`;
  $('bizLine3').textContent = `대표전화 ${biz.phone} · 이메일 ${biz.email}`;

  /* ---------- 복사 ---------- */
  // 두 가지 방법으로 복사 (브라우저마다 되는 방식이 달라서)
  function copyByTextarea(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length);
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta); return ok;
  }
  async function copyText(text, input, toastEl) {
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) {}
    if (!ok) ok = copyByTextarea(text);
    if (ok) { toastEl.textContent = '복사했습니다. 카톡 등에 붙여넣기(Ctrl+V) 하세요.'; }
    else { if (input) { input.focus(); input.select(); } toastEl.textContent = '선택된 글자를 길게 눌러(또는 Ctrl+C) 복사해 주세요.'; }
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
  let currentPair = null; // 상담 신청에 함께 보낼 두 사람 정보

  /* ---------- 관계 고르기 ---------- */
  const RELS = R.RELATIONS;
  let currentRel = 'love';
  const GROUPS = [['연인', ['love', 'some']], ['일', ['boss', 'junior', 'ceo', 'peer', 'partner']], ['가족·친구', ['parent', 'friend']]];
  $('relPicker').innerHTML = GROUPS.map(([g, keys]) => `<p class="rel-group">${g}</p>` + keys.map(k =>
    `<input type="radio" name="rel" id="rel-${k}" value="${k}"${k === currentRel ? ' checked' : ''}><label for="rel-${k}">${RELS[k].label}</label>`).join('')).join('');
  const HERO = ['boss', 'junior', 'ceo', 'peer', 'partner', 'love', 'parent'];
  $('heroRels').innerHTML = HERO.map(k => `<button type="button" data-rel="${k}" class="${RELS[k].ctx === 'work' ? 'work' : ''}">${RELS[k].label}</button>`).join('');
  function setRel(k, scroll) {
    if (!RELS[k]) return;
    currentRel = k;
    $('rel-' + k).checked = true;
    $('legendA').textContent = RELS[k].a;
    $('legendB').textContent = RELS[k].b;
    $('nameA').placeholder = `이름 또는 별명 (비우면 '${RELS[k].a}')`;
    $('nameB').placeholder = `이름 또는 별명 (비우면 '${RELS[k].b}')`;
    $('goBtn').textContent = `${RELS[k].label} 궁합 무료로 보기`;
    if (scroll) $('formTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelectorAll('input[name="rel"]').forEach(r => r.addEventListener('change', () => setRel(r.value)));
  document.querySelectorAll('#heroRels button').forEach(b => b.addEventListener('click', () => setRel(b.dataset.rel, true)));
  setRel(currentRel);
  function readPerson(s, fallbackName) {
    const r = readDate(s);
    if (!r.ok) return { error: r.msg };
    const unknown = $('timeUnknown' + s).checked;
    const time = unknown ? '' : ($('btime' + s).value || '');
    const name = ($('name' + s).value.trim() || fallbackName).slice(0, 10);
    return { name, date: r.date, time };
  }
  function showFree(A, B, isSample, rel) {
    const an = R.analyze(A, B, rel || currentRel);
    $('freeResult').innerHTML = R.renderFree(an);
    $('sampleNote').hidden = !isSample;
    if (!isSample) {
      currentCode = R.encodeOrder(A, B, currentRel);
      currentPair = { A, B, rel: currentRel };
      $('orderCode').value = currentCode;
      $('copyToast').textContent = '';
    }
  }
  $('gunghapForm').addEventListener('submit', e => {
    e.preventDefault();
    const A = readPerson('A', RELS[currentRel].a), B = readPerson('B', RELS[currentRel].b);
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

  /* ---------- 결제·알림 서버 ---------- */
  const API = (CFG.apiBase || '').replace(/\/+$/, '');
  const PAY_ON = !!(API && CFG.tossClientKey);
  const siteBase = () => (CFG.siteUrl || location.href).split('#')[0].split('?')[0];
  async function api(path, body) {
    const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.message || '요청을 처리하지 못했습니다.'); e.data = d; throw e; }
    return d;
  }
  function loadScript(src) {
    return new Promise((ok, no) => {
      if (document.querySelector(`script[src="${src}"]`)) return ok();
      const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = () => no(new Error('결제창을 불러오지 못했습니다.'));
      document.head.appendChild(el);
    });
  }
  // 이 브라우저에서 결제한 리포트 (편의 기능 — 안 되어도 리포트 링크로 열 수 있음)
  const MY_KEY = 'gc_my_reports';
  function myReports() { try { return JSON.parse(localStorage.getItem(MY_KEY) || '[]'); } catch (e) { return []; } }
  function saveMyReport(token, label) {
    try { const list = myReports().filter(x => x.t !== token); list.unshift({ t: token, l: label, at: Date.now() }); localStorage.setItem(MY_KEY, JSON.stringify(list.slice(0, 10))); } catch (e) {}
  }

  if (PAY_ON) {
    $('payBox').hidden = false;
    // 계좌이체 안내는 접어서 아래에 둠
    const steps = $('orderSteps');
    const det = document.createElement('details'); det.className = 'alt-pay';
    det.innerHTML = '<summary>계좌이체로 신청하기</summary>';
    steps.parentNode.insertBefore(det, steps); det.appendChild(steps);
    const mine = myReports();
    if (mine.length) {
      $('myReports').hidden = false;
      $('myReports').innerHTML = '이 기기에서 결제한 리포트: ' + mine.slice(0, 3).map(x => `<a href="#${R.esc(x.t)}">${R.esc(x.l)}</a>`).join(' · ');
    }
  }
  $('payBtn').addEventListener('click', async () => {
    const note = $('payNote'), btn = $('payBtn');
    if (!currentCode) { note.textContent = '먼저 위에서 두 사람의 정보를 넣고 무료 궁합을 확인해 주세요. 그 두 사람의 리포트가 결제됩니다.'; $('formTitle').scrollIntoView({ behavior: 'smooth' }); return; }
    if (!$('payAgree').checked) { note.textContent = '결제 전에 위 환불 안내에 체크해 주세요.'; return; }
    btn.disabled = true; const old = btn.innerHTML; btn.textContent = '결제창 여는 중…';
    try {
      const o = await api('/order', { code: currentCode });
      await loadScript('https://js.tosspayments.com/v2/standard');
      const payment = window.TossPayments(CFG.tossClientKey).payment({ customerKey: window.TossPayments.ANONYMOUS });
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: o.amount },
        orderId: o.orderId,
        orderName: o.orderName,
        successUrl: siteBase() + '?pay=ok',
        failUrl: siteBase() + '?pay=fail',
      });
    } catch (e) {
      const code = e && (e.code || (e.data && e.data.error));
      note.textContent = code === 'USER_CANCEL' ? '결제를 취소했어요. 다시 누르면 이어서 결제할 수 있어요.' : `결제를 시작하지 못했어요. ${e.message || ''} 계속 안 되면 아래 계좌이체로 신청해 주세요.`;
    } finally { btn.disabled = false; btn.innerHTML = old; $('pReport4').textContent = won(CFG.reportPrice); }
  });

  // 토스 결제창에서 돌아왔을 때
  async function handlePayReturn(q) {
    $('viewHome').hidden = true; $('viewPay').hidden = false;
    history.replaceState(null, '', siteBase());
    if (q.get('pay') === 'fail') {
      $('payTitle').textContent = '결제가 완료되지 않았어요';
      const m = (q.get('message') || '결제가 취소되었거나 실패했습니다').replace(/[.。]\s*$/, '');
      $('payMsg').textContent = `${m}. 돈은 빠져나가지 않았으니 안심하세요.`;
      $('payActions').innerHTML = `<a class="btn-seal" href="${R.esc(siteBase())}">처음으로 돌아가기</a>`;
      return;
    }
    try {
      const d = await api('/confirm', { paymentKey: q.get('paymentKey'), orderId: q.get('orderId'), amount: Number(q.get('amount')) });
      const o = R.decodeOrder(d.token.slice(0, d.token.lastIndexOf('.')));
      saveMyReport(d.token, o ? `${o.A.name} × ${o.B.name}` : '내 리포트');
      history.replaceState(null, '', siteBase() + '#' + d.token);
      $('viewPay').hidden = true;
      await showReport(d.token);
      $('paidNotice').hidden = false;
      $('myLink').value = siteBase() + '#' + d.token;
      window.scrollTo(0, 0);
    } catch (e) {
      $('payTitle').textContent = '결제 확인에 문제가 생겼어요';
      $('payMsg').innerHTML = `${R.esc(e.message || '')}<br>결제가 되었는데 리포트가 열리지 않았다면 아래 주문번호와 함께 카카오톡으로 알려 주세요. 바로 열어 드릴게요.<br><b>주문번호 ${R.esc(q.get('orderId') || '-')}</b>`;
      $('payActions').innerHTML = `<a class="btn-seal" href="${R.esc(CFG.kakaoUrl)}" target="_blank" rel="noopener">카카오톡으로 알리기</a>`;
    }
  }
  $('copyMyLink').addEventListener('click', () => copyText($('myLink').value, $('myLink'), $('myLinkToast')));

  /* ---------- 상세 리포트 ---------- */
  async function checkKey(code, key) {
    if (API) {
      try { return (await api('/verify', { code, key })).ok === true; }
      catch (e) { if (!CFG.unlockSalt) throw e; }
    }
    return (await R.unlockKey(code)) === key;
  }
  async function showReport(token) {
    const dot = token.lastIndexOf('.');
    const code = token.slice(0, dot), key = token.slice(dot + 1);
    const order = R.decodeOrder(code);
    let ok = false;
    try { ok = !!(order && key && await checkKey(code, key)); }
    catch (e) {
      $('viewHome').hidden = true; $('viewBadLink').hidden = false;
      $('viewBadLink').querySelector('p').textContent = '지금 리포트를 확인하는 서버에 연결되지 않아요. 잠시 후 새로고침해 주세요.';
      return;
    }
    $('viewHome').hidden = true; $('viewAdmin').hidden = true;
    if (!ok) { $('viewBadLink').hidden = false; $('viewReport').hidden = true; return; }
    $('viewBadLink').hidden = true;
    $('fullReport').innerHTML = R.renderFull(R.analyze(order.A, order.B, order.rel));
    currentPair = { A: order.A, B: order.B, rel: order.rel, paid: true };
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
  let adminPin = '';
  // 서버를 쓰면 비밀번호 확인도 서버(Cloudflare의 ADMIN_PIN) 한 곳에서만 합니다.
  const PIN_PROBE = 'eyJ2IjoxLCJhIjpbIngiXSwiYiI6WyJ5Il19'; // 확인용 가짜 신청 코드
  async function tryAdmin() {
    const pin = $('adminPin').value.trim();
    $('adminErr').textContent = '';
    let ok = false;
    if (API) {
      try { await api('/issue', { code: PIN_PROBE, pin }); ok = true; }
      catch (e) { $('adminErr').textContent = e.data && e.data.error === 'pin' ? '비밀번호가 맞지 않습니다. (Cloudflare의 ADMIN_PIN 값과 같아야 해요)' : (e.message || '서버에 연결하지 못했습니다.'); return; }
    } else ok = (await sha256Hex(pin)) === CFG.adminPinHash;
    if (ok) { adminPin = pin; $('adminLock').hidden = true; $('adminBody').hidden = false; }
    else $('adminErr').textContent = '비밀번호가 맞지 않습니다.';
  }
  $('adminEnter').addEventListener('click', tryAdmin);
  $('adminPin').addEventListener('keydown', e => { if (e.key === 'Enter') tryAdmin(); });
  $('adminMake').addEventListener('click', async () => {
    const code = $('adminCode').value.replace(/\s+/g, '');
    const order = R.decodeOrder(code);
    const out = $('adminOut');
    if (!order) { out.innerHTML = '<p style="color:var(--hwa)">신청 코드를 읽을 수 없습니다. 고객이 보낸 코드 전체를 붙여넣었는지 확인해 주세요.</p>'; return; }
    let key;
    try { key = API ? (await api('/issue', { code, pin: adminPin })).key : await R.unlockKey(code); }
    catch (e) { out.innerHTML = `<p style="color:var(--hwa)">${R.esc(e.message)}</p>`; return; }
    const base = siteBase();
    const link = `${base}#${code}.${key}`;
    const p = x => `${R.esc(x.name)} · ${R.esc(x.date)} ${x.time ? R.esc(x.time) : '(시각 모름)'}`;
    const msg = `안녕하세요, 궁합코어입니다. 입금 확인되었습니다.\n${order.A.name}님 × ${order.B.name}님 (${RELS[order.rel].label}) 상세 궁합 리포트를 보내 드립니다.\n${link}\n링크는 기간 제한 없이 다시 열어보실 수 있어요. 1:1 상담이 필요하시면 언제든 말씀해 주세요.`;
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


  /* ---------- 1:1 상담 신청 (FormSubmit → 운영자 이메일) ---------- */
  const personLine = p => `${p.name} · 양력 ${p.date} ${p.time || '(시각 모름)'}`;
  function openConsult() {
    const panel = $('consultPanel');
    panel.hidden = false;
    $('cPair').textContent = currentPair ? `함께 보낼 궁합 정보: ${personLine(currentPair.A)} / ${personLine(currentPair.B)}` : '두 사람의 생년월일을 먼저 넣고 궁합을 보시면, 그 정보도 함께 전달됩니다.';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => $('cName').focus({ preventScroll: true }), 400);
  }
  document.querySelectorAll('.open-consult').forEach(b => b.addEventListener('click', openConsult));

  $('consultForm').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('cError');
    const name = $('cName').value.trim(), phone = $('cPhone').value.trim();
    const digits = phone.replace(/\D/g, '');
    if (!name) { err.textContent = '이름을 넣어 주세요.'; $('cName').focus(); return; }
    if (digits.length < 9 || digits.length > 12) { err.textContent = '연락받을 휴대폰 번호를 정확히 넣어 주세요.'; $('cPhone').focus(); return; }
    if (!$('cAgree').checked) { err.textContent = '개인정보 수집·이용에 동의해 주셔야 연락드릴 수 있어요.'; return; }
    if ($('cHoney').value) return; // 자동 스팸
    err.textContent = '';
    const btn = $('cSubmit'); btn.disabled = true; btn.textContent = '보내는 중…';
    const body = {
      _subject: `[궁합코어] 1:1 상담 신청 — ${name}`,
      _template: 'table',
      _captcha: 'false',
      '이름': name,
      '연락처': phone,
      '상담 방식': $('cWay').value,
      '연락 가능 시간': $('cWhen').value.trim() || '-',
      '궁금한 점': $('cMsg').value.trim() || '-',
      '관계': currentPair ? RELS[currentPair.rel || 'love'].label : RELS[currentRel].label,
      '첫 번째 사람': currentPair ? personLine(currentPair.A) : '-',
      '두 번째 사람': currentPair ? personLine(currentPair.B) : '-',
      '상세 리포트 구매': currentPair && currentPair.paid ? '예 (리포트 링크에서 신청)' : '아니오/확인 필요',
      '신청 시각': new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    };
    const sendMail = async () => {
      const res = await fetch(`https://formsubmit.co/ajax/${CFG.consultEmail}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || String(data.success) === 'false') throw new Error(data.message || res.status);
    };
    const sendSms = () => api('/consult', { name, phone, way: $('cWay').value, when: $('cWhen').value.trim(), rel: body['관계'] });
    try {
      const results = await Promise.allSettled(API ? [sendMail(), sendSms()] : [sendMail()]);
      if (!results.some(r => r.status === 'fulfilled')) throw new Error('send');
      $('consultForm').hidden = true; $('cDone').hidden = false; $('cDonePhone').textContent = phone;
    } catch (ex) {
      err.innerHTML = '신청을 보내지 못했습니다. 잠시 후 다시 눌러 주시거나, <a href="' + R.esc(CFG.kakaoUrl) + '" target="_blank" rel="noopener">카카오톡</a>으로 이름과 연락처를 남겨 주세요.';
      btn.disabled = false; btn.textContent = '상담 신청 보내기';
    }
  });

  /* ---------- 약관 ---------- */
  const POLICY = {
    terms: `<h4>이용약관 및 환불 규정</h4>
      <ol>
        <li>궁합코어는 두 사람의 생년월일시를 명리학 이론으로 풀이한 참고용 해설을 제공합니다. 결과는 관계의 성패나 미래를 보장하지 않으며, 중요한 결정은 이용자 본인의 판단에 따릅니다.</li>
        <li>기본 궁합 결과는 무료입니다. 상세 리포트(${won(CFG.reportPrice)})와 1:1 상담(${won(CFG.consultPrice)})은 유료입니다.</li>
        <li>상세 리포트는 카드·간편결제 완료 즉시, 또는 계좌이체 입금 확인 후 개인 링크로 제공되는 디지털 콘텐츠입니다. 리포트를 받기 전(계좌이체 후 링크 발송 전)에는 전액 환불됩니다. 리포트가 제공된 뒤에는 전자상거래법 제17조 제2항에 따라 청약철회가 제한되며, 이 사실은 결제 전에 안내하고 동의를 받습니다. 무료 결과로 내용 일부를 미리 확인할 수 있습니다.</li>
        <li>이용자의 입력 오류로 리포트가 잘못 만들어진 경우 1회 무료로 다시 만들어 드립니다. 결제는 되었는데 리포트가 열리지 않은 경우 확인 즉시 열어 드리거나 전액 환불합니다.</li>
        <li>제공 방법: 상세 리포트는 웹 페이지로 즉시 제공되며 실물 배송은 없습니다. 1:1 상담은 신청 후 7일 이내에 일정을 정해 전화·카카오톡·대면으로 진행합니다.</li>
        <li>1:1 상담은 상담일 하루 전까지 취소하면 전액 환불, 당일 취소는 50% 환불됩니다.</li>
        <li>리포트 링크는 구매자 본인만 사용해야 하며, 무단 배포·판매를 금지합니다.</li>
      </ol>`,
    privacy: `<h4>개인정보 처리방침</h4>
      <ul>
        <li>무료 궁합 계산은 이용자 기기 안에서만 이뤄지며, 입력한 이름·생년월일시는 서버로 전송되거나 저장되지 않습니다.</li>
        <li>상세 리포트를 신청하면 신청 코드(두 사람의 이름 또는 별명, 생년월일시)와 입금자명을 카카오톡으로 받습니다. 이는 리포트 제작과 발송, 고객 문의 응대에만 사용합니다.</li>
        <li>카드·간편결제는 토스페이먼츠가 처리하며, 궁합코어는 카드번호 등 결제 정보를 받거나 저장하지 않습니다. 결제 확인을 위해 주문번호·결제 금액·신청 코드를 결제 기록으로 보관합니다.</li>
        <li>1:1 상담을 신청하면 이름, 휴대폰 번호, 원하는 상담 방식·시간, 두 사람의 생년월일시를 받아 상담 연락에만 사용하며, 상담 종료 후 1년이 지나면 파기합니다. 신청 내용은 이메일 전송 대행 서비스(FormSubmit)를 거쳐 운영자 이메일로, 이름·연락처는 문자 발송 대행 서비스(솔라피)를 거쳐 운영자 휴대폰으로 전달됩니다.</li>
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
    const q = new URLSearchParams(location.search);
    if (q.get('pay') === 'ok' || q.get('pay') === 'fail') return handlePayReturn(q);
    const h = decodeURIComponent((location.hash || '').slice(1));
    if (h === 'admin') return showAdmin();
    if (h === 'terms' || h === 'privacy') { showSample(); return showPolicy(h); }
    if (h && h.includes('.') && h.length > 20) return showReport(h);
    // #boss, #ceo 처럼 관계 이름을 붙인 주소로 들어오면 그 관계를 골라 둔 채 시작 (인스타·블로그 링크용)
    if (RELS[h]) setRel(h);
    showSample();
  }
  function showSample() {
    const rel = currentRel === 'love' ? 'boss' : currentRel;
    showFree({ name: '나', date: '1992-05-14', time: '07:30' }, { name: RELS[rel].b === '상대' ? '김팀장' : RELS[rel].b, date: '1983-09-21', time: '' }, true, rel);
  }
  route();
  // 저장해 둔 리포트 링크(#…)를 같은 창에서 누른 경우 다시 읽기
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h.includes('.') && h.length > 20) location.reload(); });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
