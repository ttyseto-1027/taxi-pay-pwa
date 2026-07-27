(function(){
  'use strict';
  const menu=document.getElementById('appMenuDialog');
  const openButton=document.getElementById('openAppMenu');
  const closeButton=document.getElementById('closeAppMenu');
  const settingsProxy=document.getElementById('openSettings');
  const settingsItem=document.getElementById('menuOpenSettings');
  const adminHeaderLink=document.getElementById('adminPageLink');
  const adminMenuLink=document.getElementById('menuAdminLink');
  const viewButtons=[...document.querySelectorAll('[data-menu-view]')];
  const viewSections=[...document.querySelectorAll('[data-app-view]')];

  function openMenu(){
    if(!menu) return;
    if(typeof menu.showModal==='function') menu.showModal();
    else menu.setAttribute('open','');
  }
  function closeMenu(){
    if(!menu) return;
    if(typeof menu.close==='function' && menu.open) menu.close();
    else menu.removeAttribute('open');
  }
  function setView(name){
    viewSections.forEach(section=>{ section.classList.toggle('app-view-hidden',section.dataset.appView!==name); });
    viewButtons.forEach(button=>{
      const current=button.dataset.menuView===name;
      button.classList.toggle('is-current',current);
      if(current) button.setAttribute('aria-current','page');
      else button.removeAttribute('aria-current');
    });
    try{sessionStorage.setItem('taxiPayCurrentViewV13Beta',name);}catch(e){}
    closeMenu();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function syncAdminVisibility(){
    if(!adminHeaderLink || !adminMenuLink) return;
    adminMenuLink.hidden=adminHeaderLink.hidden;
  }

  openButton?.addEventListener('click',openMenu);
  closeButton?.addEventListener('click',closeMenu);
  menu?.addEventListener('click',e=>{ if(e.target===menu) closeMenu(); });
  viewButtons.forEach(button=>button.addEventListener('click',()=>setView(button.dataset.menuView)));
  settingsItem?.addEventListener('click',()=>{
    closeMenu();
    settingsProxy?.click();
  });

  if(adminHeaderLink && adminMenuLink){
    syncAdminVisibility();
    new MutationObserver(syncAdminVisibility).observe(adminHeaderLink,{attributes:true,attributeFilter:['hidden']});
  }

  let initial='work';
  try{
    const saved=sessionStorage.getItem('taxiPayCurrentViewV13Beta');
    if(['work','sales','leave'].includes(saved)) initial=saved;
  }catch(e){}
  setView(initial);
})();
