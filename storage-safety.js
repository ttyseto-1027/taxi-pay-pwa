'use strict';
(function(root, factory){
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TaxiPayStorageSafety = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root){
  const storage = root.localStorage;
  const path = String(root.location?.pathname || '');
  const isDevelop = path.includes('taxi-pay-pwa-develop');
  const primaryKey = isDevelop ? 'taxiPayPwaDevelopStateV10' : 'taxiPayPwaStateV10';
  const productionVersionKeys = Array.from({length:10}, (_,i)=>`taxiPayPwaStateV${10-i}`);
  const developVersionKeys = Array.from({length:10}, (_,i)=>`taxiPayPwaDevelopStateV${10-i}`);
  // DEVELOPは本番キーを自動読込しない。救出はrescue-readonly.htmlだけが読取専用で行う。
  const legacyKeys = isDevelop ? developVersionKeys : productionVersionKeys;
  const recoveryKey = isDevelop ? 'taxiPayDevelopRecoverySnapshotsV1' : 'taxiPayRecoverySnapshotsV1';
  const diagnosticKey = isDevelop ? 'taxiPayDevelopStorageDiagnosticsV1' : 'taxiPayStorageDiagnosticsV1';
  const MAX_SNAPSHOTS = 5;
  const MAX_LOGS = 80;
  let health = {writeBlocked:false, reason:'', sourceKey:'', errors:[], foundKeys:[]};

  function now(){ return new Date().toISOString(); }
  function safeParse(raw){ try { return {ok:true,value:JSON.parse(raw)}; } catch(error){ return {ok:false,error}; } }
  function read(key){ try { return storage.getItem(key); } catch(error){ return null; } }
  function writeDiagnostic(event, detail={}){
    try{
      const old=safeParse(storage.getItem(diagnosticKey)||'[]');
      const rows=old.ok && Array.isArray(old.value) ? old.value : [];
      rows.push({at:now(),event,...detail});
      storage.setItem(diagnosticKey, JSON.stringify(rows.slice(-MAX_LOGS)));
    }catch{}
  }
  function snapshotRaw(raw, sourceKey, reason){
    if (!raw) return;
    const parsed=safeParse(raw);
    if (!parsed.ok) return;
    try{
      const old=safeParse(storage.getItem(recoveryKey)||'[]');
      const rows=old.ok && Array.isArray(old.value) ? old.value : [];
      const last=rows.at(-1);
      if (last?.raw === raw) return;
      rows.push({at:now(),sourceKey,reason,raw});
      storage.setItem(recoveryKey, JSON.stringify(rows.slice(-MAX_SNAPSHOTS)));
    }catch(error){ writeDiagnostic('snapshot-failed',{message:String(error?.message||error)}); }
  }
  function inspectCandidates(){
    return legacyKeys.map(key=>{
      const raw=read(key);
      if(raw===null) return {key,exists:false,valid:false};
      const p=safeParse(raw);
      const value=p.ok?p.value:null;
      return {key,exists:true,valid:p.ok,rawLength:raw.length,
        entries:p.ok&&Array.isArray(value?.entries)?value.entries.length:null,
        history:p.ok&&Array.isArray(value?.history)?value.history.length:null,
        initialized:p.ok?value?.initialized:null};
    });
  }
  function loadCandidate(){
    const candidates=inspectCandidates();
    const errors=[];
    const valid=[];
    for(const c of candidates){
      if(!c.exists) continue;
      if(!c.valid){ errors.push({key:c.key,reason:'json-parse-error'}); continue; }
      valid.push(c);
    }
    if(valid.length){
      let chosen=valid[0];
      const primary=valid.find(c=>c.key===primaryKey);
      const count=c=>(Number(c.entries)||0)+(Number(c.history)||0);
      // 空の現行キーが先に作られていても、旧キーに勤務・締め履歴が残っていれば旧データを優先する。
      if(primary && count(primary)===0){
        const richer=valid.find(c=>c.key!==primaryKey && count(c)>0);
        if(richer) chosen=richer;
      }
      const raw=read(chosen.key);
      const parsed=safeParse(raw);
      health={writeBlocked:false,reason:'',sourceKey:chosen.key,errors,foundKeys:candidates.filter(x=>x.exists).map(x=>x.key)};
      if(chosen.key!==primaryKey){
        snapshotRaw(raw,chosen.key,'before-version-migration');
        writeDiagnostic('legacy-state-selected',{sourceKey:chosen.key,primaryKey,reason:primary&&count(primary)===0?'primary-empty-legacy-has-data':'primary-missing-or-invalid'});
      } else writeDiagnostic('primary-state-loaded',{sourceKey:chosen.key});
      return {data:parsed.value,health:{...health},sourceKey:chosen.key,raw};
    }
    if(errors.length){
      health={writeBlocked:true,reason:'existing-state-unreadable',sourceKey:'',errors,foundKeys:candidates.filter(x=>x.exists).map(x=>x.key)};
      writeDiagnostic('write-blocked',{reason:health.reason,errors});
      return {data:null,health:{...health},sourceKey:'',raw:null};
    }
    health={writeBlocked:false,reason:'new-install',sourceKey:'',errors:[],foundKeys:[]};
    writeDiagnostic('no-existing-state',{});
    return {data:null,health:{...health},sourceKey:'',raw:null};
  }
  function blockWrites(reason, error){
    health={...health,writeBlocked:true,reason:String(reason||'blocked')};
    writeDiagnostic('write-blocked',{reason:health.reason,message:String(error?.message||error||'')});
  }
  function normalizeForSave(value, currentRaw, reason){
    const integrity=root.TaxiPayDataIntegrity;
    if(!integrity?.normalizeBeforeSave) return value;
    let previous={};
    if(currentRaw){
      const parsed=safeParse(currentRaw);
      if(!parsed.ok){
        const err=new Error('保存前の既存データを解析できないため、安全のため保存を停止します。');
        err.code='STORAGE-PREVIOUS-STATE-INVALID';
        blockWrites('previous-state-invalid',err);
        throw err;
      }
      previous=parsed.value;
    }else if(health.sourceKey&&health.sourceKey!==primaryKey){
      const sourceRaw=read(health.sourceKey);
      if(sourceRaw){
        const parsed=safeParse(sourceRaw);
        if(parsed.ok) previous=parsed.value;
      }
    }
    return integrity.normalizeBeforeSave(previous,value,reason,integrity.deviceContext?.()||{});
  }
  function save(value, reason='app-save'){
    if(health.writeBlocked){
      const err=new Error('保存済みデータの読み取りに問題があるため、安全のため保存を停止しました。');
      err.code='STORAGE-WRITE-BLOCKED'; throw err;
    }
    const currentRaw=read(primaryKey);
    const normalized=normalizeForSave(value,currentRaw,reason);
    const nextRaw=JSON.stringify(normalized);
    if(currentRaw && currentRaw!==nextRaw) snapshotRaw(currentRaw,primaryKey,`before:${reason}`);
    if(!currentRaw && health.sourceKey && health.sourceKey!==primaryKey){
      const sourceRaw=read(health.sourceKey); if(sourceRaw) snapshotRaw(sourceRaw,health.sourceKey,`migration:${reason}`);
    }
    storage.setItem(primaryKey,nextRaw);
    const verifiedRaw=read(primaryKey);
    if(verifiedRaw!==nextRaw){
      const err=new Error('保存後のデータ照合に失敗しました。安全のため以後の保存を停止します。');
      err.code='STORAGE-SAVE-VERIFY-FAILED';
      blockWrites('save-verify-failed',err);
      throw err;
    }
    writeDiagnostic('state-saved',{reason,primaryKey,entries:Array.isArray(normalized?.entries)?normalized.entries.length:null,history:Array.isArray(normalized?.history)?normalized.history.length:null,integrityNormalized:normalized!==value});
    health={...health,sourceKey:primaryKey};
    return normalized;
  }
  function getPrimaryRaw(){ return read(primaryKey); }
  function saveRecoverySnapshot(reason='manual'){
    const raw=getPrimaryRaw() || (health.sourceKey?read(health.sourceKey):null);
    if(raw) snapshotRaw(raw,health.sourceKey||primaryKey,reason);
  }
  function getRecoverySnapshots(){
    const p=safeParse(read(recoveryKey)||'[]'); return p.ok&&Array.isArray(p.value)?p.value:[];
  }
  return {primaryKey,legacyKeys,recoveryKey,diagnosticKey,isDevelop,loadCandidate,save,blockWrites,getHealth:()=>({...health}),inspectCandidates,getPrimaryRaw,saveRecoverySnapshot,getRecoverySnapshots};
});
