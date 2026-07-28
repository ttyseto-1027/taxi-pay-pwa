(() => {
'use strict';
const $=id=>document.getElementById(id);
const menu=$('appMenu'), overlay=$('menuOverlay'), openBtn=$('openAppMenu'), closeBtn=$('closeAppMenu');
const panels=[...document.querySelectorAll('[data-view-panel]')];
const menuItems=[...document.querySelectorAll('.menu-item[data-view]')];
let actualProfile=null, previewMode='actual';
function isMember(p){const s=String(p?.unionStatus||'').trim().toLowerCase();return s==='member'||s==='union'||s==='組合員';}
function effectiveMember(){return previewMode==='member'||(previewMode==='actual'&&isMember(actualProfile));}
function closeMenu(){if(menu&&menu.hidden===false)menu.hidden=true;if(overlay&&overlay.hidden===false)overlay.hidden=true;if(document.body.classList.contains('menu-open'))document.body.classList.remove('menu-open');if(openBtn?.getAttribute('aria-expanded')!=='false')openBtn?.setAttribute('aria-expanded','false');}
function openMenu(){if(document.body.classList.contains('auth-pending'))return;if(menu)menu.hidden=false;if(overlay)overlay.hidden=false;document.body.classList.add('menu-open');openBtn?.setAttribute('aria-expanded','true');}
function showView(name){const member=effectiveMember();if(['monthly','paidleave','deductions'].includes(name)&&!member)return;panels.forEach(p=>p.hidden=p.dataset.viewPanel!==name);menuItems.forEach(b=>b.classList.toggle('active',b.dataset.view===name));location.hash=name==='work'?'':'#'+name;closeMenu();}
function fillProfile(p){const set=(id,v)=>{if($(id))$(id).textContent=v||'—'};set('profileName',p?.name);set('profileEmail',p?.email);set('profileDriverNumber',p?.driverNumber);set('profileOffice',p?.office);set('profileShiftType',p?.shiftType||p?.workType);set('profileUnionStatus',isMember(p)?'組合員':'非組合員');set('profileUseStatus',p?.useStatus||p?.status||'利用中');}
function applyAccess(){const member=effectiveMember();document.body.dataset.previewRole=member?'member':'nonmember';document.querySelectorAll('[data-member-menu]').forEach(b=>{b.classList.toggle('member-locked',!member);b.setAttribute('aria-disabled',String(!member));});document.querySelectorAll('[data-union-only]').forEach(el=>{el.hidden=!member;});if(!member){const current=panels.find(p=>!p.hidden)?.dataset.viewPanel;if(['monthly','paidleave','deductions'].includes(current))showView('work');}}
function acceptProfile(p){if(!p)return;actualProfile=p;fillProfile(p);const panel=$('adminPreviewPanel');if(panel)panel.hidden=p.isAdmin!==true;if(p.isAdmin!==true){previewMode='actual';if($('adminPreviewMode'))$('adminPreviewMode').value='actual';}applyAccess();}
openBtn?.addEventListener('click',openMenu);closeBtn?.addEventListener('click',closeMenu);overlay?.addEventListener('click',closeMenu);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
menuItems.forEach(b=>b.addEventListener('click',()=>{if(b.classList.contains('member-locked'))return;showView(b.dataset.view);}));
$('adminPreviewMode')?.addEventListener('change',e=>{previewMode=e.target.value;applyAccess();});
$('openDeductionSettings')?.addEventListener('click',()=>{const d=$('settingsDialog');if(d?.showModal)d.showModal();});
$('logoutButton')?.addEventListener('click',closeMenu,{capture:true});
window.addEventListener('taxipay:profile',e=>acceptProfile(e.detail));window.addEventListener('taxipay:app-ready',e=>acceptProfile(e.detail));
// 認証画面へ戻った時だけ、開いているメニューを一度閉じる。
// body.class の監視中に同じ class 属性を無条件で書き換えると、
// Chromium系ブラウザでMutationObserverが再発火し続ける可能性があるため、
// 実際にメニューが開いている場合だけDOMを変更する。
new MutationObserver(()=>{
  if(!document.body.classList.contains('auth-pending'))return;
  const menuIsOpen=document.body.classList.contains('menu-open')||menu?.hidden===false||overlay?.hidden===false;
  if(menuIsOpen)closeMenu();
}).observe(document.body,{attributes:true,attributeFilter:['class']});
const stored=(()=>{try{return JSON.parse(sessionStorage.getItem('taxiPayV13Profile')||'null')}catch{return null}})();acceptProfile(window.TaxiPayCurrentProfile||stored);
const hash=location.hash.slice(1);showView(['monthly','paidleave','deductions','profile','settings','help'].includes(hash)?hash:'work');
})();
