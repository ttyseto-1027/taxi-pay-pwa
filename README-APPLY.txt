GitHubリポジトリの同名ファイルを、このフォルダ内の3ファイルで上書きしてください。

1. firebase-auth.js
2. admin.js
3. firestore.rules

重要:
firestore.rules はGitHubへ置くだけではFirebaseに反映されません。
Firebase Console > Firestore Database > ルール に貼り付けて「公開」してください。

管理画面で無料コードを登録すると、利用上限の未入力時は3人になります。
同じコードを再登録した場合、usageCountを維持したまま上限だけ変更します。
