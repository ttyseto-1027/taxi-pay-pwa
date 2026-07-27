利用者プロフィール同期修正 v15（2026-07-27 JST）

症状
- 管理者の組合員区分を「組合員」に変更しても非組合員表示のまま
- 乗務員番号を登録しても「未登録」のまま

原因
- 既に users/{uid} が存在する場合、ログイン時に古い users の値だけを使用していた
- 管理画面の編集処理は betaAllowlist だけを更新し、users を更新していなかった

修正
1. ログイン時
   - betaAllowlist を現在の正本として扱う
   - displayName / driverNumber / office / unionStatus / tester を
     users の古い値より優先して画面へ反映
   - 管理者権限 isAdmin と組合員区分を独立して保持

2. 管理画面
   - betaAllowlist編集時、registeredUidがある利用者は
     users/{uid} も同時に更新
   - 氏名、乗務員番号、営業所、組合員区分、
     テスター区分、利用状態を同期

確認手順
- v15をGitHubへ反映
- 最初の確認時だけCtrl+F5
- ログアウトして再ログイン
- ヘッダーに登録した乗務員番号と「組合員」が表示されることを確認
