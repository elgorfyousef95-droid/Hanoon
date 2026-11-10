
/* =========================================
   HANOON — GLOBAL STYLES
   Main Visual Foundation
========================================= */

/* أساس الصفحة */

body {
  min-height: 100vh;
  overflow-x: hidden;
  background:
    radial-gradient(ellipse at 15% 10%, rgba(140,117,245,.08), transparent 32%),
    radial-gradient(ellipse at 85% 35%, rgba(53,189,176,.06), transparent 30%),
    var(--bg-primary);
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  opacity: .16;
  background-image:
    radial-gradient(rgba(213,179,108,.45) .7px, transparent .7px);
  background-size: 38px 38px;
}

main {
  min-height: 60vh;
}

.container {
  width: min(92%, 1440px);
  margin-inline: auto;
}

/* =========================================
   شاشة البداية
========================================= */

.splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  background:
    radial-gradient(ellipse at center, #202943 0%, #0C1020 65%);
  transition: opacity .7s ease, visibility .7s ease;
}

.splash-screen.is-hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.splash-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.splash-content img {
  width: clamp(100px, 18vw, 160px);
  height: 120px;
  object-fit: contain;
  filter: drop-shadow(0 0 25px rgba(213,179,108,.4));
  animation: logoFloat 3s ease-in-out infinite;
}

.splash-content h1 {
  color: var(--gold-light);
  font-family: Georgia, serif;
  font-size: clamp(2rem, 5vw, 3.5rem);
  letter-spacing: 5px;
}

.splash-content p {
  color: var(--text-secondary);
  font-size: 14px;
}

.splash-spinner {
  width: 38px;
  height: 38px;
  margin-top: 25px;
  border: 2px solid rgba(213,179,108,.15);
  border-top-color: var(--gold);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes logoFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* =========================================
   رأس الموقع
========================================= */

.site-header {
  position: sticky;
  top: 0;
  z-index: 1000;
  min-height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 4%;
  background: rgba(12,16,32,.88);
  border-bottom: 1px solid var(--border-color);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

[data-theme="light"] .site-header {
  background: rgba(247,245,239,.92);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.brand img {
  width: 58px;
  height: 58px;
  object-fit: contain;
}

.brand span {
  display: flex;
  flex-direction: column;
  line-height: 1.5;
}

.brand strong {
  color: var(--gold);
  font-family: Georgia, serif;
  font-size: 22px;
  letter-spacing: 2px;
}

.brand small {
  color: var(--text-muted);
  font-size: 10px;
}

.main-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(12px, 2vw, 28px);
}

.main-navigation a {
  position: relative;
  padding: 10px 0;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  transition: color var(--transition-normal);
}

.main-navigation a:hover,
.main-navigation a.active {
  color: var(--gold);
}

.main-navigation a::after {
  content: "";
  position: absolute;
  bottom: 2px;
  right: 0;
  width: 0;
  height: 2px;
  background: var(--gold);
  transition: width var(--transition-normal);
}

.main-navigation a:hover::after,
.main-navigation a.active::after {
  width: 100%;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-button {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-light);
  border-radius: 13px;
  transition: all var(--transition-normal);
}

.icon-button svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-button:hover {
  color: var(--gold);
  border-color: var(--gold);
  transform: translateY(-2px);
}

.account-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 8px 20px;
  color: #151523;
  background: linear-gradient(135deg, var(--gold-light), var(--gold-dark));
  border-radius: 12px;
  font-size: 13px;
  font-weight: 800;
  transition: transform var(--transition-normal);
}

.account-button:hover {
  transform: translateY(-3px);
}

/* زر القائمة للموبايل */

.menu-toggle {
  display: none;
  width: 42px;
  height: 42px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-tertiary);
}

.menu-toggle span {
  display: block;
  width: 19px;
  height: 2px;
  margin: 4px auto;
  background: var(--gold);
  border-radius: 5px;
}

/* =========================================
   البحث العام
========================================= */

.search-panel {
  position: absolute;
  top: var(--header-height);
  left: 4%;
  z-index: 1100;
  width: min(480px, 92%);
  padding: 22px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0 0 20px 20px;
  box-shadow: var(--shadow-card);
}

.search-panel label {
  display: block;
  margin-bottom: 12px;
  font-weight: 800;
}

