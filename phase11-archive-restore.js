(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const DI=()=>window.TaxiPayDataIntegrity;
  const STORAGE=()=>window.TaxiPayStorageSafety;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function currentState(){
    const raw=STORAGE()?.getPrimaryRaw();
    if(!raw)return DI().ensureState(STORAGE()?.loadCandidate()?.data||{});
    return DI().ensureState(JSON.parse(raw));
  }

  function findArchive(state,id){return (state.dataArchive||[]).find(a=>a.archiveId===id)||null;}

  function makeRestoreState(state,archive){
    const built=DI().buildArchiveRestorePlan(state,archive?.archiveId);
    return {archive:built.archive,remote:built.remote,plan:built.plan};
  }

  async function resolveArchiveRestore(state,archive){
    const {remote,plan}=makeRestoreState(state,archive);
    if(plan.conflicts.length){
      const resolver=window.TaxiPayRecoveryV14?.resolveStates;
      if(typeof resolver!=='function')throw new Error('競合比較機能を利用できません。');
      const result=await resolver(state,remote,{local:'現在の有効データ',remote:'退避データ'});
      if(!result)return null;
      const usedRemote=Object.values(result.choices||{}).some(choice=>{
        if(choice==='remote')return true;
        if(choice&&typeof choice==='object'&&choice.mode==='fields')return Object.values(choice.fields||{}).some(side=>side==='remote');
        return false;
      });
      return {state:result.state,action:usedRemote?'restore':'keep-current'};
    }
    return {state:DI().applyMergePlan(plan,{},DI().deviceContext()),action:'restore'};
  }

  function enhanceArchiveUI(){
    const card=$('v14ArchiveCard');
    if(!card||card.dataset.phase11RestoreReady==='1')return;
    card.dataset.phase11RestoreReady='1';
    const actions=card.querySelector('.actions');
    if(!actions)return;
    const btn=document.createElement('button');
    btn.id='v14ArchiveRestore';
    btn.type='button';
    btn.className='secondary';
    btn.textContent='選択した退避データを復元';
    actions.insertBefore(btn,actions.querySelector('#v14ArchiveDelete')||null);

    const message=$('v14ArchiveMessage');
    btn.onclick=async()=>{
      const ids=[...document.querySelectorAll('[data-v14-archive]:checked')].map(x=>x.dataset.v14Archive);
      if(ids.length!==1){if(message)message.textContent='復元する退避データを1件だけ選択してください。';return;}
      const beforeRaw=STORAGE().getPrimaryRaw();
      try{
        const state=currentState(),archive=findArchive(state,ids[0]);
        if(!archive)throw new Error('選択した退避データが見つかりません。');
        const resolved=await resolveArchiveRestore(state,archive);
        if(!resolved){if(message)message.textContent='復元をキャンセルしました。';return;}
        const restored=resolved.state;
        const currentRaw=STORAGE().getPrimaryRaw();
        if(currentRaw!==beforeRaw)throw new Error('確認中に端末データが変更されました。一覧を更新してやり直してください。');
        restored.conflictHistory=Array.isArray(restored.conflictHistory)?restored.conflictHistory:[];
        restored.conflictHistory.push({
          conflictId:`archive-restore:${archive.archiveId}`,
          type:'archive-restore',
          targetDate:archive.workDate||archive.data?.date||'',
          resolvedAtJst:DI().jstNow(),
          selected:resolved.action,
          deviceId:DI().deviceId(),
          deviceName:DI().deviceName(),
          browser:DI().browserName()
        });
        STORAGE().save(restored,'archive-restore');
        if(message)message.textContent=resolved.action==='restore'
          ?'退避データを復元しました。元の退避データは安全のため残しています。'
          :'現在の有効データを維持しました。退避データもそのまま残しています。';
        const refresh=$('v14ArchiveRefresh');if(refresh)refresh.click();
      }catch(e){if(message)message.textContent=`復元できませんでした。${e.message||e}`;}
    };
  }

  function install(){
    enhanceArchiveUI();
    const observer=new MutationObserver(()=>enhanceArchiveUI());
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  window.TaxiPayPhase11ArchiveRestore={currentState,makeRestoreState,resolveArchiveRestore,enhanceArchiveUI};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install):install();
})();
