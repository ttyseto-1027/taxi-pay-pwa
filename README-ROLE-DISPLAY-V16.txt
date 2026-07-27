組合員・乗務員番号表示修正 v16（2026-07-27 JST）

原因
- 認証側は最新のbetaAllowlist情報を取得していた
- v13-features.jsがsessionStorage内の古い
  「未登録・非組合員」プロフィールを使用していた
- 認証イベントがスクリプト読込前に発火すると、
  最新プロフィールを受信できない場合があった

修正
- 認証側の最新プロフィールをwindowとsessionStorageへ保存
- v13-features.jsはwindowの最新プロフィールを最優先
- profile/app-ready両イベントを受信
- スクリプト読込後と500ms後にも最新プロフィールを再確認
- unionStatusを正規化
- ログアウト時に古いプロフィールを削除
