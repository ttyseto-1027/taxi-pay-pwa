# Phase 0③ ログアウト後の再ログイン修正

作成日時: 2026-07-28 12:35 JST

## 特定した原因

`routeOnce()` が、前回ログイン完了時の `completedUid` をログアウト後も保持していました。
ログアウト処理では `window.TaxiPayCurrentProfile` を `null` にしていたため、同じGoogleアカウントで再ログインすると `routeOnce()` は処理済みUIDと判断して `null` を返し、利用者確認と `showApp()` を実行しませんでした。

診断ログでは `AUTH-POPUP-OK` と `AUTH-DIRECT-ROUTE` で止まり、`AUTH-STATE-SIGNED-IN` 以降が出ないことが、この分岐と一致します。

## 修正内容

- ログアウト時に `completedUid`、`routingUid`、`routingPromise` をリセット
- `onAuthStateChanged` の未ログイン分岐でも同じ状態をリセット
- `completedUid` が一致してもキャッシュ済みプロフィールが存在しない場合は、利用者確認を再実行
- Service WorkerとJavaScriptのキャッシュ識別子を `phase0-03` に更新

## 変更していない範囲

給与計算、勤務実績、Firestoreのデータ形式、画面構成は変更していません。