.search-field {
  display: flex;
  gap: 8px;
}

.search-field input {
  flex: 1;
  min-width: 0;
  padding: 12px;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.search-field button {
  padding: 10px 20px;
  color: #151523;
  background: var(--gold);
  border: 0;
  border-radius: 10px;
  font-weight: 800;
}

/* =========================================
   الواجهة الرئيسية
========================================= */

.hero-section {
  position: relative;
  min-height: min(760px, calc(100vh - 88px));
  display: flex;
  align-items: center;
  overflow: hidden;
  background: #0C1020;
  isolation: isolate;
}

.hero-background {
  position: absolute;
  inset: 0;
  z-index: -3;
  background:
    linear-gradient(90deg, rgba(12,16,32,.2), rgba(12,16,32,.9)),
    url("../assets/backgrounds/home-hero.png") center/cover no-repeat;
  transform: scale(1.02);
}

.hero-shade {
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    linear-gradient(270deg, rgba(12,16,32,.97) 0%, rgba(12,16,32,.75) 43%, rgba(12,16,32,.12) 100%),
    linear-gradient(0deg, #0C1020 0%, transparent 35%);
}

.hero-inner {
  width: min(92%, 1440px);
  min-height: 620px;
  margin-inline: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  padding-block: 80px;
}

.hero-copy {
  width: min(680px, 65%);
}

.hero-copy .eyebrow {
  margin-bottom: 24px;
}

.hero-copy h1 {
  margin-bottom: 25px;
  color: #FFF4D8;
  line-height: 1.35;
  text-shadow: 0 5px 25px rgba(0,0,0,.3);
}

.hero-copy h1 span {
  display: block;
  color: var(--gold);
}

.hero-copy > p {
  max-width: 600px;
  margin-bottom: 35px;
  color: #D1CCCA;
  font-size: clamp(15px, 1.5vw, 18px);
  line-height: 2.2;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.button {
  min-height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 27px;
  border-radius: 13px;
  font-weight: 800;
  transition: all var(--transition-normal);
}

.button:hover {
  transform: translateY(-4px);
}

.button-gold {
  color: #151523;
  background: linear-gradient(135deg, #F1D99C, #D5B36C, #A77B35);
  box-shadow: var(--shadow-gold);
}

.button-glass {
  color: #FFF0C8;
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(213,179,108,.55);
  backdrop-filter: blur(10px);
}

.hero-motto {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-top: 42px;
  color: #D7CBAE;
  font-size: 13px;
}

.hero-motto i {
  width: 5px;
  height: 5px;
  background: var(--gold);
  border-radius: 50%;
}

.hero-emblem {
  width: min(280px, 25vw);
  flex-shrink: 0;
  filter: drop-shadow(0 0 40px rgba(213,179,108,.25));
  animation: emblemFloat 5s ease-in-out infinite;
}

.hero-emblem img {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
}

@keyframes emblemFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-16px); }
}

.hero-bottom {
  position: absolute;
  right: 4%;
  left: 4%;
  bottom: 20px;
  display: flex;
  justify-content: space-between;
  color: #D1C5A9;
  font-size: 12px;
}

.hero-bottom a {
  color: var(--gold);
}

/* =========================================
   الأقسام العامة
========================================= */

.content-section {
  width: min(92%, 1440px);
  margin-inline: auto;
  padding-block: 90px;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 25px;
  margin-bottom: 35px;
}

.section-heading h2 {
  margin-top: 12px;
  margin-bottom: 8px;
}

.section-heading p {
  max-width: 650px;
}

.text-link,
.card-link {
  color: var(--gold);
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  transition: opacity var(--transition-fast);
}

.text-link:hover,
.card-link:hover {
  opacity: .7;
}

/* =========================================
   بطاقات الأقسام
========================================= */

.sections-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
}

.section-card {
  position: relative;
  min-height: 245px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 27px;
  overflow: hidden;
  background:
    linear-gradient(145deg, rgba(140,117,245,.07), transparent 55%),
    var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-soft);
  transition: all var(--transition-normal);
}

.section-card::before {
  content: "";
  position: absolute;
  top: -70px;
  left: -70px;
  width: 150px;
  height: 150px;
  background: rgba(213,179,108,.08);
  border-radius: 50%;
  filter: blur(25px);
  transition: transform .5s ease;
}

