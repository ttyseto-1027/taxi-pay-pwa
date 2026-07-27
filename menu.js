(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('appMenuDialog');
  const openButton = $('openAppMenu');
  const closeButton = $('closeAppMenu');
  const legacySettingsButton = $('openSettings');
  const adminHeaderLink = $('adminPageLink');
  const adminMenuLink = document.querySelector('.app-menu-admin');
  const pageNodes = [...document.querySelectorAll('[data-app-page]')];
  let currentPage = 'work';

  function isAdminVisible() {
    return Boolean(adminHeaderLink && !adminHeaderLink.hidden);
  }
  function syncAdminVisibility() {
    if (adminMenuLink) adminMenuLink.hidden = !isAdminVisible();
  }
  function openMenu() {
    syncAdminVisibility();
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  function closeMenu() {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }
  function setPage(page) {
    currentPage = page;
    pageNodes.forEach(node => {
      const shouldShow = node.dataset.appPage === page;
      // data-union-only elements remain governed by the existing profile logic.
      if (node.hasAttribute('data-union-only') && shouldShow) {
        const profile = window.TaxiPayCurrentProfile;
        node.hidden = profile?.unionStatus !== 'member';
      } else {
        node.hidden = !shouldShow;
      }
    });
    document.querySelectorAll('[data-menu-page]').forEach(item => {
      const active = item.dataset.menuPage === page;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    });
    closeMenu();
    window.scrollTo({top: 0, behavior: 'instant'});
  }

  openButton?.addEventListener('click', openMenu);
  closeButton?.addEventListener('click', closeMenu);
  dialog?.addEventListener('click', event => {
    if (event.target === dialog) closeMenu();
  });
  dialog?.addEventListener('cancel', event => {
    event.preventDefault();
    closeMenu();
  });
  document.querySelectorAll('[data-menu-page]').forEach(button => {
    button.addEventListener('click', () => setPage(button.dataset.menuPage));
  });
  document.querySelector('[data-menu-action="settings"]')?.addEventListener('click', () => {
    closeMenu();
    legacySettingsButton?.click();
  });

  window.addEventListener('taxipay:profile', () => {
    syncAdminVisibility();
    setPage(currentPage);
  });
  window.addEventListener('taxipay:app-ready', () => {
    syncAdminVisibility();
    setPage('work');
  });

  // MutationObserver ensures the administrator item follows auth visibility changes.
  if (adminHeaderLink) {
    new MutationObserver(syncAdminVisibility).observe(adminHeaderLink, {attributes:true, attributeFilter:['hidden']});
  }
  setPage('work');
})();
