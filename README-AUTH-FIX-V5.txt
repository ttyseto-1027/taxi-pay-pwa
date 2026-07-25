スマホログイン修正版 Build 20260725-v5

修正点:
- ログイン開始直後の未ログイン状態をセッション保存失敗と誤判定していた2.5秒タイマーを廃止
- signInWithPopup / getRedirectResult の認証結果から直接利用者確認へ進む
- onAuthStateChangedとの二重処理を防止
