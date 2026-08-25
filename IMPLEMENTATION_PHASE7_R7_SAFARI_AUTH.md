# Phase7 r7 Safari認証安定化

## 修正対象

iPhone Safariでページ再読み込み後にGoogleログインを実行すると、`auth/popup-blocked` になる問題。

## 原因

ログインボタンのタップ後に `setPersistence()` の完了を待ってから `signInWithPopup()` を呼んでいたため、Safariがポップアップを直接のユーザー操作として扱わない場合があった。

## 修正

- Persistence設定は従来どおりアプリ起動時に実施。
- ログインボタン押下時のFirestoreお知らせ再取得と、重複したPersistence設定を削除。
- iPhone Safariではタップ直後に `signInWithPopup()` を呼ぶ。
- PC・iPhone Chrome・Firestore・既存データ構造は変更しない。
- Service Workerキャッシュ名と認証モジュール読込番号を更新。

## テスト項目

1. iPhone Safariで開く。
2. ページを再読み込みする。
3. Googleログインを押す。
4. Googleアカウント選択画面が開くことを確認する。
5. ログイン後、勤務実績画面が表示されることを確認する。
6. PC ChromeとiPhone Chromeでもログインできることを確認する。
