# 第3段階：新しい電車追加UIの2モード化 検証メモ

## 実施内容

My設定ページの「新しい電車を追加」画面に、電車の作り方を選ぶUIを追加した。

- 駅の数を自分で決める
- 時間に合わせて駅を自動で作る

## HTML整理

追加・変更した主な要素は以下。

- `newTrainCreationModeFieldset`
- `input[name="newTrainCreationMode"][value="stationCount"]`
- `input[name="newTrainCreationMode"][value="autoByUnit"]`
- `newTrainStationCountField`
- `newTrainUnitMinutesField`
- `newTrainAutoPreview`

駅数指定モードでは `newTrainStationCountField` のみ表示し、`newTrainUnitMinutesField` は `hidden` にする。
自動分割モードでは `newTrainUnitMinutesField` のみ表示し、`newTrainStationCountField` は `hidden` にする。

## JavaScript整理

追加・整理した主な処理は以下。

- `newTrainCreationModeInputs` の参照追加
- `newTrainStationCountField` の参照追加
- `newTrainUnitMinutesField` の参照追加
- `getSelectedTrainCreationMode()` を追加
- `updateCreateTrainModeVisibility()` を追加
- `getCreateTrainFormValues()` で選択中の `creationMode` を取得
- `setCreateTrainFormValues()` で例ボタンから作成モードも反映
- プレビュー文を「できあがる電車」として2モード対応に変更

## CSS整理

追加した主なスタイルは以下。

- `.create-train-mode-fieldset`
- `.create-train-mode-options`
- `.create-train-mode-option`
- `.create-train-mode-option.is-selected`
- `.field-help`
- `.create-train-preview-title`
- `.create-train-preview-body`

スマホは1カラム、680px以上は2列の選択カードにした。
359px以下では余白と文字サイズを少し圧縮する。

## 動作確認

### 静的確認

- `app.js` 構文エラーなし
- `sw.js` 構文エラーなし
- `manifest.webmanifest` JSON形式正常
- HTMLのID重複なし
- JavaScript参照IDの欠落なし
- ARIA参照切れなし
- CSS波括弧数一致
- ZIP破損なし
- APIキー・秘密鍵なし
- 指定された除外語と旧デモ由来の不要表現なし

### 表示・切替確認

ChromiumへHTML/CSS/JavaScriptを直接展開して確認した。

| 画面 | サイズ | 駅数指定時 | 自動分割時 | 横スクロール | JSエラー |
|---|---:|---|---|---|---:|
| iPhone相当 | 390×844 | 駅数のみ表示 | 1駅間の目安のみ表示 | なし | 0 |
| Android相当 | 412×915 | 駅数のみ表示 | 1駅間の目安のみ表示 | なし | 0 |
| 小型スマホ | 359×740 | 駅数のみ表示 | 1駅間の目安のみ表示 | なし | 0 |
| iPad縦 | 768×1024 | 駅数のみ表示 | 1駅間の目安のみ表示 | なし | 0 |
| PC | 1366×900 | 駅数のみ表示 | 1駅間の目安のみ表示 | なし | 0 |

### プレビュー確認

- 駅数指定：25分・6駅 → 6駅、5区間、5/5/5/5/5分
- 自動分割：25分・1駅間5分 → 6駅、5区間、5/5/5/5/5分
- 自動分割：22分・1駅間5分 → 6駅、5区間、5/5/5/5/2分

## 未確認項目

この環境では通常の `file://` 表示が管理ポリシーで遮断されるため、ChromiumへHTML/CSS/JavaScriptを直接展開して確認した。
実機またはHTTPS環境で以下を追加確認すること。

- iPhone Safariでのモーダル表示
- Android Chromeでのキーボード表示時の入力欄位置
- iPad Split Viewの細かい幅
- OS文字サイズ最大時の選択カード折り返し
- PWAインストール後のService Worker更新

## GitHub反映

GitHubへのcommit、push、ブランチ作成、Pull Request作成、GitHub上の直接編集、Vercelなどへのデプロイは行っていない。
