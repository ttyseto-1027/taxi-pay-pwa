# Phase 0⑥：iPhone・iPad Popupログイン修正

## 目的
Phase 0⑤の診断で、iPhone版Chrome（WebKit）では `signInWithRedirect()` 復帰後に `getRedirectResult()` が常に空となり、認証状態も未ログインのままになることを確認した。

## 変更内容
- Phase 0⑤をベースに、iPhone・iPadのGoogleログイン方式を `signInWithPopup()` に変更。
- iOSでPopupが失敗してもRedirectへ自動フォールバックしない。
- Popupの開始・成功・失敗を既存の診断ログへ記録。
- Phase 0③の再ログイン修正とPhase 0⑤の診断機能を維持。
- Service Workerと読み込みURLのキャッシュ識別子を更新。

## 変更しない範囲
- 給与計算処理
- Firestoreの利用者確認・権限判定
- 管理画面
- Firebase設定値

## テスト手順
1. GitHub Pagesへ全ファイルを上書きする。
2. iPhoneでLINEから外部ブラウザ（Chrome）を開く。
3. Googleログインボタンを押す。
4. アカウント選択画面が別ウィンドウまたはブラウザ内認証画面として開くことを確認する。
5. 成功時は勤務実績入力画面へ遷移することを確認する。
6. 失敗時は診断情報をコピーする。
