(() => {
  'use strict';

  const menu = document.getElementById('commonMenu');
  const backdrop = document.getElementById('menuBackdrop');
  const openButton = document.getElementById('openMenu');
  const closeButton = document.getElementById('closeMenu');
  const views = [...document.querySelectorAll('[data-app-view]')];
  const menuButtons = [...document.querySelectorAll('[data-view]')];
  const previewControls = document.getElementById('adminPreviewControls');
  const previewMode = document.getElementById('adminPreviewMode');
  const publicViews = new Set(['work', 'profile', 'settings', 'help']);
  const memberViews = new Set(['monthly', 'paid-leave', 'deductions']);
  let actualMember = false;
  let isAdmin = false;

  if (!menu || !backdrop || !openButton || !closeButton) return;

  function effectiveMember() {
    if (!isAdmin || !previewMode || previewMode.value === 'actual') return actualMember;
    return previewMode.value === 'member';
  }

  function setMenu(open) {
    menu.hidden = !open;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    openButton.setAttribute('aria-expanded', String(open));
    backdrop.hidden = !open;
    document.body.classList.toggle('menu-open', open);
    if (open) closeButton.focus();
  }

  function applyEffectiveAccess() {
    const member = effectiveMember();
    document.body.dataset.effectiveUnionStatus = member ? 'member' : 'nonmember';

    document.querySelectorAll('[data-union-only]').forEach((node) => {
      node.hidden = !member;
    });

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
    if (memberViews.has(view) && !effectiveMember()) view = 'work';

    views.forEach((section) => {
      const roleBlocked = section.hasAttribute('data-union-only') && !effectiveMember();
      section.hidden = section.dataset.appView !== view || roleBlocked;
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

  function acceptProfile(profile) {
    if (!profile) return;
    const unionStatus = String(profile.unionStatus || '').trim().toLowerCase();
    actualMember = unionStatus === 'member' || unionStatus === 'union' || unionStatus === '組合員';
    isAdmin = profile.isAdmin === true;
    if (previewControls) previewControls.hidden = !isAdmin;
    if (!isAdmin && previewMode) previewMode.value = 'actual';
    document.body.dataset.actualUnionStatus = actualMember ? 'member' : 'nonmember';
    applyEffectiveAccess();
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
    if (button.hasAttribute('data-member-only') && !effectiveMember()) return;
    setMenu(false);
    showView(button.dataset.view);
  });

  previewMode?.addEventListener('change', () => {
    applyEffectiveAccess();
    showView(location.hash.replace(/^#\/?/, '') || 'work', true);
  });

  const forceCloseMenu = () => {
    setMenu(false);
    // hidden属性やクラスの反映順に左右されないよう、残留状態も明示的に解除する。
    menu.hidden = true;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    document.body.classList.remove('menu-open');
    openButton.setAttribute('aria-expanded', 'false');
  };

  const headerLogout = document.getElementById('logoutButton');
  const menuLogout = document.getElementById('menuLogout');

  // capture段階で先に閉じ、他のログアウト処理の完了を待たない。
  headerLogout?.addEventListener('click', forceCloseMenu, true);
  menuLogout?.addEventListener('click', () => {
    forceCloseMenu();
    headerLogout?.click();
  });

  // Firebase側がログイン画面へ戻した時にも強制的に閉じる。
  // 通信速度やsignOut完了タイミングによるスマホ固有の残留を防ぐ。
  new MutationObserver(() => {
    if (document.body.classList.contains('auth-pending') || !document.getElementById('authGate')?.hidden) {
      forceCloseMenu();
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const authGate = document.getElementById('authGate');
  if (authGate) {
    new MutationObserver(() => {
      if (!authGate.hidden) forceCloseMenu();
    }).observe(authGate, { attributes: true, attributeFilter: ['hidden', 'aria-hidden'] });
  }

  window.addEventListener('hashchange', () => {
    showView(location.hash.replace(/^#\/?/, ''), true);
  });
  window.addEventListener('taxipay:profile', (event) => acceptProfile(event.detail));
  window.addEventListener('taxipay:app-ready', (event) => acceptProfile(event.detail));

  ['signedInUser', 'userEligibility', 'headerShift'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) new MutationObserver(refreshProfile).observe(node, { childList: true, subtree: true, characterData: true });
  });

  if (window.TaxiPayCurrentProfile) acceptProfile(window.TaxiPayCurrentProfile);
  else {
    actualMember = document.body.dataset.unionStatus === 'member';
    applyEffectiveAccess();
  }
  showView(location.hash.replace(/^#\/?/, '') || 'work', true);
})();
