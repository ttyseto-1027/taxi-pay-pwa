# データ設計書 Version 1.1

## settings
- shiftType: string
- taxRate, fareRevisionCoefficient, payRevenueCoefficient: number
- 各手当額・割増率: number
- healthInsurance, pension, employmentInsurance, residentTax, unionFee, mutualAidFee, otherDeduction: number
- dependentCount: integer
- withholdingCategory: "A" | "B"
- paidLeaveDays, paidLeaveDailyRate: number

## entries
- id: UUID string
- date: YYYY-MM-DD
- grossRevenue: integer
- clockIn, clockOut: HH:mm
- normalBreakMinutes, nightBreakMinutes: integer
- holidayType: normal | statutory | nonstatutory
- hadAccident, hadViolation: boolean

## history
- month, shiftType, periodStart, periodEnd
- gross, commission, takeHome, count, closedAt

## 保存方式
LocalStorageキー `taxiPayPwaStateV8`。旧版キーから読み込んだ場合は不足項目を初期値で補完する。
