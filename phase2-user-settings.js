import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const SHIFT_TYPES = new Set(['隔日勤務','昼日勤','夜日勤','定隔10','定隔8','定隔4','定昼20','定昼16','定昼8','定夜20','定夜16','定夜8']);
  let profile = null;
  let initialized = false;
  let saving = false;

  const normalizeMember = value => ['member','union','組合員'].includes(String(value || '').trim().toLowerCase()) ? 'member' : 'nonmember';
  const memberLabel = value => normalizeMember(value) === 'member' ? '組合員' : '非組合員';
  const normalizeStatus = value => {
    const v = String(value || '').trim().toLowerCase();
    if (['suspended','利用停止','停止'].includes(v)) return 'suspended';
    if (['retired','退職'].includes(v)) return 'retired';
    return 'active';
  };
  const statusLabel = value => ({active:'利用中', suspended:'利用停止', retired:'退職'})[normalizeStatus(value)];
  const normalizeOffice = value => String(value || '').trim();
  const setMessage = (text='', kind='info') => { const el=$('basicProfileMessage'); if(el){ el.textContent=text; el.dataset.kind=kind; } };
  const setText = (id,value) => { const el=$(id); if(el) el.textContent=(value ?? '') === '' ? '—' : String(value); };

  function renderSummary(){
    if(!profile) return;
    setText('profileName', profile.name || profile.displayName);
    setText('profileEmail', profile.email);
    setText('profileDriverNumber', profile.driverNumber);
    setText('profileOffice', profile.office);
    setText('profileShiftType', profile.shiftType || profile.workType);
    setText('profileUnionStatus', memberLabel(profile.unionStatus));
    setText('profileDependentCount', Number.isInteger(Number(profile.dependentCount)) ? `${Number(profile.dependentCount)}人` : '0人');
    setText('profileUseStatus', statusLabel(profile.useStatus || profile.status));
    const note=$('profilePermissionNote');
    if(note) note.textContent = profile.isAdmin === true
      ? '管理者として、組合員区分と利用状態を含む全項目を編集できます。'
      : '組合員区分と利用状態は利用権限に関わるため、一般利用者は変更できません。';
  }

  function setOfficeValue(office){
    const select=$('basicOffice');
    const other=$('basicOfficeOther');
    const wrap=$('basicOfficeOtherWrap');
    if(!select || !other || !wrap) return;
    const exists=[...select.options].some(option=>option.value===office && office!=='その他');
    select.value=exists ? office : (office ? 'その他' : '');
    other.value=exists ? '' : office;
    wrap.hidden=select.value!=='その他';
    other.required=select.value==='その他';
  }

  function applyPermissions(){
    const admin = profile?.isAdmin === true;
    const union=$('basicUnionStatus');
    const status=$('basicUseStatus');
    if(union) union.disabled=!admin;
    if(status) status.disabled=!admin;
  }

  function fillForm(){
    if(!profile) return;
    $('basicDriverNumber').value=String(profile.driverNumber || '');
    setOfficeValue(normalizeOffice(profile.office));
    $('basicShiftType').value=SHIFT_TYPES.has(profile.shiftType || profile.workType) ? (profile.shiftType || profile.workType) : '';
    $('basicDependentCount').value=String(Math.max(0, Number(profile.dependentCount || 0)));
    $('basicUnionStatus').value=normalizeMember(profile.unionStatus);
    $('basicUseStatus').value=normalizeStatus(profile.useStatus || profile.status);
    applyPermissions();
    setMessage('');
  }

  function openEditor(){
    fillForm();
    $('basicProfileEditor').hidden=false;
    $('editBasicProfile').hidden=true;
    requestAnimationFrame(()=>$('basicDriverNumber')?.focus());
  }
  function closeEditor(){
    $('basicProfileEditor').hidden=true;
    $('editBasicProfile').hidden=false;
    setMessage('');
  }

  function validate(){
    const driverNumber=String($('basicDriverNumber').value || '').trim();
    const officeChoice=$('basicOffice').value;
    const office=officeChoice==='その他' ? String($('basicOfficeOther').value || '').trim() : officeChoice;
    const shiftType=$('basicShiftType').value;
    const dependentCount=Number($('basicDependentCount').value);
    if(!/^\d{4,8}$/.test(driverNumber)) throw new Error('乗務員番号は4～8桁の数字で入力してください。');
    if(!office) throw new Error('営業所を選択または入力してください。');
    if(office.length>40) throw new Error('営業所名は40文字以内で入力してください。');
    if(!SHIFT_TYPES.has(shiftType)) throw new Error('勤務形態を選択してください。');
    if(!Number.isInteger(dependentCount) || dependentCount<0 || dependentCount>20) throw new Error('扶養人数は0～20人の整数で入力してください。');
    const values={driverNumber,office,shiftType,workType:shiftType,dependentCount};
    if(profile?.isAdmin===true){
      values.unionStatus=$('basicUnionStatus').value==='member' ? 'member' : 'nonmember';
      values.useStatus=['active','suspended','retired'].includes($('basicUseStatus').value) ? $('basicUseStatus').value : 'active';
      values.status=values.useStatus;
    }
    return values;
  }

  async function save(event){
    event.preventDefault();
    if(saving || !profile) return;
    let values;
    try{ values=validate(); }catch(error){ setMessage(error.message,'error'); return; }
    const apps=getApps();
    const auth=apps.length ? getAuth(getApp()) : null;
    const user=auth?.currentUser;
    if(!user){ setMessage('ログイン状態を確認できません。再読み込みしてログインし直してください。','error'); return; }
    saving=true;
    const saveButton=$('saveBasicProfile');
    saveButton.disabled=true;
    setMessage('保存しています…','info');
    try{
      const db=getFirestore(getApp());
      await setDoc(doc(db,'users',user.uid),{...values,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});
      profile={...profile,...values};
      window.TaxiPayCurrentProfile=profile;
      try{ sessionStorage.setItem('taxiPayV13Profile',JSON.stringify(profile)); }catch{}
      renderSummary();
      const header=document.getElementById('headerShift');
      if(header) header.textContent=values.shiftType;
      setMessage('利用者設定を保存しました。','success');
      window.dispatchEvent(new CustomEvent('taxipay:profile-updated',{detail:profile}));
      setTimeout(closeEditor,700);
    }catch(error){
      console.error('[Phase2] 利用者設定の保存に失敗しました。',error);
      setMessage(error?.code==='permission-denied' ? '保存権限を確認できませんでした。管理者へお問い合わせください。' : '利用者設定を保存できませんでした。通信状態を確認して再度お試しください。','error');
    }finally{
      saving=false;
      saveButton.disabled=false;
    }
  }

  function initialize(nextProfile){
    if(!nextProfile || typeof nextProfile!=='object') return;
    profile={...nextProfile};
    renderSummary();
    if(initialized) return;
    initialized=true;
    $('editBasicProfile')?.addEventListener('click',openEditor);
    $('cancelBasicProfile')?.addEventListener('click',closeEditor);
    $('basicProfileForm')?.addEventListener('submit',save);
    $('basicOffice')?.addEventListener('change',event=>{
      const other=event.target.value==='その他';
      $('basicOfficeOtherWrap').hidden=!other;
      $('basicOfficeOther').required=other;
      if(other) $('basicOfficeOther').focus();
    });
  }

  window.addEventListener('taxipay:profile',event=>initialize(event.detail));
  window.addEventListener('taxipay:app-ready',event=>initialize(event.detail));
})();
