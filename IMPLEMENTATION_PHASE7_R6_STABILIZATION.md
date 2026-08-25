# Phase7 r6 安定化修正

- ユーザー管理画面から旧お知らせ管理処理を除去
- お知らせ管理を `announcement.html` / `announcement-admin.js` に完全分離
- `admin.js` のログイン後初期化はユーザー管理データだけを読み込む
- お知らせ管理画面のHTML要素存在確認を追加
- Service Workerへ `announcement-admin.js` を追加
- キャッシュ版を `taxi-pay-v1.4-beta-20260805-phase7-r6` に更新
- Firebase Authentication、既存Firestore文書、localStorage保存形式は変更しない
