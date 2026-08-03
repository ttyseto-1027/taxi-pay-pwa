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
})();
