# Phase 3 個人設定 実装記録

## 実装範囲
- 扶養親族等の数
- 住民税
- 組合費
- 共済費
- その他控除
- 有給の標準報酬日額、開始残数、次回付与日、次回付与日数
- 現在の有給残数と付与・使用履歴
- 個人設定JSONの保存・復元

## 保存先
給与計算の既存データ構造 `taxiPayPwaStateV10.settings` を使用し、利用者端末の localStorage に保存する。
Firebase/Firestoreには個人の控除額・扶養人数・有給設定を保存しない。

## Phase 2の確定仕様
利用者情報は一般利用者には表示のみ。変更は管理者が行う。扶養人数はPhase 3へ移動した。

## 認証保護
firebase-auth.js、firebase-config.js、boot.js、diagnostics.js、firestore.rulesは変更していない。
Phase 3スクリプトは認証完了イベント後に初期化する。
