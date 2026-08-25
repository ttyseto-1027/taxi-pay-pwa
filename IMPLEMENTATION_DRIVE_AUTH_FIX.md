# Drive権限取得エラー修正
Build: 20260820-04
作成日時: 2026/08/20 13:24:46 JST

- `ensureDriveAccess is not defined` を修正。
- Drive権限取得関数をDrive同期モジュールの正しいスコープへ配置。
- 同期ボタンを押した場合だけFirebase Google認証へ `drive.file` の追加権限を要求。
- Google Cloud側のDrive API有効化は別途一度だけ必要。
