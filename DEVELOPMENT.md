# 開発ガイド — Version 1.4β

## 目的

現行コード・現行仕様・回帰テストだけを見れば開発を継続できる状態を維持する。旧版の一時ファイルや診断コピーを現行ツリーへ増殖させない。

## 開発の正本

- 現行仕様: `SPEC_v1.4beta.md`
- 実装履歴: `IMPLEMENTATION_HISTORY_v1.4beta.md`
- 変更概要: `CHANGELOG.md`
- アプリ本体: `index.html` / `app.js` / `styles.css`
- 保存保護: `storage-safety.js`
- データ保全・競合・退避: `data-integrity-v14.js`
- 標準復旧: `data-recovery-v14.js`
- 端末識別: `device-registry-v14.js`
- Driveバックアップ: `phase56-drive-backup.js`
- 認証・利用者管理: `firebase-auth.js` / `firestore.rules`
- 回帰テスト: `tests/regression-v14.cjs` / `tests/regression-storage-v14.cjs`

## 変更手順

1. `main` から作業ブランチを作る。
2. 変更前に関連する保存キー、旧データ移行、保存・削除・復元、Drive、端末差、認証、PWAキャッシュへの影響を確認する。
3. コードを変更する。
4. 仕様変更は `SPEC_v1.4beta.md`、実装内容は `IMPLEMENTATION_HISTORY_v1.4beta.md` へ追記する。個別の仕様書・実装メモファイルを新規作成しない。
5. GitHub Actionsの回帰ゲートを実行する。
6. 構文チェック、コア回帰、保存層回帰、静的結合チェックがすべて成功したことを確認する。
7. 実機確認は、自動化できず、端末固有で、データ保全または公開可否に直結する項目だけに限定する。Developの確認はPhase 14で1回に集約する。
8. Phase 14のDevelop実機確認に合格した後だけProductionへ選別移植する。Phase 15では自動確認を完了後、利用者がProductionを1回開いて以前の作業データが残っていることだけを確認する。

## 絶対ルール

- 既存データを破壊しない。
- 回帰テスト完了前に完成扱いしない。
- 旧Buildの退避コピーを `*-bXX.js` のような名前で残さない。必要ならGit履歴を使う。
- 一時診断HTML・一時README・SHA256固定ファイルを恒久ファイルとして増やさない。
- 復旧・競合処理ではユーザー判断前にデータを完全削除しない。
- 日時記録はJST基準を維持する。

## 実機確認方針

- 計算、保存、JSON解析、認証トークン選択、APIエラー変換、競合処理、画面制御は自動回帰または模擬通信で確認する。
- iOSのGoogle許可画面、実際のGoogle Drive通信、Service Worker更新後の既存データ維持など、ブラウザ外部状態に依存する項目だけを実機対象とする。
- Phase 14で一覧取得・復元/競合・更新後データ維持を1回の実機確認にまとめる。
- 実機で失敗した場合は同じ操作を反復させず、1回の結果を診断材料としてDevelop側を修正する。
- Phase 15では、Build・Service Worker・保存キー・Develop専用要素の混入・ログイン導線・全回帰・公開状態を自動確認する。
- 利用者側の確認は、Productionを1回開き、以前の作業データが残っていることだけとする。Drive一覧・復元/競合はPhase 15で再確認しない。


## 一時互換ファイル

`production-data-recovery.html` と `production-rescue-restore.html` は、既存テスターへの復旧URL互換のため一時的に残している。標準復旧機能への移行完了後、利用状況を確認して削除する。

## リポジトリ整理方針

Gitは履歴そのものがバックアップなので、現行ツリーには「現在の実行に必要」「現在の開発に必要」「現行仕様として参照する」のいずれかに該当するファイルだけを残す。過去Buildや一時調査資料を参照する必要がある場合はGit履歴から取得する。
