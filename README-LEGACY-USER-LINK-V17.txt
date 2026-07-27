古い利用者情報の紐付け・組合員機能修正 v17（2026-07-27 JST）

確認された実データ
- betaAllowlist: driverNumber登録済み、unionStatus=member、registeredUid=null、invitationUsed=false
- users: 古い形式で作成済み、driverNumber/office/unionStatusなし、plan=beta_free

修正
- registeredUidがnullならusersをemailで検索
- 1件見つかったらbetaAllowlistとusersをUIDで紐付け
- usersへdriverNumber、office、unionStatus、tester等を同期
- plan/versionをv1.3βへ更新
- 同じemailのusersが複数ある場合は更新を中止
- ログイン時も古いusersとbetaAllowlistを本人UIDで紐付け
- 最新のbetaAllowlist値で組合員機能を判定

反映後
1. GitHubへ全ファイルを上書き
2. Ctrl+F5
3. 管理画面で自分の事前登録情報を編集
4. 内容を変えなくても「登録情報を更新」
5. ログアウトして再ログイン
