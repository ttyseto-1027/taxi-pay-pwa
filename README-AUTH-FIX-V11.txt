認証初期化・Android Chrome対応 v11（2026-07-27 JST）

修正内容
1. Android Chrome
   - Googleログインを signInWithPopup() に変更

2. iPhone・iPad
   - signInWithRedirect() を維持

3. PC
   - signInWithPopup() を維持

4. 起動停止対策
   - setPersistence() に8秒の上限を設定
   - getRedirectResult() に10秒の上限を設定
   - タイムアウトしても「認証機能を準備しています…」で停止せず、
     Googleログインボタンを利用可能にする

5. 初期化順序
   - onAuthStateChanged() の監視を補助処理より先に開始
   - 認証準備完了時に明示的にボタンを有効化

6. 診断情報
   - AUTH-STATE-LISTENER-START / OK
   - AUTH-PERSIST-BOOT-WARN
   - AUTH-REDIRECT-TIMEOUT
   - AUTH-READY-001
   を追加

7. 維持した機能
   - 通常ログイン画面
   - Firebase Authenticationの自動ユーザー作成
   - Firestore betaAllowlist照合
   - 管理画面のテストユーザー編集機能 v10

反映方法
ZIPを展開し、taxi-pay-pwa-main フォルダ内の全ファイルを
GitHubリポジトリのルートへ上書きしてください。

注意
GitHub Pages反映後は、Android Chromeでページを再読み込みしてください。
古いキャッシュが残る場合は、Chromeのサイトデータを削除してから再確認してください。
