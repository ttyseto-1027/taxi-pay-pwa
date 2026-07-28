# Phase 0⑤ 診断専用版

## 目的

iPhone／iPad環境で、Google認証後にログイン画面へ戻る原因を特定するための診断版です。

## ベース

Phase 0③（PC再ログイン修正版）をベースにしています。Phase 0④のポップアップ方式への変更は含めていません。

## 変更内容

認証方式や給与計算機能は変更せず、次の診断情報のみ追加しました。

- 現在URL、search、hash、referrer
- localStorage／sessionStorageのキー一覧（値や認証トークンは出力しない）
- 保存されたログイン試行の方式・段階
- `auth.currentUser` の有無とマスク済みメール
- `getRedirectResult()` の結果有無、所要時間、providerId、operationType
- `onAuthStateChanged()` の発火回数と認証状態
- Service Workerのcontroller・registration情報
- 表示状態、Cookie利用可否、オンライン状態、PWA起動状態

## 検証対象

LINEのリンクからiPhone版Chromeを起動した場合、およびSafariから直接起動した場合の両方で診断情報を取得してください。
