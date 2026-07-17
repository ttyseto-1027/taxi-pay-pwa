# v1.2β 初回パスワード変更（必須）

## 管理者がFirebase Consoleで利用者を作成するとき

1. Firebase Authenticationでメールアドレスと仮パスワードを登録する。
2. Firestoreの `users/{AuthenticationのUID}` を作成する。
3. 通常の利用者フィールドに加えて、次を必ず設定する。

| フィールド | 型 | 値 |
|---|---|---|
| mustChangePassword | boolean | true |

## 利用者の初回ログイン

1. 仮パスワードでログインする。
2. 初回パスワード変更画面が表示される。
3. 8文字以上の新しいパスワードを2回入力する。
4. 変更が成功すると `mustChangePassword` が `false` になり、`passwordChangedAt` が保存される。
5. 給与シミュレーターが表示される。

`mustChangePassword` が `true` の間は給与シミュレーターを利用できない。

## 配置時に必要な更新

- `index.html`
- `firebase-auth.js`
- `styles.css`
- `firestore.rules`

FirestoreルールはFirebase Consoleで公開する。
