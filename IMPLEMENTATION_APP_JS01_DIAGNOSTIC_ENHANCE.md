# APP-JS-01 診断ログ強化
Build: `20260820-07`
作成日時: `2026/08/20 15:05:58 JST`

Drive処理自体は変更せず、例外内容だけを詳細記録する診断版。

記録対象:
- error name
- message
- code
- filename
- line
- column
- stack

Promise未処理例外は `APP-PROMISE-01` として別記録。
「診断情報をコピー」の recentLogs に detail を追加。
