# Phase7.5 更新通知・最新版取得 修正 r6

Build: `20260819-02`  
作成日時: `2026/08/19 00:47:15 JST`

## 修正
- 更新通知を認証画面などの再描画領域から外し、body直下に固定
- 「通知を一度表示したか」ではなく、実際に読み込まれているBuildと最新Buildを比較
- 古いBuildのままなら通知を消さない
- 更新ボタン押下時にアプリ用Cache Storageを削除
- Service Workerのupdateを明示実行
- 更新後は必ず `index.html` をタイムスタンプ付きURLで取得
- Service Worker登録時に `updateViaCache: 'none'` を使用
- Service Workerの `SKIP_WAITING` メッセージに対応
- ページ復帰時・pageshow時にも最新版確認

勤務実績・控除設定・利用者情報などのLocalStorage/Firestoreデータは削除しません。
