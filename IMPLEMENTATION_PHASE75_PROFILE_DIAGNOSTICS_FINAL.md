# Phase7.5 利用者情報・診断機能 最終仕上げ

Build: `20260819-07`  
作成日時: `2026/08/19 12:52:36 JST`

## 利用者情報

「利用者情報」に一般利用者向けの「アプリ・診断情報」を追加。

表示：
- Version
- Build
- 公開日時
- Service Worker状態
- Cache Version

操作：
- 診断情報をコピー
- PWAキャッシュを再構築

診断コピーには給与額・勤務実績を含めない。

## Googleログイン失敗時

認証エラーを検知した場合、
通常のログイン画面に留めず「利用者情報」の診断モードへ自動遷移する。

診断モードでは本人情報を取得できないため、
氏名・乗務員番号・勤務実績などは表示しない。

表示：
- Version / Build / 公開日時
- Service Worker
- Cache Version
- 認証エラー

操作：
- 診断情報をコピー
- Googleログインを再試行
- PWAキャッシュを再構築

## 診断情報

主な内容：
- Version / Build / Environment / Cache Version
- Service Worker状態
- アプリ用Cache Storage名
- URL / User Agent / Online / PWA起動
- 認証エラーコード・メッセージ
- 直近の認証診断ログ・アプリ診断ログ

氏名、給与額、勤務実績は診断コピー対象外。
