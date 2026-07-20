# v1.2β Google認証版 適用手順

1. Firebase AuthenticationでGoogleを有効化する。
2. Authenticationの承認済みドメインに `ttyseto-1027.github.io` を登録する。
3. Firestoreの `accessCodes` ドキュメントに `version: "v1.2-beta"` を追加する。
4. `betaAllowlist` のドキュメントIDへ、Googleログインに使うメールアドレスを小文字で登録する。
5. このZIPの `firestore.rules` をFirebase ConsoleのFirestoreルールへ反映する。
6. GitHubリポジトリへファイル一式をアップロードする。
7. 管理者は自分のGoogleアカウントで一度ログインし、Authenticationで確認したUIDを `admins/{UID}` として登録する。

## betaAllowlistの初期値
- enabled: true
- invitationUsed: false
- registeredUid: null
- displayName: 任意の文字列

## 初回利用
Googleログイン → 許可リスト照合 → 招待コード入力 → 登録完了。2回目以降はGoogleログインだけです。
