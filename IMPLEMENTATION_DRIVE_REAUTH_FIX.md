# Google Drive権限取得を再認証方式へ変更

Build: `20260820-06`
作成日時: `2026/08/20 14:53:47 JST`

## 原因
Build 20260820-05 では、
- 旧CustomEvent方式
- 新しい直接呼び出し方式
のDrive認証処理が併存していた。

また、Googleログイン済みの状態で `signInWithPopup()` を使っていたため、
通常のログイン状態変更処理を再度動かす可能性があった。

## 修正
- 旧CustomEvent方式を削除
- Drive認証経路を1本化
- 現在ログイン中のFirebase userに対して
  `reauthenticateWithPopup()` で `drive.file` を追加要求
- 異なるGoogleアカウントを選択した場合は停止

Google Drive API：有効化済み
OAuth scope：drive.file
