# システム情報 Service Worker・キャッシュ診断修正

Build: `20260819-04`  
作成日時: `2026/08/19 12:18:17 JST`

## 診断順序

1. Service Worker登録処理を実行
2. 登録完了または登録失敗を確定
3. Service Worker状態を取得
4. Cache Storage一覧を取得
5. システム情報画面へ表示

「情報を再取得」ボタンでも上記処理を最初から再実行する。

## 表示

Service Workerは以下を区別する。

- 登録中…
- 登録済み
- 登録失敗
- 非対応

登録済みの場合は、
`active / activated`
`waiting / installed`
`installing / installing`
などWorker状態も表示する。

## PWAキャッシュ再構築

アプリ用Cache Storageを削除し、
Service Workerの登録・更新処理を再実行してから
診断情報を再取得する。

勤務実績・利用者情報・Firestoreデータは変更しない。
