# Phase7.5 運用基盤完成版

- Version: 1.4β
- Build: 20260806-02
- Cache: taxi-pay-v1.4-beta-20260806-02-phase75
- Environment: URLからDEVELOP / PRODUCTIONを自動判定
- JST基準

## 実装
- Version・Build・Environmentの共通表示
- 最新Build自動判定と更新案内
- ログイン画面の自己復旧ボタン
- Service Worker／旧キャッシュの再構築
- 管理者向けシステム情報画面
- 利用者ごとの複数端末情報（180日）
- ログイン履歴（60日）
- ユーザー名クリックによる詳細表示
- 既存診断ログコピーの維持・Build情報強化

## データ保護
既存の勤務実績、控除設定、利用者情報、localStorageキーを削除・初期化しません。

## Firebaseルール
`users/{uid}/devices` と `users/{uid}/loginHistory` を追加したため、同梱の firestore.rules の反映が必要です。
