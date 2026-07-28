(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let profile = null;
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = (value ?? '') === '' ? '—' : String(value); };
  const memberLabel = value => ['member','union','組合員'].includes(String(value || '').trim().toLowerCase()) ? '組合員' : '非組合員';
  const statusLabel = value => {
    const v = String(value || '').trim().toLowerCase();
    if (['suspended','利用停止','停止'].includes(v)) return '利用停止';
    if (['retired','退職'].includes(v)) return '退職';
    return '利用中';
  };
  function render(nextProfile) {
    if (!nextProfile || typeof nextProfile !== 'object') return;
    profile = { ...nextProfile };
    setText('profileName', profile.name || profile.displayName);
    setText('profileEmail', profile.email);
    setText('profileDriverNumber', profile.driverNumber);
    setText('profileOffice', profile.office);
    setText('profileShiftType', profile.shiftType || profile.workType);
    setText('profileUnionStatus', memberLabel(profile.unionStatus));
    setText('profileUseStatus', statusLabel(profile.useStatus || profile.status));
  }
  window.addEventListener('taxipay:profile', event => render(event.detail));
  window.addEventListener('taxipay:app-ready', event => render(event.detail));
})();
