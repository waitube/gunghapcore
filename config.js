/* ============================================================
   config.js — 궁합코어 운영 설정 (대표님이 직접 고치는 파일은 이것 하나)
   ------------------------------------------------------------
   · 괄호 안 '(입력 필요)' 항목을 실제 정보로 바꿔 주세요.
   · 사업자 정보는 전자상거래법상 사이트 하단 표기 의무 항목입니다.
   · unlockSalt 는 리포트 열람키를 만드는 비밀 문구입니다. 아무도 모르는
     문장으로 바꾼 뒤에는 다시 바꾸지 마세요(바꾸면 이미 보낸 링크가 열리지 않습니다).
   ============================================================ */
window.GUNGHAP_CONFIG = {
  // 사이트 주소 (리포트 링크를 만들 때 앞부분으로 씁니다)
  siteUrl: 'https://waitube.github.io/gunghapcore/',   // 사이트 주소가 바뀌면 여기를 고치세요

  // 가격
  reportPrice: 9900,
  consultPrice: 100000,

  // 신청·상담 창구 (카카오톡)
  kakaoUrl: 'https://open.kakao.com/o/sNZem6Ti',   // 궁합코어 전용 1:1 오픈채팅

  // 결제·알림 서버 주소 (Cloudflare Worker, 예: https://gunghapcore.○○○.workers.dev)
  //  비워 두면 카드 결제 버튼이 숨겨지고, 지금처럼 계좌이체 + 운영자 링크 발급만 씁니다.
  apiBase: 'https://gunghapcore.waitube2.workers.dev',
  // 토스페이먼츠 클라이언트 키 (test_ck_… 또는 live_ck_…). 공개돼도 되는 키입니다.
  //  ※ 시크릿 키(…_sk_…)는 절대 여기에 넣지 마세요. 서버 설정에만 넣습니다.
  tossClientKey: 'test_ck_AQ92ymxN34LvARoLMk7g3ajRKXvd',

  // 1:1 상담 신청을 받을 이메일 (FormSubmit 서비스가 이 주소로 신청 내용을 보내 줍니다.
  //  처음 한 번은 이 주소로 오는 'Activate Form' 메일의 버튼을 눌러야 이후 신청이 도착합니다.)
  consultEmail: 'waitube2@gmail.com',

  // 입금 계좌 (1차 운영: 계좌이체 후 카톡으로 신청)
  bank: {
    name: '농협',
    account: '351-0748-5158-23',
    holder: '서지원',
  },

  // 사업자 정보 (사이트 하단 표기)
  business: {
    name: '와이튜브',
    ceo: '서지원',
    regNo: '478-10-02189',
    mailOrderNo: '제2022-성남분당A-0424호',
    address: '경기도 성남시 분당구 벌말로 33, 201호(야탑동)',   // 사업자등록증과 글자 그대로
    phone: '031-704-3342',
    email: 'waitube2@gmail.com',
  },

  // 리포트 열람키 비밀 문구 — 서버(apiBase)를 쓰기 시작하면 '' 로 비워 두세요.
  //  (서버를 쓰면 비밀 문구는 서버에만 있고, 리포트 링크 확인도 서버가 합니다.)
  unlockSalt: '',

  // 운영자 화면 비밀번호 — 비밀번호 자체가 아니라 암호화한 값만 저장합니다 (주소 끝 #admin 으로 들어감)
  adminPinHash: '171a06069d805ddc0a816d5d3d4a9d36a670ecad720c5837c8ffc4147f47c95a',
};
