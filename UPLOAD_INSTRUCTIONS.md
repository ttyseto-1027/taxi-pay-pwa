# GitHubへ丸ごとアップロードする手順（全ファイル完成版）

このフォルダは、`ttyseto-1027/taxi-pay-pwa` の全ファイル完成版です。
一部ファイルだけを選ぶ必要はありません。

## GitHubで行うこと

1. このZIPをパソコン上で展開します。
2. GitHubの `ttyseto-1027/taxi-pay-pwa` を開きます。
3. `Add file` → `Upload files` を選びます。
4. 展開したフォルダの**中にある全ファイル**をまとめて選択します。
5. GitHubの画面へドラッグ＆ドロップします。
6. `Commit changes...` を押します。
7. コミットメッセージ例：`Deploy v1.2 beta administrator bypass`
8. `Commit changes` を押します。

ZIPファイルそのものや、外側のフォルダだけをアップロードしないでください。
展開後に見える `index.html`、`app.js`、`styles.css` などの全ファイルを選びます。

## Firebase Consoleで別途必要な作業

GitHubへ `firestore.rules` をアップロードしても、Firebase Consoleのルールは自動更新されません。

1. Firebase Consoleを開く
2. Firestore Database → ルール
3. このフォルダの `firestore.rules` の全文をコピー
4. 現在のルール全文と置き換える
5. `公開` を押す

## Googleログイン設定

Firebase Consoleの `Authentication → Sign-in method` でGoogleを有効にします。

`Authentication → Settings → Authorized domains` に次を登録します。

- `ttyseto-1027.github.io`
- `taxipayrollprocessingsimulator.firebaseapp.com`

## 最初の管理者

Firebase Authenticationで管理者本人のGoogleアカウントのUIDを確認し、Firestoreに以下を作成します。

- コレクション：`admins`
- ドキュメントID：管理者本人のUID
- `email`：管理者本人のGoogleメールアドレス（文字列）
- `enabled`：`true`（ブール値）

管理画面：

`https://ttyseto-1027.github.io/taxi-pay-pwa/admin.html`

## 管理画面での順序

1. 利用者のGoogleメールアドレスを許可リストへ追加
2. 招待コードを作成（初期上限10人）
3. 利用者へGoogleログインと招待コードを案内

## 古い画面が表示される場合

`sw.js` のキャッシュ番号は更新済みです。反映直後に古い画面が残る場合は、ブラウザを完全に閉じて開き直すか、強制再読み込みしてください。


## 今回の変更

- Firestoreの `admins/{UID}` に有効な管理者登録があるアカウントは、利用者登録なしで `index.html` を利用できます。
- 管理者には `betaAllowlist`、招待コード、`users` ドキュメントは不要です。
- 一般利用者の許可リスト・招待コード・登録条件は従来どおりです。
- Firestore Security Rulesの内容は前版と同じため、すでに公開済みなら再公開は必須ではありません。
