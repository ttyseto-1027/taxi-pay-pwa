# Phase 0⑦ Firestore利用者確認修正版

- Google/Firebase認証方式はPhase 0⑥のまま維持。
- Firestoreのadmins、betaAllowlist、users読み込みに10秒のタイムアウトを追加。
- users読み込みがタイムアウトした場合、管理者に限り事前登録情報から起動。
- 一般利用者は従来どおりusers情報を確認し、失敗時はエラー表示。
- 診断版表示: phase0-07-firestore-user-fix
