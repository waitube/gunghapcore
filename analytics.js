/* analytics.js — 방문 통계 (config.js 의 gaId 가 있을 때만 동작)
   단계별로 보는 이벤트:
   result_view(무료 결과 확인) → unlock_click(상세 리포트 열기 클릭) → pay_click(결제하기) → pay_window(결제창 열림) → purchase(결제 완료)
   그 밖에 share_click(공유), sample_open(예시 리포트), consult_submit(상담 신청) */
(function(){
  var id = (window.GUNGHAP_CONFIG || {}).gaId;
  window.gcTrack = function(){};
  if(!id) return;
  var s = document.createElement('script'); s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', id);
  window.gcTrack = function(name, params){ try{ gtag('event', name, params || {}); }catch(e){} };
})();
