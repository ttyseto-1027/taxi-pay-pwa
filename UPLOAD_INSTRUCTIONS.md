# GitHubアップロード用・最終手順

## 結論

このZIP内の次の6ファイルが、今回GitHubへアップロードする完成ファイルです。

- `admin.html`
- `admin.js`
- `firebase-auth.js`
- `firebase-config.js`
- `firestore.rules`
- `sw.js`

GitHubリポジトリ `ttyseto-1027/taxi-pay-pwa` の最上位へ、
6ファイルをまとめてアップロードしてください。

同名ファイルはすべてファイル全体で置き換えます。
部分編集は不要です。

`index.html`、`app.js`、`styles.css`、`manifest.json`、
`tax-table-2026.js` は今回変更しません。

## GitHubでの操作

1. リポジトリのトップ画面を開く
2. `Add file`
3. `Upload files`
4. ZIPを展開して、このフォルダ内の6ファイルを選択
5. 画面下の `Commit changes...`
6. コミットメッセージ例:
   `Complete v1.2 beta Google authentication`
7. `Commit changes`

## Firestore Security Rules

重要:
GitHub上の `firestore.rules` を置き換えただけでは、
Firebase Consoleの実際のルールには反映されません。

Firebase Consoleで以下を実施します。

1. Firestore Database
2. ルール
3. ZIP内の `firestore.rules` の全文をコピー
4. 現在のルール全文を置き換える
5. `公開` を押す

## Googleログイン設定

Firebase Consoleの
`Authentication → Sign-in method`
でGoogleを有効にします。

`Authentication → Settings → Authorized domains`
に次を登録します。

- `ttyseto-1027.github.io`
- `taxipayrollprocessingsimulator.firebaseapp.com`

## 最初の管理者

Firebase Authenticationのユーザー一覧で、
管理者本人のGoogleログインユーザーのUIDを確認します。

Firestoreで次を作成します。

- コレクション: `admins`
- ドキュメントID: 管理者本人のUID
- フィールド:
  - `email` / 文字列 / 管理者のGoogleメールアドレス
  - `enabled` / ブール値 / `true`

Firebase Consoleから作成するため、
最初の管理者作成時にSecurity Rulesで拒否されることはありません。

## 管理画面

GitHub Pages反映後:

https://ttyseto-1027.github.io/taxi-pay-pwa/admin.html

操作順:

1. 管理者のGoogleアカウントでログイン
2. 利用者のGoogleメールアドレスを許可リストへ追加
3. 招待コードを新規発行（初期値10人）
4. 利用者へGoogleログインと招待コードを案内

## 更新直後に古い画面が出る場合

今回の `sw.js` はキャッシュ名を変更しているため、通常は自動更新されます。
それでも古い画面が残る場合は、ブラウザを完全に閉じて開き直すか、
ページを強制再読み込みしてください。
