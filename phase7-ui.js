(() => {
  'use strict';
  const STORAGE_KEY = 'taxiPayPhase7AccordionState';
  const accordions = [...document.querySelectorAll('.phase7-accordion, .phase7-subaccordion')];
  let state = {};
  try { state = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}'); } catch { state = {}; }

  accordions.forEach((details, index) => {
    const title = details.querySelector(':scope > summary .phase7-summary-title, :scope > summary > span')?.textContent?.trim() || `accordion-${index}`;
    const key = `${location.pathname}:${title}`;
    if (Object.prototype.hasOwnProperty.call(state, key)) details.open = Boolean(state[key]);
    details.addEventListener('toggle', () => {
      state[key] = details.open;
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    });
  });

  // Phase 8: smartphone UI fixes.
  const style = document.createElement('style');
  style.id = 'phase8-smartphone-ui-fixes';
  style.textContent = `
    .tap-number-pad button,
    .tap-number-grid button,
    #tapBreakUnits button {
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      -webkit-user-select: none;
      user-select: none;
    }
    @media (max-width: 640px) {
      .tap-number-pad button,
      .tap-number-grid button,
      #tapBreakUnits button {
        min-height: 48px;
        font-size: 1rem;
      }
      .month-navigation-card { border-width: 2px; }
      .month-navigation-card .month-navigation-title { text-align: center; margin-bottom: 10px; }
      .month-navigation-card .month-navigation-title strong { display: block; font-size: 1.05rem; }
      .month-navigation-card .month-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 10px;
        align-items: stretch;
      }
      .month-navigation-card .month-row input {
        grid-column: 1 / -1;
        grid-row: 1;
        width: 100%;
        max-width: none;
        min-height: 46px;
        font-size: 16px;
        text-align: center;
      }
      .month-navigation-card #prevMonth,
      .month-navigation-card #nextMonth {
        min-width: 0;
        min-height: 48px;
        width: 100%;
        font-size: 1rem;
        font-weight: 700;
        white-space: nowrap;
        touch-action: manipulation;
        border-width: 2px;
      }
      .month-navigation-card #prevMonth { grid-column: 1; }
      .month-navigation-card #nextMonth { grid-column: 2; }
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('dblclick', (event) => {
    if (event.target.closest('.tap-number-pad, .tap-number-grid, #tapBreakUnits')) event.preventDefault();
  }, { passive: false });

  const revenueAdjustmentIds = ['idleA', 'idleB', 'otherPlus', 'otherMinus'];
  const clearFreshRevenueAdjustments = () => {
    const editingId = document.getElementById('editingId');
    if (editingId?.value) return;
    revenueAdjustmentIds.forEach((id) => {
      const input = document.getElementById(id);
      if (input && input.value === '0') input.value = '';
    });
  };
  clearFreshRevenueAdjustments();
  requestAnimationFrame(clearFreshRevenueAdjustments);
  setTimeout(clearFreshRevenueAdjustments, 0);

  document.getElementById('resetForm')?.addEventListener('click', () => setTimeout(clearFreshRevenueAdjustments, 0));
  document.getElementById('entryForm')?.addEventListener('submit', () => setTimeout(clearFreshRevenueAdjustments, 0));

  // Phase 10: device-registry-v14.js used a fixed old query string in index.html.
  // If that old module failed to parse and therefore did not expose its API,
  // load the corrected module with a fresh URL. This is intentionally a
  // bootstrap only; it does not change device identity or user data.
  const ensureFreshDeviceRegistry = async () => {
    if (window.TaxiPayDeviceRegistry) return;
    try {
      await import('./device-registry-v14.js?v=20261014-01');
      window.TaxiPayInlineDiagnostic?.add?.('PHASE10-DEVICE-REGISTRY-REFRESH','端末識別モジュールを最新版で再読み込みしました。');
    } catch (error) {
      window.TaxiPayInlineDiagnostic?.add?.('PHASE10-DEVICE-REGISTRY-FAIL','端末識別モジュールの再読み込みに失敗しました。',error);
      console.warn('device registry refresh failed', error);
    }
  };
  ensureFreshDeviceRegistry();

})();

window.addEventListener('taxipay:profile',(event)=>{const el=document.getElementById('systemInfoMenuLink');if(el)el.hidden=event.detail?.isAdmin!==true;});
