# Taxi Payroll Processing Simulator — Version 1.0β

タクシー乗務員向けの給与概算PWAです。

## β版の主な機能

- 12種類の勤務区分
- 税込営収、勤務時刻、通常休憩・深夜休憩の入力
- 歩合給、割増賃金、手当、所得税、控除の概算
- 給与締め、履歴、CSV、印刷/PDF
- Firebase Authenticationによるメール・パスワード認証
- β版無料利用コード
- Firestoreによる登録ユーザー一覧と利用停止管理

## Firebase接続

認証機能を動かすには `firebase-config.js` を設定し、Firebase AuthenticationとCloud Firestoreを有効にする必要があります。詳しくは `FIREBASE_SETUP_BETA.md` を参照してください。

## データ方針

氏名・メールアドレス・利用状態などの利用者管理情報はFirebaseへ保存します。給与・営収・勤務実績はβ版では原則として各端末内へ保存します。

## 公開

GitHub Pagesへ静的ファイルをアップロードして公開できます。Firebase Authenticationの承認済みドメインへGitHub Pagesのホスト名を追加してください。
