# 第1段階：駅数指定機能と自動分割機能の分離に向けた現状確認・仕様整理

## 1. 現在の実装概要

現在の「新しい電車を追加」画面は、`createTrainPanel` 内にあります。入力欄は `電車名`、`全体時間`、`駅の数`、`1単位の分数`、`線路の形`、`音` が同じ画面に並んでいます。

現在の処理では、`getCreateTrainFormValues()` が `駅の数` と `1単位の分数` を同時に読み取り、`minimumTotalMinutes = (stationCount - 1) * unitMinutes` を計算します。そのため、入力した全体時間が最短時間より短い場合は、全体時間が自動的に引き上げられます。

例：`駅の数=6駅`、`1単位の分数=5分` の場合、最短時間は `5区間 × 5分 = 25分` になります。この状態で全体時間を22分にしても、現在の仕様では25分へ調整されます。したがって、今のままでは「22分を5分ごとに分けて、最後だけ2分にする」という自動分割は実現しにくい構造です。

## 2. 現在の問題点リスト

1. 「駅の数」と「1単位の分数」が同時に表示され、ユーザーがどちらを基準に作るのか迷いやすい。
2. `駅の数を自分で決める` と `時間に合わせて駅を自動で作る` がUI上で分かれていない。
3. 現在の説明文は「電車名、全体時間、駅の数を選ぶ」となっているが、実際には `1単位の分数` も時間調整に強く影響している。
4. `getCreateTrainFormValues()` が全体時間を最短時間へ自動で引き上げるため、ユーザーの入力値と作成結果がずれることがある。
5. `distributeMinutesAcrossSegments()` は均等配分方式であり、「5分、5分、5分、5分、2分」のような最後だけ短くする自動分割方式とは異なる。
6. localStorage上の電車データには、作成方法を表す `creationMode` がない。
7. `createTrainRecordFromConfiguration()` / `serializeTrainRecord()` / `normalizeTrainData()` が作成方法メタ情報を保存・復元する構造になっていない。
8. プレビューが「駅名・線路形状・全体時間」中心で、駅間の数や駅間時間の内訳が表示されていない。
9. 旧保存データを壊さないためには、`creationMode` がないデータを安全に `stationCount` 相当として扱う補正が必要。

## 3. 新しい仕様案

新しい電車の作り方を、次の2種類に分けます。

### A. 駅の数を自分で決める

ユーザーが `全体時間` と `駅の数` を指定します。アプリは駅間時間をできるだけ分かりやすく配分します。

表示する入力欄：

- 電車名
- 全体時間
- 駅の数
- 線路の形
- 音

非表示にする入力欄：

- 1駅間の目安

### B. 時間に合わせて駅を自動で作る

ユーザーが `全体時間` と `1駅間の目安` を指定します。アプリは駅数を自動計算します。

表示する入力欄：

- 電車名
- 全体時間
- 1駅間の目安
- 線路の形
- 音

非表示にする入力欄：

- 駅の数

例：

- 全体時間25分、1駅間5分 → 5区間、6駅、`5分, 5分, 5分, 5分, 5分`
- 全体時間22分、1駅間5分 → 5区間、6駅、`5分, 5分, 5分, 5分, 2分`

## 4. 新しいデータ構造案

既存のタイマー計算は `unitMinutes`、`stations`、`segments` で動いているため、それを壊さず、作成方法のメタ情報を追加するのが安全です。

```js
{
  creationMode: "stationCount" | "autoByUnit",
  creationSource: {
    totalMinutes: 25,
    stationCount: 6,
    unitMinutes: 5,
    segmentMinutes: [5, 5, 5, 5, 5]
  }
}
```

保存先の候補：

- 第1候補：電車レコード直下に `creationMeta` を追加
- 第2候補：`settings.creationMode` に入れる

安全性を重視するなら、既存の `settings` を大きく変えず、`creationMeta` として電車レコード直下に保存する方針がよいです。

## 5. 旧保存データを壊さないための補正

旧データには `creationMode` がないため、読み込み時に次の補正が必要です。

```js
creationMeta: normalizeTrainCreationMeta(source.creationMeta, normalizedConfiguration)
```

旧データの既定値：

```js
{
  creationMode: "stationCount",
  creationSource: {
    totalMinutes: calculateTotalMinutes(normalizedConfiguration),
    stationCount: normalizedConfiguration.stations.length,
    unitMinutes: normalizedConfiguration.unitMinutes,
    segmentMinutes: normalizedConfiguration.segments.map(...)
  }
}
```

## 6. 第2段階以降の実装方針

1. JavaScript側で `creationMode` と計算関数を先に分離する。
2. `createTrainByStationCount()` と `createTrainByAutoUnit()` を追加する。
3. `calculateStationCountFromUnitMinutes()` を追加する。
4. UIに「電車の作り方」2択を追加する。
5. 作成プレビューをモード別に表示する。
6. localStorageの保存・復元に `creationMeta` を追加する。
7. 旧保存データでも壊れないことを確認する。

## 7. この段階で行ったこと

- 現状のHTML、CSS、JavaScriptを確認しました。
- 大きなUI変更や機能実装は行っていません。
- 実装対象を整理するための仕様書と修正対象リストを追加しました。