.section-card:hover {
  transform: translateY(-8px);
  border-color: rgba(213,179,108,.55);
  box-shadow: var(--shadow-gold);
}

.section-card:hover::before {
  transform: scale(1.7);
}

.section-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  margin-bottom: 22px;
  color: var(--gold);
  background: rgba(213,179,108,.1);
  border: 1px solid var(--border-color);
  border-radius: 13px;
  font-family: Georgia, serif;
  font-weight: 800;
}

.section-card h3 {
  margin-bottom: 10px;
}

.section-card p {
  margin-bottom: 20px;
  font-size: 13px;
  line-height: 2;
}

.section-card .card-link {
  margin-top: auto;
}

/* =========================================
   الكتب المميزة
========================================= */

.featured-section {
  position: relative;
}

.featured-section::before {
  content: "";
  position: absolute;
  inset: 10% -10vw;
  z-index: -1;
  background: radial-gradient(ellipse, rgba(140,117,245,.07), transparent 65%);
  pointer-events: none;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 22px;
}

.book-card {
  min-width: 0;
  overflow: hidden;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all var(--transition-normal);
}

.book-card:hover {
  transform: translateY(-7px);
  border-color: var(--gold);
  box-shadow: var(--shadow-card);
}

.book-card img {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  background: var(--bg-secondary);
}

.book-card-content {
  padding: 16px;
}

.book-card h3 {
  font-size: 15px;
  margin-bottom: 8px;
}

.book-card p {
  font-size: 12px;
}

/* =========================================
   مسارات التعلم
========================================= */

.learning-section {
  background:
    radial-gradient(ellipse at 15% 50%, rgba(53,189,176,.07), transparent 40%);
}

.learning-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.learning-card {
  position: relative;
  min-height: 220px;
  padding: 28px;
  overflow: hidden;
  background: linear-gradient(145deg, var(--bg-elevated), var(--bg-tertiary));
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  transition: all var(--transition-normal);
}

.learning-card:hover {
  transform: translateY(-6px);
  border-color: var(--teal);
}

.learning-card > span {
  display: inline-grid;
  width: 42px;
  height: 42px;
  place-items: center;
  margin-bottom: 20px;
  color: var(--teal-light);
  background: rgba(53,189,176,.12);
  border-radius: 12px;
  font-weight: 900;
}

.learning-card h3 {
  margin-bottom: 10px;
}

.learning-card p {
  font-size: 13px;
}

/* =========================================
   المقالات
========================================= */

.articles-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
}

.article-card {
  overflow: hidden;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  transition: all var(--transition-normal);
}

.article-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-card);
}

.article-card img {
  width: 100%;
  height: 210px;
  object-fit: cover;
  background: var(--bg-secondary);
}

.article-card-content {
  padding: 22px;
}

.article-card h3 {
  margin-block: 10px;
  font-size: 17px;
}

.article-card p {
  font-size: 13px;
  line-height: 2;
}

/* =========================================
   مساحة المستخدم
========================================= */

.personal-card {
  position: relative;
  min-height: 310px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 45px;
  overflow: hidden;
  background:
    linear-gradient(110deg, rgba(140,117,245,.13), transparent 70%),
    var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-2xl);
}

.personal-card > div:first-child {
  max-width: 650px;
}

.personal-card h2 {
  margin-block: 12px;
}

.personal-card p {
  margin-bottom: 24px;
}

.personal-decoration {
  color: rgba(213,179,108,.12);
  font-family: Georgia, serif;
  font-size: clamp(130px, 20vw, 260px);
  font-weight: 900;
  line-height: 1;
  user-select: none;
}

/* =========================================
   المجتمع
========================================= */

.community-card {
  position: relative;
  padding: 65px 35px;
  text-align: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 0%, rgba(53,189,176,.14), transparent 55%),
    var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-2xl);
}

.community-card h2 {
  margin-block: 12px;
}

.community-card p {
  margin-bottom: 25px;
}

/* =========================================
   التذييل
========================================= */

.site-footer {
  margin-top: 50px;
  padding: 65px 4% 20px;
  background: #090D19;
  border-top: 1px solid rgba(213,179,108,.2);
}

[data-theme="light"] .site-footer {
  background: #20243A;
}

