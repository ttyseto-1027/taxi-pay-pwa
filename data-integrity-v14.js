(function(root,factory){
  const api=factory(root||{});
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TaxiPayDataIntegrity=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const META_KEYS=new Set(['createdAtJst','updatedAtJst','createdDeviceId','createdDeviceName','createdBrowser','updatedDeviceId','updatedDeviceName','updatedBrowser']);
  const clone=x=>JSON.parse(JSON.stringify(x));
  const uuid=()=>root.crypto?.randomUUID?.()||`di-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  function jstNow(date=new Date()){
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`;
  }
  function browserName(ua=String(root.navigator?.userAgent||'')){
    if(/CriOS|Chrome/i.test(ua))return 'Chrome';
    if(/FxiOS|Firefox/i.test(ua))return 'Firefox';
    if(/EdgiOS|Edg/i.test(ua))return 'Edge';
    if(/Safari/i.test(ua))return 'Safari';
    return 'その他';
  }
  function osName(ua=String(root.navigator?.userAgent||'')){
    if(/Android/i.test(ua))return 'Android';
    if(/iPhone|iPad|iPod/i.test(ua))return 'iOS';
    if(/Windows/i.test(ua))return 'Windows';
    if(/Macintosh|Mac OS X/i.test(ua))return 'macOS';
    return 'その他';
  }
  function deviceId(){
    const key='taxiPayDeviceIdV1';
    try{let id=root.localStorage?.getItem(key)||'';if(!id){id=uuid();root.localStorage?.setItem(key,id);}return id;}catch{return `temporary-${Date.now()}`;}
  }
  function deviceName(){try{return String(root.localStorage?.getItem('taxiPayDeviceNameV2')||'').trim();}catch{return '';}}
  function deviceContext(){return{deviceId:deviceId(),deviceName:deviceName(),browser:browserName(),os:osName()};}
  function stripMeta(value){
    if(Array.isArray(value))return value.map(stripMeta);
    if(!value||typeof value!=='object')return value;
    const out={};
    Object.keys(value).sort().forEach(k=>{if(!META_KEYS.has(k))out[k]=stripMeta(value[k]);});
    return out;
  }
  const fingerprint=value=>JSON.stringify(stripMeta(value));
  const same=(a,b)=>fingerprint(a)===fingerprint(b);
  function ensureState(input){
    const s=input&&typeof input==='object'&&!Array.isArray(input)?clone(input):{};
    if(!Array.isArray(s.entries))s.entries=[];
    if(!Array.isArray(s.history))s.history=[];
    if(!s.settings||typeof s.settings!=='object'||Array.isArray(s.settings))s.settings={};
    if(!Array.isArray(s.dataArchive))s.dataArchive=[];
    if(!Array.isArray(s.conflictHistory))s.conflictHistory=[];
    if(!Array.isArray(s.deletionHistory))s.deletionHistory=[];
    if(!Array.isArray(s.recordTombstones))s.recordTombstones=[];
    return s;
  }
  function archiveFingerprint(a){return `${a.kind||'entry'}|${a.sourceId||''}|${a.workDate||''}|${fingerprint(a.data||{})}`;}
  function addArchive(state,kind,data,reason,ctx={},extra={}){
    if(data==null)return null;
    const c={...deviceContext(),...ctx};
    const row={archiveId:extra.archiveId||uuid(),kind:kind||'entry',sourceId:String(extra.sourceId||data?.id||''),workDate:String(extra.workDate||data?.date||''),archivedAtJst:extra.archivedAtJst||jstNow(),reason:String(reason||'conflict'),deviceId:c.deviceId||'',deviceName:c.deviceName||'',browser:c.browser||'',data:clone(data)};
    const sig=archiveFingerprint(row);
    if(state.dataArchive.some(x=>archiveFingerprint(x)===sig))return state.dataArchive.find(x=>archiveFingerprint(x)===sig);
    state.dataArchive.push(row);return row;
  }
  function addTombstone(state,entry,reason,ctx={}){
    const c={...deviceContext(),...ctx};
    const old=state.recordTombstones.find(x=>x.entryId===entry.id);
    const row={entryId:String(entry.id||''),workDate:String(entry.date||''),deletedAtJst:jstNow(),reason:String(reason||'user-delete'),deviceId:c.deviceId||'',deviceName:c.deviceName||'',browser:c.browser||''};
    if(old)Object.assign(old,row);else state.recordTombstones.push(row);
    return row;
  }
  function decorateEntry(next,prev,ctx={}){
    const c={...deviceContext(),...ctx},now=jstNow();
    const out=clone(next);
    if(prev){
      out.createdAtJst=prev.createdAtJst||now;
      out.createdDeviceId=prev.createdDeviceId||prev.updatedDeviceId||c.deviceId||'';
      out.createdDeviceName=prev.createdDeviceName||prev.updatedDeviceName||c.deviceName||'';
      out.createdBrowser=prev.createdBrowser||prev.updatedBrowser||c.browser||'';
      if(same(prev,next)){
        out.updatedAtJst=prev.updatedAtJst||out.createdAtJst;
        out.updatedDeviceId=prev.updatedDeviceId||out.createdDeviceId;
        out.updatedDeviceName=prev.updatedDeviceName||out.createdDeviceName;
        out.updatedBrowser=prev.updatedBrowser||out.createdBrowser;
      }else{
        out.updatedAtJst=now;out.updatedDeviceId=c.deviceId||'';out.updatedDeviceName=c.deviceName||'';out.updatedBrowser=c.browser||'';
      }
    }else{
      out.createdAtJst=now;out.updatedAtJst=now;out.createdDeviceId=c.deviceId||'';out.updatedDeviceId=c.deviceId||'';out.createdDeviceName=c.deviceName||'';out.updatedDeviceName=c.deviceName||'';out.createdBrowser=c.browser||'';out.updatedBrowser=c.browser||'';
    }
    return out;
  }
  function normalizeBeforeSave(previous,next,reason='app-save',ctx={}){
    const prev=ensureState(previous||{}),out=ensureState(next||{});
    ['dataArchive','conflictHistory','deletionHistory','recordTombstones'].forEach(k=>{if(!Array.isArray(next?.[k])){const existing=prev[k]||[];if(existing.length)out[k]=clone(existing);}});
    const prevById=new Map(prev.entries.filter(x=>x?.id).map(x=>[x.id,x]));
    out.entries=out.entries.map(e=>decorateEntry(e,prevById.get(e.id),ctx));
    const activeIds=new Set(out.entries.map(x=>x?.id).filter(Boolean));
    const movedToHistory=new Set();
    for(const h of out.history||[])for(const e of Array.isArray(h?.dailyEntries)?h.dailyEntries:[])if(e?.id)movedToHistory.add(e.id);
    const explicitMerge=/restore|recovery|merge|import/i.test(String(reason));
    if(!explicitMerge){
      for(const old of prev.entries){
        if(!old?.id||activeIds.has(old.id)||movedToHistory.has(old.id))continue;
        addArchive(out,'entry',old,'active-record-removed',ctx,{sourceId:old.id,workDate:old.date});
        addTombstone(out,old,'active-record-removed',ctx);
      }
    }
    return out;
  }
  function entryDiffs(a,b){
    const aa=stripMeta(a||{}),bb=stripMeta(b||{}),keys=[...new Set([...Object.keys(aa),...Object.keys(bb)])].sort();
    return keys.filter(k=>JSON.stringify(aa[k])!==JSON.stringify(bb[k])).map(k=>({field:k,local:aa[k],remote:bb[k]}));
  }
  function addConflict(arr,obj){if(!arr.some(x=>x.id===obj.id))arr.push(obj);}
  function buildMergePlan(localInput,remoteInput){
    const local=ensureState(localInput),remote=ensureState(remoteInput),conflicts=[],addRemote=[],sameEntries=[];
    const lById=new Map(local.entries.filter(x=>x?.id).map(x=>[x.id,x]));
    const rById=new Map(remote.entries.filter(x=>x?.id).map(x=>[x.id,x]));
    const lByDate=new Map();local.entries.forEach(e=>{if(!lByDate.has(e.date))lByDate.set(e.date,[]);lByDate.get(e.date).push(e)});
    const lTombs=new Map(local.recordTombstones.filter(x=>x?.entryId).map(x=>[x.entryId,x]));
    const rTombs=new Map(remote.recordTombstones.filter(x=>x?.entryId).map(x=>[x.entryId,x]));
    for(const r of remote.entries){
      if(r.id&&lTombs.has(r.id)){
        addConflict(conflicts,{id:`entry-delete:${r.id}`,type:'entry-delete',date:r.date||lTombs.get(r.id).workDate||'',local:null,remote:r,localDeleted:lTombs.get(r.id),diffs:[{field:'削除状態',local:`削除 ${lTombs.get(r.id).deletedAtJst||''}`,remote:'データあり'}]});continue;
      }
      const l=r.id?lById.get(r.id):null;
      if(l){if(same(l,r))sameEntries.push(r);else addConflict(conflicts,{id:`entry:${r.id}`,type:'entry',date:r.date||l.date||'',local:l,remote:r,diffs:entryDiffs(l,r)});continue;}
      const dates=lByDate.get(r.date)||[];
      const exact=dates.find(x=>same(x,r));
      if(exact){sameEntries.push(r);continue;}
      if(dates.length){addConflict(conflicts,{id:`entry-date:${r.date}:${r.id||fingerprint(r).slice(0,24)}`,type:'entry-date',date:r.date||'',local:dates,remote:r,diffs:[{field:'同一勤務日の別データ',local:dates.map(x=>stripMeta(x)),remote:stripMeta(r)}]});continue;}
      addRemote.push(r);
    }
    for(const l of local.entries){
      if(l.id&&rTombs.has(l.id))addConflict(conflicts,{id:`delete-entry:${l.id}`,type:'delete-entry',date:l.date||rTombs.get(l.id).workDate||'',local:l,remote:null,remoteDeleted:rTombs.get(l.id),diffs:[{field:'削除状態',local:'データあり',remote:`削除 ${rTombs.get(l.id).deletedAtJst||''}`}]});
    }
    const settingKeys=[...new Set([...Object.keys(local.settings||{}),...Object.keys(remote.settings||{})])].sort();
    const localEmpty=!local.initialized&&!local.entries.length&&!local.history.length;
    if(!localEmpty)for(const k of settingKeys){if(JSON.stringify(local.settings?.[k])!==JSON.stringify(remote.settings?.[k]))addConflict(conflicts,{id:`setting:${k}`,type:'setting',date:'',field:k,local:clone(local.settings?.[k]),remote:clone(remote.settings?.[k]),diffs:[{field:k,local:clone(local.settings?.[k]),remote:clone(remote.settings?.[k])}]});}
    const lHist=new Map(local.history.filter(x=>x?.month).map(x=>[x.month,x]));
    const addHistory=[];
    for(const rh of remote.history||[]){const lh=lHist.get(rh.month);if(!lh)addHistory.push(rh);else if(!same(lh,rh))addConflict(conflicts,{id:`history:${rh.month}`,type:'history',date:rh.month||'',local:lh,remote:rh,diffs:[{field:'給与締め履歴',local:stripMeta(lh),remote:stripMeta(rh)}]});}
    return{local,remote,localEmpty,conflicts,addRemote,sameEntries,addHistory};
  }
  function applyMergePlan(plan,choices={},ctx={}){
    const out=ensureState(plan.local),remote=ensureState(plan.remote);out.dataArchive=[...(out.dataArchive||[])];
    if(plan.localEmpty)out.settings=clone(remote.settings||{});
    const byId=new Map(out.entries.filter(x=>x?.id).map(x=>[x.id,x]));
    for(const r of plan.addRemote){if(r?.id&&!byId.has(r.id)){out.entries.push(clone(r));byId.set(r.id,r);}}
    const hMonths=new Set(out.history.map(x=>x?.month));for(const h of plan.addHistory)if(!hMonths.has(h.month)){out.history.push(clone(h));hMonths.add(h.month);}
    for(const a of remote.dataArchive||[]){const sig=archiveFingerprint(a);if(!out.dataArchive.some(x=>archiveFingerprint(x)===sig))out.dataArchive.push(clone(a));}
    for(const t of remote.recordTombstones||[])if(!out.recordTombstones.some(x=>x.entryId===t.entryId&&x.deletedAtJst===t.deletedAtJst))out.recordTombstones.push(clone(t));
    for(const d of remote.deletionHistory||[])if(!out.deletionHistory.some(x=>x.archiveId===d.archiveId&&x.deletedAtJst===d.deletedAtJst))out.deletionHistory.push(clone(d));
    for(const c of plan.conflicts){
      const choice=choices[c.id];if(!choice)throw new Error(`未解決の競合があります: ${c.id}`);
      const mode=typeof choice==='string'?choice:choice.mode;
      if(c.type==='entry'){
        let winner;
        if(mode==='fields'){
          winner=clone(c.local);for(const d of c.diffs){const side=choice.fields?.[d.field]||'local';winner[d.field]=clone(side==='remote'?c.remote?.[d.field]:c.local?.[d.field]);}
          addArchive(out,'entry',c.local,'field-merge-source-local',ctx,{sourceId:c.local?.id,workDate:c.date});addArchive(out,'entry',c.remote,'field-merge-source-remote',ctx,{sourceId:c.remote?.id,workDate:c.date});
        }else{winner=clone(mode==='remote'?c.remote:c.local);addArchive(out,'entry',mode==='remote'?c.local:c.remote,'conflict-loser',ctx,{sourceId:(mode==='remote'?c.local:c.remote)?.id,workDate:c.date});}
        out.entries=out.entries.filter(x=>x.id!==c.local.id);out.entries.push(winner);
      }else if(c.type==='entry-date'){
        if(mode==='remote'){
          for(const l of c.local){addArchive(out,'entry',l,'same-date-conflict-loser',ctx,{sourceId:l.id,workDate:c.date});out.entries=out.entries.filter(x=>x.id!==l.id);}out.entries.push(clone(c.remote));
        }else addArchive(out,'entry',c.remote,'same-date-conflict-loser',ctx,{sourceId:c.remote?.id,workDate:c.date});
      }else if(c.type==='entry-delete'){
        if(mode==='remote'){
          out.entries.push(clone(c.remote));
          out.recordTombstones=out.recordTombstones.filter(x=>x.entryId!==c.remote?.id);
        }else addArchive(out,'entry',c.remote,'deleted-state-selected',ctx,{sourceId:c.remote?.id,workDate:c.date});
      }else if(c.type==='delete-entry'){
        if(mode==='remote'){
          addArchive(out,'entry',c.local,'deleted-state-selected',ctx,{sourceId:c.local?.id,workDate:c.date});
          out.entries=out.entries.filter(x=>x.id!==c.local.id);
        }else{
          out.recordTombstones=out.recordTombstones.filter(x=>x.entryId!==c.local?.id);
        }
      }else if(c.type==='setting'){
        if(mode==='remote')out.settings[c.field]=clone(c.remote);else if(mode==='fields')out.settings[c.field]=clone(choice.fields?.[c.field]==='remote'?c.remote:c.local);
        addArchive(out,'setting',{field:c.field,value:clone(mode==='remote'?c.local:c.remote)},'setting-conflict-loser',ctx,{sourceId:c.field});
      }else if(c.type==='history'){
        if(mode==='remote'){out.history=out.history.filter(x=>x.month!==c.local.month);out.history.push(clone(c.remote));addArchive(out,'history',c.local,'history-conflict-loser',ctx,{sourceId:c.local.month});}
        else addArchive(out,'history',c.remote,'history-conflict-loser',ctx,{sourceId:c.remote?.month});
      }
      out.conflictHistory.push({conflictId:c.id,type:c.type,targetDate:c.date||'',resolvedAtJst:jstNow(),selected:mode,deviceId:ctx.deviceId||deviceId(),deviceName:ctx.deviceName||deviceName(),browser:ctx.browser||browserName()});
    }
    out.entries=out.entries.map(e=>decorateEntry(e,plan.local.entries.find(x=>x.id===e.id),ctx));
    return out;
  }
  function buildArchiveRestorePlan(stateInput,archiveId){
    const state=ensureState(stateInput),archive=(state.dataArchive||[]).find(a=>a.archiveId===archiveId);
    if(!archive)throw new Error('選択した退避データが見つかりません。');
    const remote=ensureState(state);
    if(archive.kind==='entry'){
      const row=clone(archive.data||{});
      if(!row.id)throw new Error('退避データに勤務実績IDがありません。');
      remote.entries=remote.entries.filter(x=>x?.id!==row.id);
      remote.entries.push(row);
    }else if(archive.kind==='setting'){
      const field=String(archive.data?.field||archive.sourceId||'');
      if(!field)throw new Error('退避された設定項目を特定できません。');
      remote.settings={...remote.settings,[field]:clone(archive.data?.value)};
    }else if(archive.kind==='history'){
      const row=clone(archive.data||{});
      const month=String(row.month||archive.sourceId||'');
      if(!month)throw new Error('退避された締め履歴の対象月を特定できません。');
      row.month=row.month||month;
      remote.history=remote.history.filter(x=>x?.month!==month);
      remote.history.push(row);
    }else throw new Error('この種類の退避データは復元できません。');
    return{archive,remote,plan:buildMergePlan(state,remote)};
  }
  function permanentlyDeleteArchives(stateInput,archiveIds,ctx={}){
    const state=ensureState(stateInput),ids=new Set(archiveIds||[]),kept=[];
    for(const a of state.dataArchive){
      if(!ids.has(a.archiveId)){kept.push(a);continue;}
      state.deletionHistory.push({archiveId:a.archiveId,targetDate:a.workDate||'',deletedAtJst:jstNow(),deviceId:ctx.deviceId||deviceId(),deviceName:ctx.deviceName||deviceName(),browser:ctx.browser||browserName()});
    }
    state.dataArchive=kept;return state;
  }
  function installStorageGuard(){
    const storage=root.TaxiPayStorageSafety;if(!storage||storage.__v14IntegrityInstalled)return false;
    const original=storage.save.bind(storage);
    storage.save=function(value,reason='app-save'){
      let prev={};try{prev=JSON.parse(storage.getPrimaryRaw()||'{}')}catch{}
      const next=normalizeBeforeSave(prev,value,reason,deviceContext());
      return original(next,reason);
    };
    storage.__v14IntegrityInstalled=true;return true;
  }
  const api={version:1,jstNow,browserName,osName,deviceId,deviceName,deviceContext,stripMeta,fingerprint,same,ensureState,entryDiffs,buildMergePlan,applyMergePlan,addArchive,addTombstone,normalizeBeforeSave,buildArchiveRestorePlan,permanentlyDeleteArchives,installStorageGuard};
  if(root.TaxiPayStorageSafety)installStorageGuard();
  return api;
});
