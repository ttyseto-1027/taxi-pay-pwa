(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const DI=()=>window.TaxiPayDataIntegrity;
  const STORAGE=()=>window.TaxiPayStorageSafety;
  const BEFORE_RECOVERY_KEY=()=>STORAGE()?.isDevelop?'taxiPayDevelopBeforeBuiltInRecoveryV1':'taxiPayBeforeBuiltInRecoveryV1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=x=>JSON.parse(JSON.stringify(x));
  const LABELS={date:'勤務日',paidLeaveUnits:'有休日数',grossSales:'総営収（税込）',adjustedGrossSales:'給与計算用税込営収',grossRevenue:'給与計算用税込営収',otherPlus:'その他（＋）',otherMinus:'その他（－）',idleA:'A空転',idleB:'B空転',clockIn:'出勤時刻',clockOut:'退勤時刻',normalBreakMinutes:'通常休憩',nightBreakMinutes:'深夜休憩',holidayType:'休日区分',hadAccident:'事故',hadViolation:'違反'};
  function valueText(field,v){if(v===undefined)return '未設定';if(v===null)return 'なし';if(typeof v==='object')return JSON.stringify(v);if(typeof v==='boolean')return v?'あり':'なし';if(/gross|Plus|Minus|idle/i.test(field)&&Number.isFinite(Number(v)))return `${Number(v).toLocaleString('ja-JP')}円`;if(/Minutes/i.test(field)&&Number.isFinite(Number(v)))return `${Number(v)}分`;return String(v);}
  function sourceState(x){
    if(x&&x.schema){
      const supportedDriveSchemas=new Set(['taxi-pay-drive-v1','taxi-pay-drive-v2','taxi-pay-drive-v3']);
      if(!supportedDriveSchemas.has(String(x.schema)))throw new Error('このバックアップ形式は現在のアプリでは安全に復旧できません。アプリを更新してから再度お試しください。');
      if(x.data?.state)return x.data.state;
      throw new Error('Google Driveバックアップ内の給与データを確認できませんでした。');
    }
    if(x&&x.rescueFormat&&x.state)return x.state;
    if(x&&x.backupFormat&&x.state)return x.state;
    if(x&&x.state&&Array.isArray(x.state.entries))return x.state;
    if(x&&Array.isArray(x.entries))return x;
    if(x&&Array.isArray(x.rows)){const key=STORAGE()?.isDevelop?'taxiPayPwaDevelopStateV10':'taxiPayPwaStateV10';const row=x.rows.find(r=>r?.key===key)||x.rows.find(r=>/StateV10$/.test(String(r?.key||'')));if(row?.data)return row.data;}
    throw new Error('このJSONから給与シミュレーターのデータを確認できませんでした。');
  }
  function currentState(){
    const raw=STORAGE()?.getPrimaryRaw();if(!raw){const loaded=STORAGE()?.loadCandidate();return DI().ensureState(loaded?.data||{});}try{return DI().ensureState(JSON.parse(raw));}catch{throw new Error('現在の端末データを安全に解析できません。');}
  }
  function diffSummary(c){return c.diffs.map(d=>LABELS[d.field]||d.field).join('・')||'内容';}
  const ARCHIVE_KIND_LABELS={entry:'勤務実績',setting:'設定',history:'締め履歴'};
  const ARCHIVE_REASON_LABELS={
    'conflict-loser':'競合で非採用',
    'same-date-conflict-loser':'同一勤務日の競合で非採用',
    'field-merge-source-local':'項目別統合元（現在側）',
    'field-merge-source-remote':'項目別統合元（比較先）',
    'deleted-state-selected':'削除状態を採用したため退避',
    'active-record-removed':'有効データから削除されたため退避',
    'setting-conflict-loser':'設定競合で非採用',
    'history-conflict-loser':'締め履歴競合で非採用',
    'phase11-live-test-fixture':'Phase 11実機テスト'
  };
  function archiveRevenue(a){
    if(a?.kind!=='entry')return null;
    const d=a.data||{};
    for(const k of ['grossRevenue','adjustedGrossSales','grossSales']){
      if(d[k]!==undefined&&d[k]!==null&&d[k]!==''&&Number.isFinite(Number(d[k])))return Number(d[k]);
    }
    return null;
  }
  function archiveDisplay(a){
    const kind=ARCHIVE_KIND_LABELS[a?.kind]||String(a?.kind||'退避データ');
    const reason=ARCHIVE_REASON_LABELS[a?.reason]||String(a?.reason||'理由不明');
    let title=String(a?.workDate||a?.sourceId||kind);
    const revenue=archiveRevenue(a);
    if(revenue!==null)title+=`　営収 ${revenue.toLocaleString('ja-JP')}円`;
    if(a?.kind==='setting'){
      const field=String(a?.data?.field||a?.sourceId||'');
      if(field)title=`設定：${LABELS[field]||field}`;
    }else if(a?.kind==='history'){
      const month=String(a?.data?.month||a?.sourceId||'');
      if(month)title=`締め履歴：${month}`;
    }
    return{title,kind,reason,archivedAt:String(a?.archivedAtJst||'')};
  }
  function ensureDialog(){
    let d=$('v14ConflictDialog');if(d)return d;
    d=document.createElement('dialog');d.id='v14ConflictDialog';d.className='modal v14-conflict-dialog';d.innerHTML='<form method="dialog"><div class="modal-title-row"><h2 id="v14ConflictTitle">競合内容</h2><button class="icon-button" value="cancel" aria-label="閉じる">×</button></div><div id="v14ConflictBody"></div><div class="actions"><button type="button" id="v14ChooseLocal">この端末側を採用</button><button type="button" id="v14ChooseRemote" class="secondary">比較先を採用</button><button type="button" id="v14FieldMode" class="ghost">項目ごとに選ぶ</button></div><div id="v14FieldChoices" hidden></div></form>';document.body.appendChild(d);return d;
  }
  function chooseConflict(c,labels={local:'この端末',remote:'復旧データ'}){
    return new Promise(resolve=>{
      const d=ensureDialog(),body=$('v14ConflictBody'),fields=$('v14FieldChoices');$('v14ConflictTitle').textContent=`${c.date||'設定'} の競合`;
      body.innerHTML=`<p class="note">差異がある項目だけを表示しています。</p><div class="v14-diff-list">${c.diffs.map(x=>`<div class="v14-diff-row"><strong>${esc(LABELS[x.field]||x.field)}</strong><div><span>${esc(labels.local)}</span><b>${esc(valueText(x.field,x.local))}</b></div><div><span>${esc(labels.remote)}</span><b>${esc(valueText(x.field,x.remote))}</b></div></div>`).join('')}</div>`;
      fields.hidden=true;fields.innerHTML='';
      const finish=value=>{try{d.close()}catch{}resolve(value)};
      $('v14ChooseLocal').onclick=()=>finish('local');$('v14ChooseRemote').onclick=()=>finish('remote');
      $('v14FieldMode').hidden=!['entry','setting'].includes(c.type);$('v14FieldMode').onclick=()=>{
        fields.hidden=false;fields.innerHTML='<h3>項目ごとに採用元を選択</h3>'+c.diffs.map(x=>`<label>${esc(LABELS[x.field]||x.field)}<select data-v14-field="${esc(x.field)}"><option value="local">${esc(labels.local)}</option><option value="remote">${esc(labels.remote)}</option></select></label>`).join('')+'<button type="button" id="v14ApplyFields">この組み合わせを採用</button>';
        $('v14ApplyFields').onclick=()=>{const map={};fields.querySelectorAll('[data-v14-field]').forEach(s=>map[s.dataset.v14Field]=s.value);finish({mode:'fields',fields:map});};
      };
      d.addEventListener('cancel',()=>resolve(null),{once:true});d.addEventListener('close',()=>{}, {once:true});d.showModal();
    });
  }
  async function resolveStates(local,remote,labels={local:'この端末',remote:'比較先'}){
    const plan=DI().buildMergePlan(local,remote),choices={};
    for(const c of plan.conflicts){const choice=await chooseConflict(c,labels);if(!choice)return null;choices[c.id]=choice;}
    return{state:DI().applyMergePlan(plan,choices,DI().deviceContext()),plan,choices};
  }
  function download(name,obj){const u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
  function installBuiltInRecovery(){
    const backupPanel=document.querySelector('[data-view-panel="settings"]');if(!backupPanel||$('v14RecoveryCard'))return;
    const card=document.createElement('section');card.className='card drive-card';card.id='v14RecoveryCard';card.innerHTML='<h2>過去データの復旧・統合</h2><p class="note">端末に保存した給与シミュレーターのJSONを、現在のデータを消さずに比較・統合します。Google Driveとは独立した機能です。</p><input id="v14RecoveryFile" type="file" accept="application/json,.json"><div class="actions"><button id="v14RecoveryInspect" type="button">データを確認する</button><button id="v14RecoveryReselect" type="button" class="ghost">ファイルを選び直す</button></div><div id="v14RecoverySummary" class="phase2-message"></div><div id="v14RecoveryConflicts"></div><div id="v14RecoveryActions" hidden><button id="v14RecoveryBackup" type="button">統合前バックアップを作成</button><button id="v14RecoveryDownload" type="button" class="secondary" disabled>バックアップJSONをダウンロード</button><label class="check-label"><input id="v14RecoveryConfirm" type="checkbox" disabled>内容を確認しました。統合します。</label><button id="v14RecoveryApply" type="button" disabled>現在の端末データへ統合する</button></div><div id="v14RecoveryMessage" class="phase2-message"></div>';
    const archive=document.createElement('section');archive.className='card drive-card';archive.id='v14ArchiveCard';archive.innerHTML='<h2>競合・退避データ</h2><p class="note">現在使用していないデータも、復旧に使えるよう退避しています。必要なものは復元でき、不要と判断したものだけ完全削除できます。</p><div id="v14ArchiveSummary"></div><div id="v14ArchiveList"></div><div class="actions"><button id="v14ArchiveRefresh" type="button" class="secondary">一覧を更新</button><button id="v14ArchiveDelete" type="button" class="danger">選択した退避データを完全削除</button></div><div id="v14ArchiveMessage" class="phase2-message"></div>';
    backupPanel.append(card,archive);
    let selectedState=null,plan=null,choices={},beforeRaw=null,backup=null,backupName='';
    const reset=()=>{selectedState=null;plan=null;choices={};beforeRaw=null;backup=null;backupName='';$('v14RecoverySummary').textContent='';$('v14RecoveryConflicts').innerHTML='';$('v14RecoveryActions').hidden=true;$('v14RecoveryDownload').disabled=true;$('v14RecoveryConfirm').checked=false;$('v14RecoveryConfirm').disabled=true;$('v14RecoveryApply').disabled=true;$('v14RecoveryMessage').textContent='';};
    const ready=()=>plan&&plan.conflicts.every(c=>choices[c.id]);
    function renderConflictList(){const box=$('v14RecoveryConflicts');box.innerHTML=plan.conflicts.length?'<h3>要確認</h3>'+plan.conflicts.map(c=>`<button type="button" class="v14-conflict-row ${choices[c.id]?'resolved':''}" data-v14-conflict="${esc(c.id)}"><span>${esc(c.date||'設定')}</span><strong>${esc(diffSummary(c))}</strong><small>${choices[c.id]?'確認済み':'未確認'}</small></button>`).join(''):'';box.querySelectorAll('[data-v14-conflict]').forEach(btn=>btn.onclick=async()=>{const c=plan.conflicts.find(x=>x.id===btn.dataset.v14Conflict);const v=await chooseConflict(c,{local:'現在の端末',remote:'復旧データ'});if(v){choices[c.id]=v;renderConflictList();if(ready())$('v14RecoveryBackup').disabled=false;}});}
    $('v14RecoveryInspect').onclick=()=>{reset();const f=$('v14RecoveryFile').files?.[0];if(!f){$('v14RecoveryMessage').textContent='復旧するJSONファイルを選択してください。';return;}const r=new FileReader();r.onload=()=>{try{selectedState=DI().ensureState(sourceState(JSON.parse(String(r.result||''))));const cur=currentState();plan=DI().buildMergePlan(cur,selectedState);beforeRaw=STORAGE().getPrimaryRaw();$('v14RecoverySummary').textContent=`現在 ${cur.entries.length}件 / 復旧データ ${selectedState.entries.length}件 / 自動追加 ${plan.addRemote.length}件 / 要確認 ${plan.conflicts.length}件`;renderConflictList();$('v14RecoveryActions').hidden=false;$('v14RecoveryBackup').disabled=!ready();$('v14RecoveryMessage').textContent='比較が完了しました。まだ現在のデータは変更していません。';}catch(e){$('v14RecoveryMessage').textContent=e.message||String(e);}};r.onerror=()=>{$('v14RecoveryMessage').textContent='ファイルを読み込めませんでした。';};r.readAsText(f);};
    $('v14RecoveryReselect').onclick=()=>{reset();$('v14RecoveryFile').value='';$('v14RecoveryFile').click();};
    $('v14RecoveryBackup').onclick=()=>{try{if(!ready())throw new Error('要確認の競合をすべて確認してください。');const now=STORAGE().getPrimaryRaw();if(now!==beforeRaw)throw new Error('比較後に端末データが変更されました。もう一度データを確認してください。');const stamp=DI().jstNow();backup={backupFormat:'taxi-pay-before-built-in-recovery-v1',createdAtJst:stamp,state:beforeRaw?JSON.parse(beforeRaw):null};localStorage.setItem(BEFORE_RECOVERY_KEY(),JSON.stringify(backup));backupName=`taxi-pay-before-recovery-${stamp.replace(/[:+]/g,'-')}.json`;$('v14RecoveryDownload').disabled=false;$('v14RecoveryConfirm').disabled=false;$('v14RecoveryMessage').textContent='統合前バックアップを端末内に作成しました。必要ならJSONも保存してください。';}catch(e){$('v14RecoveryMessage').textContent=e.message;}};
    $('v14RecoveryDownload').onclick=()=>{if(backup)download(backupName,backup);};
    $('v14RecoveryConfirm').onchange=()=>{$('v14RecoveryApply').disabled=!($('v14RecoveryConfirm').checked&&backup&&ready());};
    $('v14RecoveryApply').onclick=()=>{let wrote=false;try{if(!backup||!ready())throw new Error('バックアップと競合確認を完了してください。');if(STORAGE().getPrimaryRaw()!==beforeRaw)throw new Error('比較後に端末データが変更されました。もう一度確認してください。');const merged=DI().applyMergePlan(plan,choices,DI().deviceContext());STORAGE().save(merged,'manual-recovery-merge');wrote=true;const check=JSON.parse(STORAGE().getPrimaryRaw()||'{}');if(!Array.isArray(check.entries)||!Array.isArray(check.dataArchive))throw new Error('統合後の検証に失敗しました。');$('v14RecoveryMessage').textContent=`統合が完了しました。現在 ${check.entries.length}件、退避 ${check.dataArchive.length}件です。`;renderArchive();}catch(e){if(wrote){try{if(beforeRaw===null)localStorage.removeItem(STORAGE().primaryKey);else localStorage.setItem(STORAGE().primaryKey,beforeRaw);}catch{}}$('v14RecoveryMessage').textContent=`統合に失敗しました。${e.message||e}`;}};
    function renderArchive(){let s;try{s=currentState();}catch(e){$('v14ArchiveMessage').textContent=e.message;return;}const rows=s.dataArchive||[];$('v14ArchiveSummary').textContent=`退避データ：${rows.length}件`;$('v14ArchiveList').innerHTML=rows.length?rows.slice().reverse().map(a=>{const d=archiveDisplay(a);return `<label class="v14-archive-row"><input type="checkbox" data-v14-archive="${esc(a.archiveId)}"><span><strong>${esc(d.title)}</strong><small>${esc(d.kind)} / ${esc(d.reason)} / ${esc(d.archivedAt)}</small></span></label>`;}).join(''):'<p class="note">退避データはありません。</p>';}
    $('v14ArchiveRefresh').onclick=renderArchive;$('v14ArchiveDelete').onclick=()=>{const ids=[...document.querySelectorAll('[data-v14-archive]:checked')].map(x=>x.dataset.v14Archive);if(!ids.length){$('v14ArchiveMessage').textContent='削除する退避データを選択してください。';return;}if(!confirm(`${ids.length}件の退避データを完全削除します。データ本体は復元できなくなります。続行しますか？`))return;try{const s=DI().permanentlyDeleteArchives(currentState(),ids,DI().deviceContext());STORAGE().save(s,'archive-permanent-delete');$('v14ArchiveMessage').textContent='選択した退避データを完全削除しました。削除記録のみ保持します。';renderArchive();}catch(e){$('v14ArchiveMessage').textContent=e.message||String(e);}};
    renderArchive();
  }
  window.TaxiPayRecoveryV14={resolveStates,sourceState,installBuiltInRecovery};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',installBuiltInRecovery):installBuiltInRecovery();
})();
