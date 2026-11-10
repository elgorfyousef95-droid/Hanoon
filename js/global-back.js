
(function () {
  "use strict";

  // الاحتفاظ بمسار الصفحة السابقة داخل الموقع
  const currentPage = location.pathname + location.search;

  let previousPage = "";

  try {
    previousPage = sessionStorage.getItem("hanoon_previous_page") || "";
    sessionStorage.setItem("hanoon_previous_page", currentPage);
  } catch (error) {}

  // الرجوع التلقائي عند الضغط على زر الرجوع في الهاتف
  window.addEventListener("pageshow", function () {
    if (!history.state || !history.state.hanoonPage) {
      history.replaceState(
        { hanoonPage: true },
        "",
        location.href
      );
    }
  });

})();
