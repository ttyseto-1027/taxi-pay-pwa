新規テストユーザー登録画面 修正版 v7（2026-07-27 JST）

変更内容
- 管理画面の「Googleアカウント許可リスト」を
  「新規テストユーザー登録（1名ずつ）」へ変更
- CSV取込と同じ7項目を個別登録可能に変更
  1. 氏名（displayName）
  2. Googleアカウント（email）
  3. 乗務員番号（driverNumber）
  4. 営業所（office）
  5. 組合員区分（unionStatus）
  6. テストユーザー区分（tester）
  7. 利用状態（enabled）
- Googleアカウント重複と乗務員番号重複を登録前に確認
- 登録済み一覧にも全項目を表示
- 初回ログイン前は invitationUsed=false、registeredUid=null で保存

反映方法
ZIPを展開し、taxi-pay-pwa-main フォルダ内の全ファイルを
GitHubリポジトリのルートへ上書きしてください。
