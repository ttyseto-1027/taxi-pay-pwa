# Google Drive権限画面が開かない問題の修正

Build: `20260820-05`
作成日時: `2026/08/20 14:45:40 JST`

## 修正
DriveバックアップボタンからFirebase認証側の
`TaxiPayRequestDriveAuthorization()` を直接呼び出す。

CustomEventを経由せず、
利用者のクリック操作から `signInWithPopup()` までを直接つなぐ。

Google Drive APIは有効化済み、
OAuthスコープは `drive.file` を使用する。
