# Phase5・6 Google Drive設定

## 目的
利用者本人のGoogle Driveに `給与シミュレーター/current.json` と世代バックアップを保存します。運営サーバーには給与・勤務データを保存しません。

## Google Cloud Console側
1. Google Drive APIを有効化します。
2. OAuth同意画面を設定します。
3. OAuth 2.0 クライアントID「ウェブ アプリケーション」を作成します。
4. 承認済みのJavaScript生成元に、本番のGitHub Pages URLとテストURLを登録します。
5. `google-drive-config.js` の `clientId` にクライアントIDを設定します。

## 使用スコープ
`https://www.googleapis.com/auth/drive.file`

アプリが作成・選択したファイルだけを扱う最小権限です。

## 保存仕様
- 最新: `給与シミュレーター/current.json`
- 世代: `給与シミュレーター/backup-YYYYMMDD-HHMMSS-JST.json`
- 復元直前: `給与シミュレーター/before-restore-YYYYMMDD-HHMMSS-JST.json`
- 日時はすべて日本標準時（Asia/Tokyo）です。
- Drive未接続・オフライン時もlocalStorageへの保存を継続します。
