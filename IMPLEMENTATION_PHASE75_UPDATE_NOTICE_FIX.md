# Phase7.5 最新版通知の残留修正

Build: `20260817-03`

## 現象
「キャッシュを更新して最新版を取得」を押すと最新版へ更新されるが、
「新しいバージョンがあります」の通知が画面に残り続けることがあった。

## 原因
`app-meta.js` と `phase75-ops.js` の読み込みURLに古い固定クエリが残っており、
ブラウザのHTTPキャッシュから旧Build情報を再利用する場合があった。

## 修正
- 全HTMLで `app-meta.js` / `phase75-ops.js` の読み込みクエリをBuild `20260817-03` に統一
- 更新ボタン押下時に通知を即時非表示
- PWAキャッシュとService Workerを削除後、キャッシュバスター付きURLへ遷移
- 最新Buildと一致している場合は残留通知を自動削除
- Service Workerキャッシュ版を `taxi-pay-v1.4-beta-20260817-03-update-notice-fix` に更新

勤務実績・利用者情報・Firestoreデータには変更なし。
