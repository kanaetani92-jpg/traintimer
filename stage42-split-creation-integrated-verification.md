# 第6段階：端末別・機能別の統合確認メモ

## 対象

- タイマー画面
- My設定ページ
- 新しい電車を追加
- 駅数指定モード
- 自動分割モード
- 作成プレビュー
- 経路編集ページ
- 設定ページ
- 横線路・縦線路・円形線路
- 複数電車
- localStorage保存
- PWAキャッシュ

## 実施した統合調整

- アプリバージョンを `1.18.0` に更新しました。
- Service Workerキャッシュ名を `train-timer-v1.18.0` に更新しました。
- 第2〜第5段階で追加した以下の機能が同一ファイル内に残っていることを確認しました。
  - `creationMode: "stationCount" | "autoByUnit"`
  - `createTrainByStationCount()`
  - `createTrainByAutoUnit()`
  - `calculateStationCountFromUnitMinutes()`
  - `distributeMinutesAcrossSegments()`
  - `normalizeTrainCreationData()`
  - 作成プレビュー更新
  - localStorage旧データ補正

## 静的確認

- `app.js` 構文エラーなし
- `sw.js` 構文エラーなし
- `manifest.webmanifest` JSON形式正常
- HTMLのID重複なし
- `getElementById()` 参照先の欠落なし
- ARIA参照切れなし
- CSS波括弧の数が一致
- ZIP破損なし
- APIキー・秘密鍵なし
- アプリ本体に以下の語が含まれていないことを確認
  - `カップ麺3分号`
  - `カップ麺`
  - `SegTimer`
  - `並行タイマーリスト`

## UI構造確認

- `新しい電車を追加` 画面に、作り方選択ラジオボタンが2つあることを確認しました。
  - `stationCount`：駅の数を自分で決める
  - `autoByUnit`：時間に合わせて駅を自動で作る
- 駅数指定入力欄は `newTrainStationCountField` として存在します。
- 自動分割入力欄は `newTrainUnitMinutesField` として存在します。
- 作成プレビューは `newTrainAutoPreview` として存在します。
- すぐ使う路線は5件維持されています。
- 線路形状は横線路・縦線路・円形線路の3種類が維持されています。
- タイマー画面に運行中の電車リストを戻していない構造を維持しています。

## 計算ロジック確認

Node.jsのVM上で、初期化処理を止めた状態で作成関数だけを検証しました。

| 条件 | 結果 |
|---|---|
| 駅数指定：25分・6駅 | 5区間、5/5/5/5/5分 |
| 自動分割：25分・1駅間5分 | 6駅、5区間、5/5/5/5/5分 |
| 自動分割：22分・1駅間5分 | 6駅、5区間、5/5/5/5/2分 |
| 旧保存データに `creationMode` なし | `stationCount` を補う |

## 端末幅ごとの確認

通常ブラウザ表示は環境制約でタイムアウトしたため、CSSブレークポイントとHTML構造の静的確認を中心に行いました。

| 端末相当 | 画面サイズ | 確認内容 |
|---|---:|---|
| iPhone相当 | 390×844 | 599px以下向けCSS、1カラム、固定下部ナビ、安全余白の定義を確認 |
| Android相当 | 412×915 | 599px以下向けCSS、タッチ操作サイズ、横スクロール抑制の定義を確認 |
| 小型スマホ | 360px前後 | 359px以下向けの文字・余白補正を確認 |
| iPad縦 | 768×1024 | 600〜899px向けCSS、広めの1カラム調整を確認 |
| タブレット横 | 1024×800 | 900px以上向けCSS、2カラム構成を確認 |
| PC | 1366×900 | 1200px以上向けCSS、右操作パネル構成を確認 |

## 未確認項目

この環境ではChromiumの通常起動・スクリーンショット取得がタイムアウトしたため、実機またはHTTPS環境で以下を追加確認してください。

- iPhone Safariでのモーダル表示とキーボード表示時の入力欄位置
- Android Chromeでの入力欄位置と下部ナビの重なり
- iPad Split Viewでの作成プレビュー表示
- タブレット横・PCでの実際の2カラムの余白感
- 本物のlocalStorageへの保存・再読み込み復元
- PWAインストール後のService Worker更新
- オフライン再起動
- Wake Lockの実作動
- 実機で複数電車を同時に開始したときの音の重なり具合

## GitHub反映

GitHubへのcommit、push、Pull Request作成、ブランチ作成、GitHub上の直接編集、デプロイは行っていません。
