(() => {
  'use strict';

  const menu = document.getElementById('commonMenu');
  const backdrop = document.getElementById('menuBackdrop');
  const openButton = document.getElementById('openMenu');
  const closeButton = document.getElementById('closeMenu');
  const infoDialog = document.getElementById('menuInfoDialog');
  const infoTitle = document.getElementById('menuInfoTitle');
  const infoBody = document.getElementById('menuInfoBody');

  if (!menu || !backdrop || !openButton || !closeButton) return;

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    openButton.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    if (open) closeButton.focus();
  }

  function closeMenu() { setMenu(false); }
  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function openSettings(focusId) {
    const trigger = document.getElementById('openSettings');
    if (trigger) trigger.click();
    window.setTimeout(() => {
      const target = focusId ? document.getElementById(focusId) : null;
      if (target) target.focus({ preventScroll: false });
    }, 80);
  }
  function showInfo(title, html) {
    if (!infoDialog || !infoTitle || !infoBody) return;
    infoTitle.textContent = title;
    infoBody.innerHTML = html;
    infoDialog.showModal();
  }

  openButton.addEventListener('click', () => setMenu(true));
  closeButton.addEventListener('click', closeMenu);
  backdrop.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
  });

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-menu-action]');
    if (!button) return;
    const action = button.dataset.menuAction;
    closeMenu();

    if (action === 'home') window.scrollTo({ top: 0, behavior: 'smooth' });
    if (action === 'work') scrollToSection('workSection');
    if (action === 'monthly') scrollToSection('monthlySection');
    if (action === 'paidLeave') openSettings('paidLeaveOpeningBalance');
    if (action === 'deductions') openSettings('healthInsurance');
    if (action === 'settings') openSettings('shiftType');
    if (action === 'profile') {
      const email = document.getElementById('signedInUser')?.textContent?.trim() || 'ログイン中のGoogleアカウント';
      const eligibility = document.getElementById('userEligibility')?.textContent?.trim() || '利用区分を確認中';
      showInfo('利用者情報', `<dl class="profile-summary"><dt>Googleアカウント</dt><dd>${escapeHtml(email)}</dd><dt>利用区分</dt><dd>${escapeHtml(eligibility)}</dd><dt>勤務区分</dt><dd>${escapeHtml(document.getElementById('headerShift')?.textContent || '未設定')}</dd></dl>`);
    }
    if (action === 'notice') showInfo('お知らせ', '<p>現在、新しいお知らせはありません。</p>');
    if (action === 'help') showInfo('ヘルプ', '<p>勤務実績を入力して保存すると、日別明細と給与サマリーへ反映されます。</p><p>控除額や有給残日数は、メニューの「控除額設定」「有給管理」から変更できます。</p>');
    if (action === 'logout') document.getElementById('logoutButton')?.click();
  });

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
  }
})();
