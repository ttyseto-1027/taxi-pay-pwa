# Phase 4 公開前仕上げ

## 確定した変更
- 組合員向け画面は「売上目標管理」に集中する。
- 休憩タイマーおよび連続運転管理は現時点では実装しない。
- 給与計算に必要な通常休憩・深夜休憩の入力欄は勤務実績に残す。
- 「今月の目標手取り」を中心に、進捗と必要営収を表示する。

## データ保存
目標手取りは給与月ごとに利用者端末の localStorage に保存する。

## 認証保護
firebase-auth.js、firebase-config.js、boot.js、diagnostics.js、firestore.rulesは変更していない。
