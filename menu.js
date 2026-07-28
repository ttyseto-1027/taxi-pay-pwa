(() => {
  'use strict';

  const menu = document.getElementById('commonMenu');
  const backdrop = document.getElementById('menuBackdrop');
  const openButton = document.getElementById('openMenu');
  const closeButton = document.getElementById('closeMenu');
  const views = [...document.querySelectorAll('[data-app-view]')];
  const menuButtons = [...document.querySelectorAll('[data-view]')];
  const publicViews = new Set(['work', 'payroll', 'profile', 'settings', 'help']);
  const memberViews = new Set(['monthly', 'paid-leave', 'deductions']);

  if (!menu || !backdrop || !openButton || !closeButton) return;

  const isMember = () => document.body.dataset.unionStatus === 'member';

  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    openButton.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    if (open) closeButton.focus();
  }

  function syncMemberAccess() {
    const member = isMember();
    document.querySelectorAll('[data-member-only]').forEach((button) => {
      button.classList.toggle('member-locked', !member);
      button.setAttribute('aria-disabled', String(!member));
      button.tabIndex = member ? 0 : -1;
    });
    const current = location.hash.replace(/^#\/?/, '');
    if (!member && memberViews.has(current)) showView('work', true);
  }

  function refreshProfile() {
    const email = document.getElementById('signedInUser')?.textContent?.trim() || '確認中';
    const eligibility = document.getElementById('userEligibility')?.textContent?.trim() || '確認中';
    const shift = document.getElementById('headerShift')?.textContent?.trim() || '未設定';
    const profileEmail = document.getElementById('profileEmail');
    const profileEligibility = document.getElementById('profileEligibility');
    const profileShift = document.getElementById('profileShift');
    if (profileEmail) profileEmail.textContent = email;
    if (profileEligibility) profileEligibility.textContent = eligibility;
    if (profileShift) profileShift.textContent = shift;
  }

  function showView(requested, replaceHash = false) {
    let view = publicViews.has(requested) || memberViews.has(requested) ? requested : 'work';
    if (memberViews.has(view) && !isMember()) view = 'work';

    views.forEach((section) => {
      const active = section.dataset.appView === view;
      section.hidden = !active;
    });
    menuButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.view === view);
    });
    refreshProfile();
    const nextHash = `#/${view}`;
    if (location.hash !== nextHash) {
      if (replaceHash) history.replaceState(null, '', nextHash);
      else history.pushState(null, '', nextHash);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  openButton.addEventListener('click', () => setMenu(true));
  closeButton.addEventListener('click', () => setMenu(false));
  backdrop.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    if (button.hasAttribute('data-member-only') && !isMember()) return;
    setMenu(false);
    showView(button.dataset.view);
  });

  document.getElementById('menuLogout')?.addEventListener('click', () => {
    document.getElementById('logoutButton')?.click();
  });

  window.addEventListener('hashchange', () => {
    showView(location.hash.replace(/^#\/?/, ''), true);
  });

  new MutationObserver(() => {
    syncMemberAccess();
    refreshProfile();
  }).observe(document.body, { attributes: true, attributeFilter: ['data-union-status'] });

  ['signedInUser', 'userEligibility', 'headerShift'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) new MutationObserver(refreshProfile).observe(node, { childList: true, subtree: true, characterData: true });
  });

  syncMemberAccess();
  showView(location.hash.replace(/^#\/?/, '') || 'work', true);
})();
