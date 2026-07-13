# Taxi Pay PWA

タクシー乗務員向け給与概算シミュレーターのテスト版です。

## 起動
`index.html` をWebサーバーで公開してください。GitHub Pagesではリポジトリのルートを公開対象に設定します。

## 主なファイル
- `index.html` 画面
- `styles.css` スタイル
- `app.js` 計算・保存ロジック
- `tax-table-2026.js` 国税庁令和8年分月額表データ
- `manifest.json` PWA設定
- `sw.js` オフラインキャッシュ
- 各種仕様書・マニュアル

## データ保存
利用者データはブラウザのLocalStorageに保存されます。ブラウザデータを削除すると入力内容も消えるため、給与締め前のCSV保存を推奨します。

## 所得税の参照元
国税庁「令和8年分 源泉徴収税額表」
https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/01.htm

## 免責
本アプリは概算シミュレーションです。実際の給与支給額は会社の給与明細をご確認ください。

## Version 1.0βの運営表示
- サービス名: Taxi Payroll Processing Simulator
- 個人名は表示しません。
- ベータ版では問い合わせ窓口を設けません。
- 利用条件: `TERMS_BETA.md`
- データ取扱い: `PRIVACY_POLICY_BETA.md`
- ブランド表記: `BRAND_GUIDELINES_v1.md`
