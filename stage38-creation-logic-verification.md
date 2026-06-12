# 第2段階：データ構造と計算関数の分離 検証メモ

## 実施内容

この段階では、UIの大きな変更は行わず、JavaScript側の内部処理を中心に整理した。

- 電車データに `creationMode` と `creationData` を追加
- 旧保存データに `creationMode` がない場合は `stationCount` として補正
- `stationCount` と `autoByUnit` を内部的に分けられるようにした
- 駅数指定用の `createTrainByStationCount()` を追加
- 自動分割用の `createTrainByAutoUnit()` を追加
- 全体時間と1駅間の目安から駅数を計算する `calculateStationCountFromUnitMinutes()` を追加
- `distributeMinutesAcrossSegments()` を整理し、均等配分と「最後だけ短くする」配分を分けた
- `normalizeTrainCreationData()` を追加し、保存データの補正を一元化
- 自動生成された駅間時間を正確に扱えるよう、内部生成時は1分単位の区間として保持するようにした
- アプリバージョンを `1.17.6` に更新
- Service Workerキャッシュ名を `train-timer-v1.17.6` に更新

## 追加・整理した主な関数

| 関数 | 目的 |
|---|---|
| `createTrainByStationCount()` | 全体時間と駅数から電車データを作る |
| `createTrainByAutoUnit()` | 全体時間と1駅間の目安から電車データを作る |
| `calculateStationCountFromUnitMinutes()` | 自動分割時の駅数・区間数を計算する |
| `distributeMinutesAcrossSegments()` | 駅間時間を配列に分配する |
| `normalizeTrainCreationData()` | 作成方法データを補正する |

## 計算確認

| 条件 | 期待値 | 確認結果 |
|---|---|---|
| 駅数指定：25分・6駅 | 5区間、5/5/5/5/5分 | OK |
| 自動分割：25分・1駅間5分 | 6駅、5区間、5/5/5/5/5分 | OK |
| 自動分割：22分・1駅間5分 | 6駅、5区間、5/5/5/5/2分 | OK |
| 旧保存データに `creationMode` なし | `stationCount` を補う | OK |
| 駅数が多くなりすぎる場合 | やさしい警告を返す | OK |

## 静的確認

- `app.js` 構文エラーなし
- `sw.js` 構文エラーなし
- `manifest.webmanifest` JSON形式正常
- HTMLのID重複なし
- JavaScript参照IDの欠落なし
- ARIA参照切れなし
- APIキー・秘密鍵なし
- 「カップ麺3分号」「カップ麺」「SegTimer」「並行タイマーリスト」なし

## 未実装・未確認

- UI上での「駅の数を自分で決める／時間に合わせて駅を自動で作る」の切替はまだ未実装
- 自動分割モード用の入力欄表示切替はまだ未実装
- 実ブラウザでの操作確認は次段階以降で実施
- 実機でのlocalStorage永続保存確認は未実施

## GitHub反映

GitHubへのcommit、push、Pull Request作成、デプロイは行っていない。
