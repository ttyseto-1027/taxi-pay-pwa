# タクシー給与シミュレーター データベース設計書 Version 1.0

## 1. 保存方式

初期版ではブラウザのlocalStorageにJSON形式で保存する。

将来的にデータ量が増加した場合、IndexedDBへの移行を検討する。

## 2. ルート構造

```json
{
  "settings": {},
  "entries": [],
  "history": []
}
```

## 3. settings

利用者設定および管理者設定を保持する。

|項目|型|説明|
|---|---|---|
|shiftType|string|勤務区分|
|taxRate|number|消費税率|
|fareRevisionCoefficient|number|運賃改定係数|
|payRevenueCoefficient|number|給与算定係数|
|commissionARate|number|歩合給A率|
|commissionBRate|number|歩合給B率|
|commissionBThreshold|number|B開始額|
|commissionBMax|number|B最高算定額|
|modelWorkAllowance|number|模範勤務手当/月|
|accidentFreeAllowance|number|無事故手当/乗務|
|violationFreeAllowance|number|無違反手当/乗務|
|legalOvertimeRate|number|法定超時間外割増率|
|scheduledOvertimeRate|number|所定超時間外割増率|
|over60Rate|number|月60時間超割増率|
|statutoryHolidayRate|number|法定休日割増率|
|nonStatutoryHolidayRate|number|法定外休日割増率|
|nightRate|number|深夜割増率|
|healthInsurance|number|健康保険|
|pension|number|厚生年金|
|employmentInsurance|number|雇用保険|
|incomeTax|number|所得税|
|residentTax|number|住民税|
|otherDeduction|number|その他控除|

## 4. entries

日報データを配列で保持する。

|項目|型|説明|
|---|---|---|
|id|string|日報ID|
|date|string|勤務日 YYYY-MM-DD|
|payrollMonth|string|給与対象月 YYYY-MM|
|grossRevenue|number|税込営収|
|netRevenue|number|税抜営収|
|startTime|string|出庫時刻 HH:MM|
|endTime|string|帰庫時刻 HH:MM|
|normalBreakMinutes|number|通常休憩 分|
|nightBreakMinutes|number|深夜休憩 分|
|holidayType|string|通常/法定休日/法定外休日|
|hasAccident|boolean|事故あり|
|hasViolation|boolean|違反あり|
|memo|string|メモ|

### 4.1 holidayType値

|値|意味|
|---|---|
|normal|通常|
|statutory|法定休日|
|nonstatutory|法定外休日|

## 5. history

給与締め履歴を配列で保持する。

|項目|型|説明|
|---|---|---|
|id|string|履歴ID|
|payrollMonth|string|給与対象月|
|periodStart|string|対象開始日|
|periodEnd|string|対象終了日|
|closedAt|string|締め実行日時|
|summary|object|締め時点の集計結果|

## 6. summary構造

|項目|型|説明|
|---|---|---|
|grossRevenue|number|税込営収合計|
|netRevenue|number|税抜営収合計|
|payRevenue|number|給与算定営業収入|
|commissionA|number|歩合給A|
|commissionB|number|歩合給B|
|allowances|number|諸手当|
|premiumPay|number|割増賃金|
|grossPay|number|概算総支給|
|deductions|number|控除合計|
|takeHome|number|概算手取り|
|shiftCount|number|勤務回数|
|workMinutes|number|実働分数|
|overtimeMinutes|number|時間外分数|
|nightMinutes|number|深夜分数|

## 7. バージョン管理

localStorageキーは、データ構造変更時にバージョンを上げる。

例：

- taxiPayPwaStateV1
- taxiPayPwaStateV2
- taxiPayPwaStateV5

アプリ起動時に旧バージョンデータを読み取り、最新構造へ変換する。

## 8. バックアップ方針

初期版ではCSV出力により日報データを外部保存できる。

将来的にはJSONバックアップ出力・読込機能を追加する。

## 9. データ削除方針

給与締め後のデータ削除は慎重に扱う。

初期版では履歴保存を優先し、削除する場合は確認ダイアログを表示する。

## 10. 個人情報方針

氏名、社員番号、住所などの直接識別情報は初期版では保存しない。
