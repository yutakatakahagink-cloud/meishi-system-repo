# 名刺印刷システム（Web / GitHub Pages 形式）

`名刺ﾃﾞｰﾀ.xlsx` を基データに、PC・スマホのブラウザから名刺を選択・デザイン・印刷できるアプリです。
勤怠・安全衛生システムと同じ **Firebase（全端末共有）＋ localStorage フォールバック** 構成です。

## URL（2種類）
- **所有者URL**: `owner.html` … ログインID/パスワードと、システム名を設定。**使用者URL** を発行（コピー/QR共有）。
- **使用者URL**: `user.html` … 所有者が設定したID/パスワードでログイン → 名刺の選択・デザイン・印刷。

## 使用者の操作フロー
1. 使用者URLを開きログイン。
2. 「名刺印刷」→ 段階選択（前の選択に紐づく候補だけが出ます）:
   - **氏名** を選ぶ → その人の **会社・団体名** が選べる
   - 会社・団体名 → **URL・携帯・メール** が自動セット、**所属1** が選べる
   - 所属1 → 所属2 → 所属3 → **役職** → **資格** が自動セット
   - **郵便番号** を選ぶ → **住所・TEL・FAX** が自動セット
3. **工事件名** を任意で入力。
4. **画像（ロゴ等）** を挿入（ドラッグ移動・右下ハンドルでサイズ変更）。
5. プレビュー上で **各項目をドラッグで移動**、クリックして右側で **文字サイズ・色・太さ・配置・表示/非表示** を自由に変更。
6. 「印刷」で 91×55mm 実寸印刷（レイアウトは端末に自動保存）。

## データ（基データ）
- 編集対象: `名刺ﾃﾞｰﾀ.xlsx`（列: 番号/氏名/会社・団体名/所属1〜3/役職/資格/携帯/メール/郵便番号/住所/TEL/FAX/URL/備考/区分）
- Excel を更新したら **JSON を作り直す**:
  ```powershell
  python convert_xlsx.py   # → meishi-app/public/data/meishi-records.json
  ```

## フォルダ構成
```
14_名刺印刷ソフト/
├─ 名刺ﾃﾞｰﾀ.xlsx           … 基データ（ここを編集）
├─ convert_xlsx.py         … xlsx → JSON 変換
└─ meishi-app/
   ├─ start.bat            … ローカル起動（http://127.0.0.1:8791/）
   └─ public/
      ├─ index.html        … 入口（所有者/使用者へのリンク）
      ├─ owner.html        … 所有者ページ
      ├─ user.html         … 使用者ページ（選択・デザイン・印刷）
      ├─ meishi-store.js   … データ層（records読込・config同期・標準レイアウト）
      ├─ meishi-layout.js  … レイアウト共通定義
      ├─ config.js         … Firebase設定（.gitignore）
      └─ data/meishi-records.json … xlsxから生成した名刺データ
      └─ images/               … 名刺用画像フォルダ（manifest.json で管理）
scripts/
   Update-ImageManifest.ps1 … images フォルダから manifest.json を再生成
   Deploy-GitHubPages.ps1  … 14 → meishi-system-repo へデプロイ
   deploy-paths.txt
```

## GitHub Pages（本番・携帯・他PC）
- **使用者**: https://yutakatakahagink-cloud.github.io/meishi-system-repo/user.html
- **所有者**: https://yutakatakahagink-cloud.github.io/meishi-system-repo/owner.html
- リポジトリ: 作業box 直下の `meishi-system-repo/`（GitHub: `yutakatakahagink-cloud/meishi-system-repo`）

### 初回セットアップ（GitHub リポジトリ未作成の場合）
1. GitHub にログイン → **New repository**
2. Repository name: **`meishi-system-repo`** / Public / **README は追加しない**
3. 作成後 → **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / Folder: `/docs`**
4. 下記デプロイコマンドを実行（`git push` 成功後、1〜2分で公開）

### デプロイ手順
```powershell
Set-Location -LiteralPath "<作業box>\14_名刺印刷ソフト\scripts"
.\Deploy-GitHubPages.ps1 -Message "fix: 変更内容" -IncludeConfigJs
```

- Excel 更新後は `python convert_xlsx.py` してからデプロイ。
- `config.js` は `-IncludeConfigJs` で本番に反映（Firebase 設定含む）。携帯・他PCで設定を共有するには必須。
- push 後 1〜2 分で Pages が更新されます。反映確認は **Ctrl+Shift+R**（強制再読み込み）。

### 携帯への共有
1. 所有者ページ → **使用者URL** → **QR表示** で QR を社員に見せる
2. または URL をコピーして LINE 等で送付

## 画像保存ボックス（基本・URL タブ）
1. PC の `meishi-app/public/images/` フォルダに画像ファイル（PNG/JPG/SVG）を置く
2. `scripts\Update-ImageManifest.ps1` を実行（または `manifest.json` を手動更新）
3. 所有者画面 **基本・URL** → **画像保存ボックス** → **＋ 追加** でフォルダから選んで登録
4. 登録済みの画像**のみ**、会社共通・部署共通・プレビューで名刺に設定できます

## 画像フォルダ（元ファイル置き場）
- 配置場所: `meishi-app/public/images/`
- PNG/JPG/SVG 等を置き、`manifest.json` に登録（または下記スクリプトで自動生成）
```powershell
Set-Location -LiteralPath "<作業box>\14_名刺印刷ソフト\scripts"
.\Update-ImageManifest.ps1
```
- **会社共通・部署共通・プレビュー（個人）** の「＋画像」ボタンから **画像保存ボックス** の画像を選択
- 個人画像はプレビュー画面で氏名を選び「＋画像」→「個人画像を保存」。使用者画面の印刷にも反映されます

## 全社標準レイアウト
1. 所有者が使用者ページでデザインを調整（または JSON を用意）。
2. **所有者ページ** →「全社標準レイアウト」→「この端末のレイアウトを標準登録」または JSON 読み込み。
3. 使用者は「**全社標準に戻す**」で適用。個人調整は端末の localStorage に保存。

## ローカルでの確認
1. `meishi-app/start.bat` を実行 → ブラウザで `http://127.0.0.1:8791/`
2. 所有者ページでID/PW設定（既定: `admin` / `1234`）
3. 使用者ページでログイン → 印刷

> ※ ローカルでは `start.bat` または HTML を直接開けます（`data/meishi-records.js` 付き）。

## データ保存先
- `config.js` の Firebase があれば、ログインID/PW・システム名・**全社標準レイアウト**は **`/meishi_config`** に保存され全端末で共有。無ければ端末ごとの localStorage。
- 名刺レコード本体は静的JSON（全端末共通）。プレビューの個人レイアウトは端末ごとに localStorage 保存。

### Firebase Database ルール（携帯ログインに必須）

名刺データ用パスが **read 拒否** だと、携帯・他PCはログインID/PWを取得できずログインできません。Firebase Console → **Authentication** で **匿名** を有効化し、**Realtime Database → ルール** に次を追加してください（`hh_data` 等の既存ルールは残したまま併記）。

```json
{
  "rules": {
    "hh_data": {
      ".read": true,
      ".write": true
    },
    "meishi_config": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "meishi_records": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "meishi_image_library": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "meishi_preview_personal": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

ルール変更後は **公開** を押し、所有者ページで **基本・URL → 保存** を再実行してください。右上バッジが **「全端末で共有中」** になれば、使用者URLから同じID/PWでログインできます。

## 要検討
- 「氏名→会社」で複数候補がある場合の URL/携帯/メールは先頭値を自動採用（必要なら手動編集可）。
