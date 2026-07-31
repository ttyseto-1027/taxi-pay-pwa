(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  let initialized = false;

  const numberValue = (id, options = {}) => {
    const el = $(id);
    const raw = Number(el?.value || 0);
    const min = options.min ?? 0;
    const max = options.max ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isFinite(raw) || raw < min || raw > max) {
      throw new Error(options.message || `${el?.closest('label')?.childNodes?.[0]?.textContent?.trim() || '入力値'}を確認してください。`);
    }
    if (options.integer && !Number.isInteger(raw)) {
      throw new Error(options.message || '整数で入力してください。');
    }
    return raw;
  };

  const setMessage = (id, text = '', kind = 'info') => {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.dataset.kind = kind;
  };

  const appApi = () => window.TaxiPayAppSettings;

  function fillDeductionForm() {
    if (!$('phase3DeductionForm')) return;
    const settings = appApi()?.get?.();
    if (!settings) return;
    $('phase3DependentCount').value = Number(settings.dependentCount || 0);
    $('phase3ResidentTax').value = Number(settings.residentTax || 0);
    $('phase3UnionFee').value = Number(settings.unionFee || 0);
    $('phase3MutualAidFee').value = Number(settings.mutualAidFee || 0);
    $('phase3OtherDeduction').value = Number(settings.otherDeduction || 0);
    setMessage('phase3DeductionMessage');
  }

  function fillPaidLeaveForm() {
    const settings = appApi()?.get?.();
    if (!settings) return;
    $('phase3PaidLeaveDailyRate').value = Number(settings.paidLeaveDailyRate || 0);
    $('phase3PaidLeaveOpeningBalance').value = Number(settings.paidLeaveOpeningBalance || 0);
    $('phase3PaidLeaveNextGrantDate').value = settings.paidLeaveNextGrantDate || '';
    $('phase3PaidLeaveNextGrantDays').value = Number(settings.paidLeaveNextGrantDays || 0);
    const balance = appApi()?.getPaidLeaveBalance?.();
    $('phase3PaidLeaveCurrentBalance').textContent = `${Number(balance || 0)}日`;
    renderPaidLeaveHistory(settings);
    setMessage('phase3PaidLeaveMessage');
  }

  function renderPaidLeaveHistory(settings) {
    const root = $('phase3PaidLeaveHistory');
    if (!root) return;
    const grants = Array.isArray(settings.paidLeaveAppliedGrants) ? settings.paidLeaveAppliedGrants : [];
    const usage = Array.isArray(settings.paidLeaveUsageHistory) ? settings.paidLeaveUsageHistory : [];
    const rows = [
      ...grants.map(item => ({ date: item.date || '', label: '付与', amount: `+${Number(item.days || 0)}日` })),
      ...usage.map(item => ({ date: item.closedAt || item.month || '', label: `${item.month || ''} 使用`, amount: `-${Number(item.days || 0)}日` }))
    ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    root.innerHTML = rows.length
      ? rows.slice(0, 20).map(row => `<div class="phase3-history-row"><span>${row.label}</span><strong>${row.amount}</strong></div>`).join('')
      : '<p class="note">有給の付与・使用履歴はまだありません。</p>';
  }

  function saveDeductions(event) {
    event.preventDefault();
    try {
      const values = {
        dependentCount: numberValue('phase3DependentCount', { min: 0, max: 20, integer: true, message: '扶養人数は0～20人の整数で入力してください。' }),
        residentTax: numberValue('phase3ResidentTax'),
        unionFee: numberValue('phase3UnionFee'),
        mutualAidFee: numberValue('phase3MutualAidFee'),
        otherDeduction: numberValue('phase3OtherDeduction')
      };
      appApi().update(values);
      setMessage('phase3DeductionMessage', '控除設定を端末に保存しました。', 'success');
    } catch (error) {
      setMessage('phase3DeductionMessage', error.message || '入力内容を確認してください。', 'error');
    }
  }

  function savePaidLeave(event) {
    event.preventDefault();
    try {
      const values = {
        paidLeaveDailyRate: numberValue('phase3PaidLeaveDailyRate'),
        paidLeaveOpeningBalance: numberValue('phase3PaidLeaveOpeningBalance', { min: 0, max: 100 }),
        paidLeaveNextGrantDate: $('phase3PaidLeaveNextGrantDate').value || '',
        paidLeaveNextGrantDays: numberValue('phase3PaidLeaveNextGrantDays', { min: 0, max: 100 })
      };
      appApi().update(values);
      fillPaidLeaveForm();
      setMessage('phase3PaidLeaveMessage', '有給設定を端末に保存しました。', 'success');
    } catch (error) {
      setMessage('phase3PaidLeaveMessage', error.message || '入力内容を確認してください。', 'error');
    }
  }

  function exportSettings() {
    try {
      const payload = appApi().exportPersonalSettings();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `taxi-pay-personal-settings-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('phase3BackupMessage', '設定ファイルを保存しました。', 'success');
    } catch (error) {
      setMessage('phase3BackupMessage', '設定ファイルを作成できませんでした。', 'error');
    }
  }

  function importSettings(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 200 * 1024) {
      setMessage('phase3BackupMessage', '設定ファイルが大きすぎます。', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result || ''));
        appApi().importPersonalSettings(payload);
        fillDeductionForm();
        fillPaidLeaveForm();
        setMessage('phase3BackupMessage', '設定を復元しました。', 'success');
      } catch (error) {
        setMessage('phase3BackupMessage', error.message || '設定ファイルを読み込めませんでした。', 'error');
      }
    };
    reader.onerror = () => setMessage('phase3BackupMessage', '設定ファイルを読み込めませんでした。', 'error');
    reader.readAsText(file, 'utf-8');
  }

  function initialize() {
    if (initialized || !appApi()) return;
    initialized = true;
    $('phase3DeductionForm')?.addEventListener('submit', saveDeductions);
    $('phase3PaidLeaveForm')?.addEventListener('submit', savePaidLeave);
    $('phase3ExportSettings')?.addEventListener('click', exportSettings);
    $('phase3ImportSettings')?.addEventListener('change', importSettings);
    fillDeductionForm();
    fillPaidLeaveForm();
    window.addEventListener('taxipay:personal-settings-updated', () => {
      fillDeductionForm();
      fillPaidLeaveForm();
    });
  }

  window.addEventListener('taxipay:profile', initialize);
  window.addEventListener('taxipay:app-ready', initialize);
})();
