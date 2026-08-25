# Phase7.5 最新版通知の再表示対策

Build: `20260817-04`

## 修正
更新ボタンで取得した最新Buildを `localStorage` に記録します。

再読込直後に旧 `app-meta.js` がブラウザ側に一時的に残った場合でも、
サーバー側の最新Buildが「更新実行済みBuild」と同じなら最新版通知を再表示しません。

さらに、
- 更新時にPWAキャッシュを削除
- Service Workerを全登録解除
- 更新通知DOMを即時削除
- `app-meta.json` は `no-store` + `no-cache` で取得
- HTML側の `app-meta.js` / `phase75-ops.js` 読込番号をBuildと同期

としています。

Firestore・利用者データ・勤務実績は変更しません。
