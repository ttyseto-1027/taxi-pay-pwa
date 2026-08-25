# Firebase Googleログイン統合 Drive権限取得
Build: 20260820-03
作成日時: 2026/08/20 13:07:54 JST

- 通常のGoogleログインでは従来の認証スコープのみ。
- 利用者が「Google Driveへ同期」を押した時だけ drive.file scope を追加要求。
- Google認証結果からGoogle API access tokenを取得し、Drive REST APIに利用。
- Drive専用の利用者設定画面・接続ボタンは使用しない。
- Driveへの書き込みは「Google Driveへ同期」を押した場合だけ。
- 管理者側ではGoogle CloudプロジェクトのDrive API有効化が必要。
