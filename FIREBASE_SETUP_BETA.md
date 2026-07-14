# Firebase 初期設定マニュアル（β版）

## 1. 目的

本マニュアルは、タクシー給与シミュレーターβ版へ次の機能を追加するための設定手順です。

- 氏名・メールアドレス・パスワードによる利用者登録
- β版無料利用コードによる登録制限
- 管理者専用の登録ユーザー一覧
- 利用停止・利用再開

給与・営収・勤務実績は端末内に保存し、Firebaseには利用者管理に必要な最小限の情報だけを保存します。

## 2. Firebaseプロジェクトを作成

1. Firebaseコンソールを開く。
2. 「プロジェクトを作成」を選ぶ。
3. 任意のプロジェクト名を設定する。
4. Google Analyticsはβ版では無効でも構いません。

## 3. Webアプリを登録

1. プロジェクト概要から Web（`</>`）を選ぶ。
2. アプリのニックネームを入力する。
3. 発行された `firebaseConfig` の値を控える。
4. `firebase-config.js` の `REPLACE_ME` をすべて置き換え、`enabled: true` にする。

## 4. Authenticationを有効化

1. Firebaseコンソールの「Authentication」を開く。
2. 「Sign-in method」で「メール/パスワード」を有効にする。
3. Authenticationの設定にある「承認済みドメイン」へ、GitHub Pagesのホスト名を追加する。
   - 例：`ttyseto-1027.github.io`

## 5. Cloud Firestoreを作成

1. 「Firestore Database」を開く。
2. データベースを作成する。
3. 本番環境モードを選ぶ。
4. 「ルール」タブで、同梱の `firestore.rules` の内容へ置き換えて公開する。

## 6. 最初の管理者を作る

最初の管理者だけはFirebaseコンソールで手動登録します。

### 6.1 Authenticationへ管理者を追加

1. Authenticationの「Users」を開く。
2. 「ユーザーを追加」を選ぶ。
3. 管理者用メールアドレスと専用パスワードを登録する。
4. 作成後に表示されるUIDを控える。

### 6.2 Firestoreへ管理者情報を追加

`users` コレクションに、ドキュメントIDを管理者UIDとして次を登録します。

- `name`：管理者表示名
- `email`：管理者メールアドレス
- `status`：`active`
- `plan`：`beta_admin`
- `createdAt`：timestamp
- `lastLoginAt`：timestamp
- `termsAcceptedAt`：timestamp

次に `admins` コレクションへ、同じUIDをドキュメントIDとして空のドキュメント、または次の項目を登録します。

- `role`：`admin`
- `createdAt`：timestamp

## 7. β版無料利用コードを作る

1. `admin.html` を開く。
2. 管理者アカウントでログインする。
3. 「β版無料利用コード」に任意のコードを入力する。
4. テストユーザー1人の場合は利用上限を `1` にする。
5. 「コードを登録」を押す。
6. コード本文はFirestoreへ保存されないため、別途安全に控えてテストユーザーへ伝える。

## 8. テストユーザーの登録

テストユーザーはアプリURLを開き、「新規登録」から次を入力します。

- 氏名
- メールアドレス
- 本人専用のログインパスワード
- 管理者から渡されたβ版無料利用コード
- 利用条件への同意

## 9. 利用停止・再開

1. `admin.html` を開く。
2. 管理者アカウントでログインする。
3. ユーザー一覧の「利用停止」を押す。
4. 利用停止されたユーザーは、次回認証時にアプリを利用できません。
5. 「利用再開」で再び利用可能になります。

## 10. GitHub Pagesへアップロードするファイル

最低限、次を含めてアップロードします。

- `index.html`
- `app.js`
- `styles.css`
- `sw.js`
- `manifest.json`
- `tax-table-2026.js`
- `firebase-config.js`
- `firebase-auth.js`
- `admin.html`
- `admin.js`

`firestore.rules` はGitHub Pagesで実行されるファイルではなく、Firebaseコンソールのルール設定に使用します。
