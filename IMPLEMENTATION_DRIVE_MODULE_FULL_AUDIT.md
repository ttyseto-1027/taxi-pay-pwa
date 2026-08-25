# Google Drive モジュール総点検・再構成

Build: `20260820-10`  
作成日時: `2026/08/20 15:23:58 JST`

## 今回の原因

Build 20260820-08 の `phase56-drive-backup.js` では、呼び出しているにもかかわらず
定義が欠落しているDrive内部関数が複数存在していました。

確認対象:
- `api`
- `ensureFolder`
- `findFile`
- `uploadJson`
- `listBackups`
- `deleteFile`
- `cleanupOld`

過去には `disconnect` も同様に欠落していました。

## 対応

Driveモジュールを一つの整合した実装として再構成しました。

実装済み:
- Firebase Google認証で取得した `drive.file` アクセストークン利用
- アプリ専用フォルダの検索・作成
- JSON新規保存
- `current.json` 更新
- 同期1回＝1世代バックアップ
- バックアップ一覧取得（ページング対応）
- 容量表示
- 90日超バックアップ自動削除
- 90日以内バックアップ個別削除
- Driveから端末への復元
- 復元前端末データのローカル退避
- 端末とDriveの競合表示
- 認証期限切れ時のセッショントークン破棄

## 維持した原則

- 端末保存とGoogle Driveバックアップは別。
- Google Driveへの書き込みは利用者が
  「Google Driveにバックアップ」を押した場合だけ。
- 画面遷移・一定時間・入力保存を契機とした自動バックアップは行わない。
- 復元しただけではGoogle Driveへ自動上書きしない。
- 管理者へ勤務実績・給与設定を送信しない。

## UI整理

旧Drive接続方式の残骸だった「Drive認証を解除」ボタンを削除。
一般利用者の通常操作は「Google Driveにバックアップ」に集約。

## 検証

Drive内部の必須関数定義を静的照合。
JavaScript構文チェックを実施。
