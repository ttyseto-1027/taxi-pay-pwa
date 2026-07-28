# Phase 1-01 共通メニュー基盤

## 基準
Phase 0-07（PC・iPhoneログイン動作確認済み）をそのまま基準コードとして使用。

## 変更ファイル
- index.html
- styles.css
- sw.js
- menu.js（新規）

## 実装内容
- 右上の共通メニュー
- ホーム、勤務実績、月次集計・給与シミュレーターへの移動
- 有給管理、控除額設定、設定への入口
- 利用者情報、お知らせ、ヘルプの表示
- メニュー内ログアウト

## 維持したファイル
- firebase-auth.js
- firebase-config.js
- boot.js
- app.js
- v13-features.js
- diagnostics.js

認証・Firestore利用者確認・給与計算ロジックには変更を加えていない。
