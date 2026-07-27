スマートフォンログイン本命修正版 v6（2026-07-25 JST）

変更内容
- iPhone / Androidなどスマートフォンは最初から signInWithRedirect() を使用
- PCは従来どおり signInWithPopup() を使用
- 起動直後に browserLocalPersistence を設定してからリダイレクト結果を取得
- getRedirectResult() と onAuthStateChanged() の診断を継続
- Build 20260725-v6 とキャッシュ更新番号を反映

反映方法
このフォルダ内の全ファイルをGitHubリポジトリのルートへ上書きしてください。
ZIP自体ではなく、展開後の中身をアップロードします。
