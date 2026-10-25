/* ============================================================
   gunghap-core.js — 궁합코어 계산 엔진 (순수 로직, DOM 의존 없음)
   -------------------------------------------------------------
   사주코어(saju-core.js) 엔진을 그대로 재사용해 두 사람의 사주를
   비교하는 궁합 전용 함수들을 추가한 모듈입니다.
   ============================================================ */

(function (root) {
  const SC = root.SajuCore;
  if (!SC) {
    throw new Error('gunghap-core.js는 saju-core.js를 먼저 로드해야 합니다.');
  }
  const { STEMS, BRANCHES, STEM_ELEM, BRANCH_ELEM, GENERATES, CONTROLS,
          tenGod10, twelveStage, computeYongsin } = SC;

  function hasBatchim(str) {
    if (!str) return false;
    const code = str.charCodeAt(str.length - 1);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return (code - 0xAC00) % 28 !== 0;
  }
  function josa(name, withBatchim, withoutBatchim) {
    return hasBatchim(name) ? withBatchim : withoutBatchim;
  }
  function eunNeun(name){ return josa(name, '은', '는'); }
  function iGa(name){ return josa(name, '이', '가'); }
  function eulReul(name){ return josa(name, '을', '를'); }
  function euroRo(name){ return josa(name, '으로', '로'); }

  function pairRelation(elemA, elemB) {
    if (elemA === elemB) return 'bihwa';
    if (GENERATES[elemA] === elemB) return 'aGenB';
    if (GENERATES[elemB] === elemA) return 'bGenA';
    if (CONTROLS[elemA] === elemB) return 'aCtrlB';
    if (CONTROLS[elemB] === elemA) return 'bCtrlA';
    return 'bihwa';
  }
  const CHUNG_PAIRS = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];
  function isChung(b1, b2) {
    return CHUNG_PAIRS.some(p => (p[0]===b1 && p[1]===b2) || (p[0]===b2 && p[1]===b1));
  }
  const YUKHAP_PAIRS = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];
  function isYukhap(b1, b2) {
    return YUKHAP_PAIRS.some(p => (p[0]===b1 && p[1]===b2) || (p[0]===b2 && p[1]===b1));
  }
  const SAMHAP_GROUPS = [[11,3,7],[2,6,10],[5,9,1],[8,0,4]];
  function samhapGroupOf(b) { return SAMHAP_GROUPS.find(g => g.includes(b)); }
  function isSamhapKin(b1, b2) {
    const g = samhapGroupOf(b1);
    return !!g && g.includes(b2) && b1 !== b2;
  }

  const CHEONGAN_TEXT = {
    bihwa:  (a,b,eA) => `두 사람의 일간이 똑같은 ${eA} 기운입니다. 성향과 생활 리듬이 비슷해 대화가 잘 통하고 편안하지만, 같은 방식으로만 부딪히면 서로 양보 없이 평행선을 달리기 쉬운 조합입니다.`,
    aGenB:  (a,b,eA,eB) => `${a}의 ${eA} 기운이 ${b}의 ${eB} 기운을 북돋아 주는 관계입니다. ${a}${iGa(a)} 먼저 챙기고 베푸는 쪽에 서기 쉬우며, ${b}${eunNeun(b)} 그 기운을 받아 한결 편안해지는 흐름입니다.`,
    bGenA:  (a,b,eA,eB) => `${b}의 ${eB} 기운이 ${a}의 ${eA} 기운을 북돋아 주는 관계입니다. ${a} 입장에서는 ${b} 곁에 있을 때 힘을 얻고 지지받는 느낌을 받기 쉬운 조합입니다.`,
    aCtrlB: (a,b,eA,eB) => `${a}의 ${eA} 기운이 ${b}의 ${eB} 기운을 제어하는 관계입니다. ${a}${iGa(a)} 주도권을 쥐기 쉬운 구도라, ${b}${iGa(b)} 답답함을 느끼지 않도록 서로 속도를 맞추는 노력이 필요합니다.`,
    bCtrlA: (a,b,eA,eB) => `${b}의 ${eB} 기운이 ${a}의 ${eA} 기운을 제어하는 관계입니다. ${b}${iGa(b)} 주도권을 쥐기 쉬운 구도라, ${a}${iGa(a)} 눌리는 느낌을 받지 않도록 거리 조절이 필요합니다.`,
  };
  // 대칭화(2026-10-25): A·B 입력 순서를 바꿔도 같은 등급이 나오도록 상생은 방향과 관계없이 '우호'로 통일
  const TIER_BY_CAT = { bihwa:'중립', aGenB:'우호', bGenA:'우호', aCtrlB:'주의', bCtrlA:'주의' };

  function axisCheongan(sajuA, sajuB, nameA, nameB) {
    const eA = STEM_ELEM[sajuA.day.stem], eB = STEM_ELEM[sajuB.day.stem];
    const cat = pairRelation(eA, eB);
    return {
      key: 'cheongan', title: '① 천간궁합 (일간 대 일간)',
      stemsText: `${SC.STEMS[sajuA.day.stem]}(${eA}) × ${SC.STEMS[sajuB.day.stem]}(${eB})`,
      tier: TIER_BY_CAT[cat],
      text: CHEONGAN_TEXT[cat](nameA, nameB, eA, eB),
    };
  }

  const SIBSIN_PARTNER_TEXT = {
    '비견': '나와 비슷한 눈높이에서 어깨를 나란히 하는 동료 같은 상대입니다. 서로 존중하면 편안하지만, 자존심 싸움으로 번지면 쉽게 물러서지 않는 조합입니다.',
    '겁재': '서로 자극을 주고받으며 경쟁심을 불러일으키는 상대입니다. 함께 있으면 추진력은 커지지만, 주도권이나 자원을 둘러싼 신경전에 주의가 필요합니다.',
    '식신': '내가 편안하게 나 자신을 표현하도록 여유를 주는 상대입니다. 정서적으로 안정감을 느끼기 쉬운 조합입니다.',
    '상관': '개성 있고 자극적인 매력으로 다가오는 상대입니다. 설렘과 재미는 크지만, 틀에 박히지 않은 만큼 마찰도 함께 따를 수 있습니다.',
    '정재': '성실하고 꾸준하게 나를 챙겨주는 상대입니다. 생활을 안정적으로 함께 꾸려가기에 좋은 조합입니다.',
    '편재': '활동적이고 스케일이 큰 매력으로 다가오는 상대입니다. 함께 있으면 기회와 활동 반경이 넓어지지만, 관계를 한 곳에 묶어두기보다 유동적으로 바라보는 상대이기도 합니다.',
    '정관': '책임감 있게 나를 이끌어 주는 상대입니다. 신뢰는 쌓이지만, 규칙과 체면을 중시하는 만큼 자유를 제약받는다고 느낄 수도 있습니다.',
    '편관': '강렬한 존재감으로 나를 끌어당기는 상대입니다. 긴장감 있는 몰입은 크지만, 통제받는다는 인상을 주지 않도록 주의가 필요한 조합입니다.',
    '정인': '나를 보살피고 지지해 주는 상대입니다. 편안하고 안정적인 울타리가 되어주는 조합입니다.',
    '편인': '독특한 시선으로 나를 자극하는 상대입니다. 깊이 있는 대화가 가능하지만, 예측하기 어려운 면이 거리감을 만들 수도 있습니다.',
  };
  const SIBSIN_TIER = {
    '비견':'중립', '겁재':'주의', '식신':'우호', '상관':'중립', '정재':'우호',
    '편재':'우호', '정관':'중립', '편관':'주의', '정인':'우호', '편인':'중립',
  };

  function sibsinOf(mySajuDayStem, targetElem, targetEven) {
    return tenGod10(mySajuDayStem, targetElem, targetEven);
  }

  function axisSibsinIlgan(sajuA, sajuB, nameA, nameB) {
    const godAB = sibsinOf(sajuA.day.stem, STEM_ELEM[sajuB.day.stem], sajuB.day.stem % 2 === 0);
    const godBA = sibsinOf(sajuB.day.stem, STEM_ELEM[sajuA.day.stem], sajuA.day.stem % 2 === 0);
    return {
      key: 'sibsinIlgan', title: '② 십신궁합 (일간 기준 — 배우자궁)',
      text: `${nameB}${eunNeun(nameB)} ${nameA}에게 '${godAB}'에 해당합니다. ${SIBSIN_PARTNER_TEXT[godAB]}\n\n`
          + `반대로 ${nameA}${eunNeun(nameA)} ${nameB}에게 '${godBA}'에 해당합니다. ${SIBSIN_PARTNER_TEXT[godBA]}`,
      detail: [
        { who: `${nameB} → ${nameA}`, god: godAB, tier: SIBSIN_TIER[godAB] },
        { who: `${nameA} → ${nameB}`, god: godBA, tier: SIBSIN_TIER[godBA] },
      ],
      tier: avgTier([SIBSIN_TIER[godAB], SIBSIN_TIER[godBA]]),
    };
  }

  function axisSibsinYeongan(sajuA, sajuB, nameA, nameB) {
    const godAB = sibsinOf(sajuA.day.stem, STEM_ELEM[sajuB.year.stem], sajuB.year.stem % 2 === 0);
    const godBA = sibsinOf(sajuB.day.stem, STEM_ELEM[sajuA.year.stem], sajuA.year.stem % 2 === 0);
    return {
      key: 'sibsinYeongan', title: '⑥ 십신궁합 (연간 기준 — 사회적 인연)',
      note: '일간 기준(②)이 부부·연인으로서의 친밀한 배우자궁 궁합이라면, 연간 기준은 가족·지인에게 비치는 사회적 인연의 결을 보는 보조 지표입니다.',
      text: `${nameB}의 연간은 ${nameA}에게 '${godAB}'${euroRo(godAB)} 비칩니다. ${SIBSIN_PARTNER_TEXT[godAB]}\n\n`
          + `${nameA}의 연간은 ${nameB}에게 '${godBA}'${euroRo(godBA)} 비칩니다. ${SIBSIN_PARTNER_TEXT[godBA]}`,
      detail: [
        { who: `${nameB} → ${nameA}`, god: godAB, tier: SIBSIN_TIER[godAB] },
        { who: `${nameA} → ${nameB}`, god: godBA, tier: SIBSIN_TIER[godBA] },
      ],
      tier: avgTier([SIBSIN_TIER[godAB], SIBSIN_TIER[godBA]]),
    };
  }

  const COMPLEMENT_TEXT = {
    bihwa:  (who,weak) => `${who}의 부족한 ${weak} 기운과 상대의 기운이 같아, 서로의 약점을 채워주기보다는 같은 쪽으로 함께 기우는 조합입니다.`,
    aGenB:  (who,weak) => `${who}의 부족한 ${weak} 기운이 오히려 상대를 북돋아 주는 방향이라, ${who}의 약한 기운이 상대에게 소모되기 쉬운 구도입니다.`,
    bGenA:  (who,weak) => `상대의 기운이 ${who}에게 부족한 ${weak} 기운을 채워주는 관계입니다. 서로가 서로의 빈 자리를 메워주는 보완적인 궁합입니다.`,
    aCtrlB: (who,weak) => `${who}의 부족한 ${weak} 기운이 상대를 억누르는 방향이라, 드물지만 서로 영향이 크지 않은 조합입니다.`,
    bCtrlA: (who,weak) => `상대의 기운이 ${who}의 안 그래도 부족한 ${weak} 기운을 더 억누르는 관계입니다. ${who}${iGa(who)} 상대적으로 위축되지 않도록 주의가 필요한 조합입니다.`,
  };
  const COMPLEMENT_TIER = { bihwa:'중립', aGenB:'주의', bGenA:'우호', aCtrlB:'중립', bCtrlA:'주의' };

  function axisComplement(sajuA, sajuB, nameA, nameB, ysA, ysB) {
    const weakA = ysA.weakest, weakB = ysB.weakest;
    const dayElemA = STEM_ELEM[sajuA.day.stem], dayElemB = STEM_ELEM[sajuB.day.stem];
    const catForA = pairRelation(weakA, dayElemB);
    const catForB = pairRelation(weakB, dayElemA);
    return {
      key: 'complement', title: '③ 오행보완 (서로의 부족한 기운을 채워주는가)',
      text: `${COMPLEMENT_TEXT[catForA](nameA, weakA)}\n\n${COMPLEMENT_TEXT[catForB](nameB, weakB)}`,
      detail: [
        { who: nameA, weakest: weakA, tier: COMPLEMENT_TIER[catForA] },
        { who: nameB, weakest: weakB, tier: COMPLEMENT_TIER[catForB] },
      ],
      tier: avgTier([COMPLEMENT_TIER[catForA], COMPLEMENT_TIER[catForB]]),
    };
  }

  function effectOf(dayElemPartner, ys) {
    if (dayElemPartner === ys.yongsin) return { cat:'yongsin', tier:'우호', note:'용신(가장 필요한 기운)' };
    if (dayElemPartner === ys.huisin)  return { cat:'huisin',  tier:'우호', note:'희신(용신을 돕는 기운)' };
    if (dayElemPartner === ys.gisin)   return { cat:'gisin',   tier:'주의', note:'병신(용신을 해치는 기운)' };
    if (dayElemPartner === ys.gusin)   return { cat:'gusin',   tier:'중립', note:'약신(병신을 막아주는 완충 기운)' };
    return { cat:'none', tier:'중립', note:'4신 체계 밖의 기운(비겁 등)' };
  }
  function axisEffect(sajuA, sajuB, nameA, nameB, ysA, ysB) {
    const dayElemA = STEM_ELEM[sajuA.day.stem], dayElemB = STEM_ELEM[sajuB.day.stem];
    const effOnA = effectOf(dayElemB, ysA);
    const effOnB = effectOf(dayElemA, ysB);
    const phrase = (who, other, elem, eff) => {
      if (eff.cat==='yongsin') return `${other}의 ${elem} 기운은 ${who}에게 ${eff.note}에 해당해, 가장 크게 도움이 되는 궁합입니다.`;
      if (eff.cat==='huisin')  return `${other}의 ${elem} 기운은 ${who}에게 ${eff.note}에 해당해, 전반적으로 힘이 되는 궁합입니다.`;
      if (eff.cat==='gisin')   return `${other}의 ${elem} 기운은 ${who}에게 ${eff.note}에 해당해, 부딪히거나 지치는 상황이 생기지 않도록 주의가 필요한 궁합입니다.`;
      if (eff.cat==='gusin')   return `${other}의 ${elem} 기운은 ${who}에게 ${eff.note}에 해당해, 큰 해는 아니지만 뚜렷한 도움도 아닌 기운입니다.`;
      return `${other}의 ${elem} 기운은 ${who}의 용신 체계와 직접 관련은 없는 기운입니다.`;
    };
    return {
      key: 'effect', title: '④ 오행영향 (상대가 나의 용신·병신에 해당하는가)',
      text: `${phrase(nameA, nameB, dayElemB, effOnA)}\n\n${phrase(nameB, nameA, dayElemA, effOnB)}`,
      detail: [
        { who: nameA, from: nameB, elem: dayElemB, ...effOnA },
        { who: nameB, from: nameA, elem: dayElemA, ...effOnB },
      ],
      tier: avgTier([effOnA.tier, effOnB.tier]),
    };
  }

  const STAGE_PARTNER_TEXT = {
    '장생': '상대가 나에게 새로운 가능성과 생기를 불어넣어 주는 기운입니다.',
    '목욕': '설레고 자극적이지만, 아직은 서로를 탐색하는 불안정한 기운입니다.',
    '관대': '예의를 갖추고 격식 있게 서로를 존중하며 관계를 다져가는 기운입니다.',
    '건록': '상대가 나에게 든든하고 안정적인 힘이 되어주는 기운입니다.',
    '제왕': '상대의 존재감이 강하게 다가와, 내가 영향을 크게 받는 기운입니다.',
    '쇠':   '편안하고 익숙하지만, 열정보다는 안정이 앞서는 기운입니다.',
    '병':   '상대로 인해 마음이 흔들리거나 쉽게 지치기 쉬운 기운입니다.',
    '사':   '관계를 이끄는 추진력이 약해지고, 거리감이 느껴지는 기운입니다.',
    '묘':   '서로에게 무던해지며 자극이 줄어드는 기운입니다.',
    '절':   '인연의 연결고리가 느슨하게 느껴져, 거리 조율이 필요한 기운입니다.',
    '태':   '관계가 이제 막 싹트는 듯 조심스럽지만, 가능성이 열려있는 기운입니다.',
    '양':   '상대의 보살핌을 받으며 편안하게 기대고 싶어지는 기운입니다.',
  };
  const STAGE_TIER2 = { '강':'우호', '보통':'중립', '약':'중립' };

  function axisTwelveStage(sajuA, sajuB, nameA, nameB) {
    const stageAonB = twelveStage(sajuA.day.stem, sajuB.day.branch);
    const stageBonA = twelveStage(sajuB.day.stem, sajuA.day.branch);
    const tierAonB = STAGE_TIER2[stageTierOf(stageAonB)];
    const tierBonA = STAGE_TIER2[stageTierOf(stageBonA)];
    return {
      key: 'twelveStage', title: '⑤ 12운성궁합 (상대가 나에게 어떤 생애 기운으로 다가오는가)',
      text: `${nameB}${eunNeun(nameB)} ${nameA}에게 '${stageAonB}'의 기운으로 다가옵니다. ${STAGE_PARTNER_TEXT[stageAonB]}\n\n`
          + `${nameA}${eunNeun(nameA)} ${nameB}에게 '${stageBonA}'의 기운으로 다가옵니다. ${STAGE_PARTNER_TEXT[stageBonA]}`,
      detail: [
        { who: `${nameB} → ${nameA}`, stage: stageAonB, tier: tierAonB },
        { who: `${nameA} → ${nameB}`, stage: stageBonA, tier: tierBonA },
      ],
      tier: avgTier([tierAonB, tierBonA]),
    };
  }
  const STAGE_TIER_MAP = {
    '장생':'강','관대':'강','건록':'강','제왕':'강',
    '목욕':'보통','쇠':'보통','병':'보통',
    '사':'약','묘':'약','절':'약','태':'약','양':'약',
  };
  function stageTierOf(stage) { return STAGE_TIER_MAP[stage]; }

  const NAPEUM_NAMES = [
    '해중금','해중금','노중화','노중화','대림목','대림목','노방토','노방토','검봉금','검봉금',
    '산두화','산두화','간하수','간하수','성두토','성두토','백랍금','백랍금','양류목','양류목',
    '천중수','천중수','옥상토','옥상토','벽력화','벽력화','송백목','송백목','장류수','장류수',
    '사중금','사중금','산하화','산하화','평지목','평지목','벽상토','벽상토','금박금','금박금',
    '복등화','복등화','천하수','천하수','대역토','대역토','차천금','차천금','상자목','상자목',
    '대계수','대계수','사중토','사중토','천상화','천상화','석류목','석류목','대해수','대해수',
  ];
  const NAPEUM_ELEM = {
    '해중금':'금','노중화':'화','대림목':'목','노방토':'토','검봉금':'금',
    '산두화':'화','간하수':'수','성두토':'토','백랍금':'금','양류목':'목',
    '천중수':'수','옥상토':'토','벽력화':'화','송백목':'목','장류수':'수',
    '사중금':'금','산하화':'화','평지목':'목','벽상토':'토','금박금':'금',
    '복등화':'화','천하수':'수','대역토':'토','차천금':'금','상자목':'목',
    '대계수':'수','사중토':'토','천상화':'화','석류목':'목','대해수':'수',
  };
  const NAPEUM_TEXT = {
    bihwa:  (a,b,nA,nB) => `두 사람의 납음오행이 똑같은 ${nA}(${NAPEUM_ELEM[nA]})·${nB}(${NAPEUM_ELEM[nB]}) 계열입니다. 타고난 기질의 '본바탕'이 비슷해 깊은 곳에서 통하지만, 변화가 적어 자극이 부족하게 느껴질 수 있습니다.`,
    aGenB:  (a,b,nA,nB) => `${a}의 납음오행(${nA})이 ${b}의 납음오행(${nB})을 북돋아 주는 흐름입니다. 겉으로 드러나지 않는 타고난 기운에서 ${a}${iGa(a)} ${b}${eulReul(b)} 은은하게 밀어주는 조합입니다.`,
    bGenA:  (a,b,nA,nB) => `${b}의 납음오행(${nB})이 ${a}의 납음오행(${nA})을 북돋아 주는 흐름입니다. 타고난 기운의 바탕에서 ${a}${iGa(a)} ${b}에게 은은한 지지를 받는 조합입니다.`,
    aCtrlB: (a,b,nA,nB) => `${a}의 납음오행(${nA})이 ${b}의 납음오행(${nB})을 제어하는 흐름입니다. 겉으로 잘 드러나지 않지만, 타고난 기질 차원에서 ${a} 쪽의 영향력이 더 강하게 작용하는 조합입니다.`,
    bCtrlA: (a,b,nA,nB) => `${b}의 납음오행(${nB})이 ${a}의 납음오행(${nA})을 제어하는 흐름입니다. 겉으로 잘 드러나지 않지만, 타고난 기질 차원에서 ${b} 쪽의 영향력이 더 강하게 작용하는 조합입니다.`,
  };
  function axisNapeum(sajuA, sajuB, nameA, nameB) {
    const gzIdxA = SC.findGZIndex(sajuA.day.stem, sajuA.day.branch);
    const gzIdxB = SC.findGZIndex(sajuB.day.stem, sajuB.day.branch);
    const napA = NAPEUM_NAMES[gzIdxA], napB = NAPEUM_NAMES[gzIdxB];
    const elemA = NAPEUM_ELEM[napA], elemB = NAPEUM_ELEM[napB];
    const cat = pairRelation(elemA, elemB);
    return {
      key: 'napeum', title: '보조① 납음오행궁합 (納音五行 — 타고난 기질의 바탕)',
      napeumText: `${nameA}: ${napA}(${elemA})  ·  ${nameB}: ${napB}(${elemB})`,
      text: NAPEUM_TEXT[cat](nameA, nameB, napA, napB),
      tier: TIER_BY_CAT[cat],
    };
  }

  function axisDayPillar(sajuA, sajuB, nameA, nameB) {
    const eA = STEM_ELEM[sajuA.day.stem], eB = STEM_ELEM[sajuB.day.stem];
    const stemCat = pairRelation(eA, eB);
    const bA = sajuA.day.branch, bB = sajuB.day.branch;
    let branchNote, branchTier;
    if (isChung(bA, bB)) {
      branchNote = `일지(${BRANCHES[bA]} - ${BRANCHES[bB]})끼리 충(沖)하는 관계입니다. 서로 다른 생활 패턴·가치관이 부딪혀 자극이 크고, 의견 차이가 잦을 수 있습니다.`;
      branchTier = '주의';
    } else if (isYukhap(bA, bB)) {
      branchNote = `일지(${BRANCHES[bA]} - ${BRANCHES[bB]})끼리 육합(六合)하는 관계입니다. 자연스럽게 서로에게 끌리고 생활 리듬이 잘 맞아떨어지는 조합입니다.`;
      branchTier = '우호';
    } else if (isSamhapKin(bA, bB)) {
      branchNote = `일지(${BRANCHES[bA]} - ${BRANCHES[bB]})가 삼합(三合)으로 기운이 통하는 그룹입니다. 지향하는 방향이 비슷해 함께 있을 때 시너지가 나는 조합입니다.`;
      branchTier = '우호';
    } else {
      branchNote = `일지(${BRANCHES[bA]} - ${BRANCHES[bB]}) 사이에 특별한 합이나 충은 없습니다. 극적인 끌림이나 충돌보다는 무난하게 흘러가는 조합입니다.`;
      branchTier = '중립';
    }
    return {
      key: 'dayPillar', title: '보조② 일주궁합 (日柱 — 천간·지지를 함께 보는 전통 기법)',
      stemsText: `${STEMS[sajuA.day.stem]}${BRANCHES[bA]} × ${STEMS[sajuB.day.stem]}${BRANCHES[bB]}`,
      text: `천간 측면에서는 ${CHEONGAN_TEXT[stemCat](nameA, nameB, eA, eB)}\n\n지지 측면에서는 ${branchNote}`,
      tier: avgTier([TIER_BY_CAT[stemCat], branchTier]),
    };
  }

  function avgTier(tiers) {
    const score = { '우호':1, '중립':0, '주의':-1 };
    const sum = tiers.reduce((s,t)=> s + (score[t]||0), 0);
    const avg = sum / tiers.length;
    if (avg > 0.25) return '우호';
    if (avg < -0.25) return '주의';
    return '중립';
  }

  function analyzeGunghap(sajuA, sajuB, opts) {
    opts = opts || {};
    const nameA = opts.nameA || '사람 A';
    const nameB = opts.nameB || '사람 B';
    const ysA = computeYongsin(sajuA, !!opts.hasTimeA);
    const ysB = computeYongsin(sajuB, !!opts.hasTimeB);

    const axes = [
      axisCheongan(sajuA, sajuB, nameA, nameB),
      axisSibsinIlgan(sajuA, sajuB, nameA, nameB),
      axisComplement(sajuA, sajuB, nameA, nameB, ysA, ysB),
      axisEffect(sajuA, sajuB, nameA, nameB, ysA, ysB),
      axisTwelveStage(sajuA, sajuB, nameA, nameB),
      axisSibsinYeongan(sajuA, sajuB, nameA, nameB),
    ];
    const auxAxes = [
      axisNapeum(sajuA, sajuB, nameA, nameB),
      axisDayPillar(sajuA, sajuB, nameA, nameB),
    ];

    const allTiers = axes.concat(auxAxes).map(a => a.tier);
    const tally = { '우호':0, '중립':0, '주의':0 };
    allTiers.forEach(t => { tally[t] = (tally[t]||0) + 1; });

    let overallNote;
    if (tally['우호'] >= tally['주의'] + 2) {
      overallNote = `${axes.length + auxAxes.length}개 축 가운데 ${tally['우호']}개 축에서 조화로운 기운이 나타나, 전반적으로 편안하게 맞춰갈 수 있는 궁합입니다.`;
    } else if (tally['주의'] >= tally['우호'] + 2) {
      overallNote = `${axes.length + auxAxes.length}개 축 가운데 ${tally['주의']}개 축에서 주의 신호가 나타나, 서로 맞춰가려는 의식적인 노력이 필요한 궁합입니다.`;
    } else {
      overallNote = `${axes.length + auxAxes.length}개 축에 걸쳐 우호(${tally['우호']})·중립(${tally['중립']})·주의(${tally['주의']}) 기운이 고르게 섞여 있어, 좋은 면과 신경 써야 할 면이 함께 있는 균형잡힌 궁합입니다.`;
    }

    return {
      nameA, nameB,
      sajuA: { stem: STEMS[sajuA.day.stem], branch: BRANCHES[sajuA.day.branch], elem: STEM_ELEM[sajuA.day.stem] },
      sajuB: { stem: STEMS[sajuB.day.stem], branch: BRANCHES[sajuB.day.branch], elem: STEM_ELEM[sajuB.day.stem] },
      axes, auxAxes, tally, overallNote,
    };
  }

  const GunghapCore = {
    pairRelation, isChung, isYukhap, isSamhapKin,
    axisCheongan, axisSibsinIlgan, axisSibsinYeongan,
    axisComplement, axisEffect, axisTwelveStage,
    axisNapeum, axisDayPillar,
    NAPEUM_NAMES, NAPEUM_ELEM,
    analyzeGunghap,
  };
  root.GunghapCore = GunghapCore;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GunghapCore;
  }
})(typeof window !== 'undefined' ? window : globalThis);
