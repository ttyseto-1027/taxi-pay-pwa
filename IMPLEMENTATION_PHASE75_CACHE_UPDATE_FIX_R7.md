# Phase7.5 キャッシュ更新修正 r7

Build: `20260819-05`  
作成日時: `2026/08/19 12:27:27 JST`

## 今回特定した不整合

前回の差分版では `app-meta.js` / `app-meta.json` のBuildを更新した一方、
すべての実行HTMLを差分ZIPへ含めていなかったため、
ページによって古い `?v=` の参照が残る状態が発生し得た。

その結果、
- サーバー上の最新Buildは新しい
- ブラウザが読み込む `app-meta.js` は古い
- 「新しいバージョンがあります」が消えない

という不整合が起きた。

## 修正

- Build更新時は実行HTMLをすべて同じBuildへ同期
- 差分ZIPにも `index.html / admin.html / announcement.html / system-info.html` を必ず含める
- `app-meta.js / app-meta.json / phase75-ops.js / sw.js` を同一Buildで配布
- 更新クリック後は、再読込後の実Buildが対象Build以上になったことを確認してから成功表示
- 対象Buildを取得できていなければ通知を消さず「再試行」にする
- HTMLナビゲーション、app-meta、phase75-ops、swはService Worker側でも `no-store`
- Service Worker更新時は `updateViaCache: 'none'`

勤務実績・Firestore・利用者情報は変更しない。
