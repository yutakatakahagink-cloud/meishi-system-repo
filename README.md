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
scripts/
   Deploy-GitHubPages.ps1  … 14 → meishi-system-repo へデプロイ
   deploy-paths.txt
```

## GitHub Pages（本番）
- **使用者**: https://yutakatakahagink-cloud.github.io/meishi-system-repo/user.html
- **所有者**: https://yutakatakahagink-cloud.github.io/meishi-system-repo/owner.html
- リポジトリ: 作業box 直下の `meishi-system-repo/`（GitHub: `yutakatakahagink-cloud/meishi-system-repo`）

### デプロイ手順
```powershell
Set-Location -LiteralPath "<作業box>\14_名刺印刷ソフト\scripts"
.\Deploy-GitHubPages.ps1 -Message "fix: 変更内容" -IncludeConfigJs
```

- Excel 更新後は `python convert_xlsx.py` してからデプロイ。
- `config.js` は `-IncludeConfigJs` で本番に反映（Firebase 設定含む）。

## 全社標準レイアウト
1. 所有者が使用者ページでデザインを調整（または JSON を用意）。
2. **所有者ページ** →「全社標準レイアウト」→「この端末のレイアウトを標準登録」または JSON 読み込み。
3. 使用者は「**全社標準に戻す**」で適用。個人調整は端末の localStorage に保存。

## ローカルでの確認
1. `meishi-app/start.bat` を実行 → ブラウザで `http://127.0.0.1:8791/`
2. 所有者ページでID/PW設定（既定: `admin` / `1234`）
3. 使用者ページでログイン → 印刷

> ※ `index.html` を直接ダブルクリック（file://）すると JSON を読めません。必ず start.bat 経由で開いてください。

## データ保存先
- `config.js` の Firebase があれば、ログインID/PW・システム名・**全社標準レイアウト**は **`/meishi_config`** に保存され全端末で共有。無ければ端末ごとの localStorage。
- 名刺レコード本体は静的JSON（全端末共通）。プレビューの個人レイアウトは端末ごとに localStorage 保存。

## 要検討
- 「氏名→会社」で複数候補がある場合の URL/携帯/メールは先頭値を自動採用（必要なら手動編集可）。
