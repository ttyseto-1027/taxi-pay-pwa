# システム情報 認証復旧

Build: `20260819-06`  
作成日時: `2026/08/19 12:33:44 JST`

## 障害原因

Service Worker診断を追加した際に `system-info.js` を全面置換し、
既存のFirebase認証・管理者権限判定を削除してしまった。

その結果、`body.auth-checking` を解除する処理が実行されず、
F5更新後に「ログイン状態を確認しています…」のまま停止した。

## 復旧内容

- Firebase Authを復元
- `onAuthStateChanged` を復元
- Firestore `admins/{uid}` による管理者判定を復元
- 認証成功後のみシステム情報画面を表示
- 認証失敗時はGoogleログイン画面を表示
- Service Worker診断は認証処理の後に実行
- Service Worker → Cache Storage の順で診断
- 「情報を再取得」で診断を再実行
- PWAキャッシュ再構築も維持

勤務実績・利用者情報・Firestoreデータは変更しない。
