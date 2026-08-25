(() => {
'use strict';
const $=id=>document.getElementById(id);
const menu=$('appMenu');
const overlay=$('menuOverlay');
const openBtn=$('openAppMenu');
const closeBtn=$('closeAppMenu');
let initialized=false;
let actualProfile=null;
let previewMode='actual';

function closeMenu(){
  if(menu) menu.hidden=true;
  if(overlay) overlay.hidden=true;
  document.body.classList.remove('menu-open');
  openBtn?.setAttribute('aria-expanded','false');
}

// ログアウト時のメニュー閉鎖だけは、認証初期化より先に利用可能にする。
$('logoutButton')?.addEventListener('click',closeMenu,{capture:true});

function isMember(profile){
  const value=String(profile?.unionStatus||'').trim().toLowerCase();
  return value==='member'||value==='union'||value==='組合員';
}

function effectiveMember(){
  return previewMode==='member'||(previewMode==='actual'&&isMember(actualProfile));
}

function openMenu(){
  if(document.body.classList.contains('auth-pending')) return;
  if(menu) menu.hidden=false;
  if(overlay) overlay.hidden=false;
  document.body.classList.add('menu-open');
  openBtn?.setAttribute('aria-expanded','true');
}

function panels(){return [...document.querySelectorAll('[data-view-panel]')];}
function menuItems(){return [...document.querySelectorAll('.menu-item[data-view]')];}

function showView(name,{updateHash=true}={}){
  const member=effectiveMember();
  if(['monthly','paidleave','deductions'].includes(name)&&!member) return;
  panels().forEach(panel=>{panel.hidden=panel.dataset.viewPanel!==name;});
  menuItems().forEach(button=>button.classList.toggle('active',button.dataset.view===name));
  if(updateHash){
    const next=name==='work'?'':`#${name}`;
    if(location.hash!==next) history.replaceState(null,'',`${location.pathname}${location.search}${next}`);
  }
  closeMenu();
}

function fillProfile(profile){
  const set=(id,value)=>{const el=$(id);if(el)el.textContent=value||'—';};
  set('profileName',profile?.name);
  set('profileEmail',profile?.email);
  set('profileDriverNumber',profile?.driverNumber);
  set('profileOffice',profile?.office);
  set('profileShiftType',profile?.shiftType||profile?.workType);
  set('profileUnionStatus',isMember(profile)?'組合員':'非組合員');
  set('profileUseStatus',profile?.useStatus||profile?.status||'利用中');
}

function applyAccess(){
  const member=effectiveMember();
  document.body.dataset.previewRole=member?'member':'nonmember';
  document.querySelectorAll('[data-member-menu]').forEach(button=>{
    button.classList.toggle('member-locked',!member);
    button.setAttribute('aria-disabled',String(!member));
  });
  document.querySelectorAll('[data-union-only]').forEach(element=>{element.hidden=!member;});
  if(!member){
    const current=panels().find(panel=>!panel.hidden)?.dataset.viewPanel;
    if(['monthly','paidleave','deductions'].includes(current)) showView('work');
  }
}

function acceptProfile(profile){
  if(!profile||typeof profile!=='object') return;
  actualProfile=profile;
  fillProfile(profile);
  const previewPanel=$('adminPreviewPanel');
  if(previewPanel) previewPanel.hidden=profile.isAdmin!==true;
  const adminMenuLink=$('adminMenuLink');
  if(adminMenuLink) adminMenuLink.hidden=profile.isAdmin!==true;
  if(profile.isAdmin!==true){
    previewMode='actual';
    const select=$('adminPreviewMode');
    if(select) select.value='actual';
  }
  applyAccess();
}

function initialize(profile){
  acceptProfile(profile);
  if(initialized) return;
  initialized=true;

  openBtn?.addEventListener('click',openMenu);
  closeBtn?.addEventListener('click',closeMenu);
  overlay?.addEventListener('click',closeMenu);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  menuItems().forEach(button=>button.addEventListener('click',()=>{
    if(button.classList.contains('member-locked')) return;
    showView(button.dataset.view);
  }));
  $('adminPreviewMode')?.addEventListener('change',event=>{
    previewMode=event.target.value;
    applyAccess();
  });
  $('openDeductionSettings')?.addEventListener('click',()=>{
    const dialog=$('settingsDialog');
    if(dialog?.showModal) dialog.showModal();
  });

  const hash=location.hash.slice(1);
  const allowed=['monthly','paidleave','deductions','profile','settings','help'];
  showView(allowed.includes(hash)?hash:'work',{updateHash:false});
}

// Phase 1のDOM制御は認証完了後にのみ開始する。
window.addEventListener('taxipay:profile',event=>initialize(event.detail));
window.addEventListener('taxipay:app-ready',event=>initialize(event.detail));
})();
