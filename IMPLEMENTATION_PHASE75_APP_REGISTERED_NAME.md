# Phase7.5 アプリ登録氏名の表示統一

- Build: `20260817-01`
- 登録済みユーザー一覧では、Googleアカウントの表示名より `betaAllowlist.displayName` を優先。
- ユーザー詳細の氏名も、アプリの事前登録マスターに登録された氏名を優先。
- 既存の `users` ドキュメントは削除・初期化・一括書換えしない。
- 今後新規作成される `users` プロフィールも `betaAllowlist.displayName` を優先して保存。
- Firestoreルールは既存の厳密なv1.3βルールを維持し、Phase7.5の devices / loginHistory 権限だけを追加した版を同梱。