.footer-main {
  width: min(100%, 1440px);
  margin-inline: auto;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 45px;
  padding-bottom: 45px;
}

.footer-brand img {
  width: 75px;
  height: 65px;
  object-fit: contain;
}

.footer-brand h2 {
  color: var(--gold);
  font-family: Georgia, serif;
  letter-spacing: 2px;
}

.footer-brand p {
  color: #E2D4B7;
  font-size: 13px;
}

.footer-brand > span {
  color: #9293A1;
  font-size: 12px;
}

.footer-column {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 13px;
}

.footer-column h3 {
  margin-bottom: 8px;
  color: var(--gold);
  font-size: 15px;
}

.footer-column a {
  color: #B8B5C5;
  font-size: 13px;
  transition: color var(--transition-fast);
}

.footer-column a:hover {
  color: var(--gold);
}

.footer-bottom {
  width: min(100%, 1440px);
  margin-inline: auto;
  padding-top: 20px;
  display: flex;
  justify-content: space-between;
  gap: 15px;
  border-top: 1px solid rgba(255,255,255,.08);
  color: #9293A1;
  font-size: 11px;
}

/* =========================================
   الشاشات المتوسطة
========================================= */

@media (max-width: 1100px) {

  .main-navigation {
    gap: 12px;
  }

  .main-navigation a {
    font-size: 11px;
  }

  .sections-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .books-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

}

/* =========================================
   الموبايل
========================================= */

@media (max-width: 760px) {

  :root {
    --header-height: 72px;
  }

  .site-header {
    min-height: 72px;
    gap: 10px;
    padding: 8px 4%;
  }

  .brand img {
    width: 43px;
    height: 43px;
  }

  .brand strong {
    font-size: 17px;
  }

  .brand small {
    font-size: 9px;
  }

  .menu-toggle {
    display: block;
    order: 3;
    flex-shrink: 0;
  }

  .header-controls {
    margin-inline-start: auto;
  }

  .header-controls .icon-button {
    width: 37px;
    height: 37px;
  }

  .account-button {
    min-height: 37px;
    padding: 6px 11px;
    font-size: 11px;
  }

  .main-navigation {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    padding: 12px 5%;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border-color);
    box-shadow: var(--shadow-card);
  }

  .main-navigation.is-open {
    display: flex;
  }

  .main-navigation a {
    padding: 13px 5px;
    border-bottom: 1px solid var(--border-light);
    font-size: 14px;
  }

  .hero-section {
    min-height: 680px;
  }

  .hero-inner {
    min-height: 600px;
    padding-block: 65px 90px;
  }

  .hero-copy {
    width: 100%;
  }

  .hero-copy h1 {
    font-size: clamp(2rem, 9vw, 3.2rem);
  }

  .hero-copy > p {
    font-size: 14px;
  }

  .hero-emblem {
    display: none;
  }

  .hero-bottom {
    font-size: 10px;
  }

  .content-section {
    padding-block: 55px;
  }

  .section-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 15px;
  }

  .sections-grid {
    gap: 12px;
  }

  .section-card {
    min-height: 220px;
    padding: 18px;
  }

  .section-card h3 {
    font-size: 15px;
  }

  .section-card p {
    font-size: 11px;
  }

  .books-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 13px;
  }

  .learning-grid,
  .articles-grid {
    grid-template-columns: 1fr;
  }

  .personal-card {
    padding: 30px 22px;
  }

  .personal-decoration {
    display: none;
  }

  .community-card {
    padding: 45px 20px;
  }

  .footer-main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 30px 20px;
  }

  .footer-brand {
    grid-column: 1 / -1;
  }

  .footer-bottom {
    flex-direction: column;
    text-align: center;
  }

}

/* =========================================
   الشاشات الصغيرة جدًا
========================================= */

@media (max-width: 380px) {

  .header-controls {
    gap: 5px;
  }

  .header-controls .icon-button {
    width: 33px;
    height: 33px;
  }

  .brand {
    gap: 5px;
  }

  .brand img {
    width: 36px;
    height: 36px;
  }

  .brand strong {
    font-size: 14px;
  }

  .sections-grid {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    flex-direction: column;
  }

  .button {
    width: 100%;
  }

}

/* =========================================
   نهاية التنسيق العام
========================================= */
