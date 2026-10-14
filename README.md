# Taxi Payroll Processing Simulator — Version 1.4β

タクシー乗務員向け給与概算PWAです。現在の開発対象は Version 1.4β です。

## 正本ドキュメント

- `SPEC_v1.4beta.md` — 現行仕様の正本。最新版の仕様はここを見る。
- `IMPLEMENTATION_HISTORY_v1.4beta.md` — v1.4βの実装・修正履歴。細かな履歴ファイルを増やさずここへ追記する。
- `CHANGELOG.md` — バージョン単位の変更概要。
- `DEVELOPMENT.md` — 開発時のファイル構成・変更手順・回帰テスト方針。
- `MANUAL_user.md` / `MANUAL_admin.md` — 利用者・管理者向け手順。

旧版の個別README、SHA256固定ファイル、一時診断ページ、Build退避コピーはリポジトリのGit履歴から参照できるため、現行ツリーからは除去しています。

## 現行データ方針

勤務実績・給与計算設定は端末側を基本とし、Google Driveバックアップを利用できます。管理側Firebaseには認証・利用者管理・端末登録など、アプリ運用に必要な管理情報を保持します。勤務実績そのものを管理者側へ送る設計ではありません。

Version 1.4βでは、端末識別、データ競合判定、退避、削除履歴、標準復旧、Drive世代バックアップをデータ保全機構として扱います。

## 開発と公開

公開はGitHub Pagesを使用します。Firebase Authentication / Firestore / Google Drive APIの設定は、対応する現行セットアップ文書を参照してください。

変更は原則として作業ブランチで行い、GitHub Actionsの回帰ゲートを全件合格させてから `main` へ反映します。回帰ゲートはコード変更だけでなく、リポジトリ内の全変更を対象に実行します。

## 一時的に残している復旧ページ

- `production-data-recovery.html`
- `production-rescue-restore.html`

既存テスターの過去データ復旧が完了するまでは直接URL互換のため残します。標準復旧機能への移行完了後に削除対象とします。
