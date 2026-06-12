# Stage 45 検証メモ：線路表示エリアの端末別調整

## 実装概要

- `railway-stage` を線路表示エリアの親要素として扱う最終CSS上書きを追加。
- 横線路・縦線路・円形線路ごとに `min-height`、`max-height`、`aspect-ratio` を端末幅別に整理。
- 残り時間カードは通常のGrid配置または円形線路中央配置とし、`top:%` / `left:%` に依存しないように補強。
- 駅・電車・進行位置だけが線路内部のCSS変数と％指定で動く方針を維持。
- 横線路では駅名ラベルの上下余白を抑え、不自然な空白を減らした。
- 縦線路では線路と駅名ラベルの距離を `--rail-x` と `gap` で調整した。
- 円形線路では残り時間カードをgrid中央へ固定し、円の中心からずれにくくした。
- アプリバージョンを `1.18.2`、Service Workerキャッシュ名を `train-timer-v1.18.2` に更新。

## 静的確認

- `node --check app.js`：OK
- `node --check sw.js`：OK
- `manifest.webmanifest` JSON形式：OK
- HTML ID重複：なし
- JavaScript `getElementById` 参照欠落：なし
- ARIA / label for 参照切れ：なし
- CSS波括弧数：一致
- ZIP破損：なし
- APIキー・秘密鍵：検出なし
- アプリ本体ファイルに旧デモ由来の不要表現：検出なし

## 端末幅別の設計確認

| 画面幅 | 横線路 | 縦線路 | 円形線路 | 方針 |
|---:|---|---|---|---|
| 390×844 | `min-height: clamp(300px, 43dvh, 368px)` | `min-height: clamp(338px, 48dvh, 430px)` | `min-height: clamp(310px, 44dvh, 384px)` | スマホ縦1カラム |
| 412×915 | 同上 | 同上 | 同上 | Android想定でも線路高を確保 |
| 360px前後 | 359px以下専用補正あり | 359px以下専用補正あり | 359px以下専用補正あり | 文字切れ抑制 |
| 768×1024 | `min-height: clamp(430px, 52dvh, 560px)` | `min-height: clamp(500px, 60dvh, 650px)` | `min-height: clamp(470px, 56dvh, 620px)` | iPad縦は広め1カラム |
| 1024×800 | `min-height: clamp(480px, 62dvh, 680px)` | `min-height: clamp(520px, 66dvh, 720px)` | `min-height: clamp(500px, 64dvh, 700px)` | タブレット横2カラム内で安定 |
| 1366×900 | 同上 | 同上 | 同上 | PC表示で線路を大きく保持 |

## 未確認

この環境ではChromiumの通常スクリーンショット取得がタイムアウトしたため、実ブラウザでの視覚確認は未完了。

実機またはHTTPS環境で以下を確認してください。

- iPhone Safariで横線路・縦線路・円形線路の実表示
- Android Chromeでシステムナビ表示時の高さ
- iPad Split View幅での縦線路ラベル位置
- PCブラウザで円形線路中央残り時間の見え方
- OS文字サイズ最大時の駅名折り返し
