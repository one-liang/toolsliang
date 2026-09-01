# Git Flow

## 長期分支

- `main`：正式 production，只接受已驗證的 release 或緊急 hotfix。
- `develop`：下一版本整合分支，所有一般開發從此分支開始並回到此分支。

## 工作分支

- `feature/<english-kebab-case>`：新功能與一般需求，從 `develop` 建立，透過 Pull Request 合回 `develop`。
- `release/<semver>`：發布候選，從 `develop` 建立；僅處理版本、文件與修正。驗證通過後合入 `main`，再同步回 `develop`。
- `hotfix/<english-kebab-case>`：production 緊急修正，從 `main` 建立；完成後合入 `main` 與 `develop`。

所有變更均透過 Pull Request；不直接提交到 `main` 或 `develop`。功能分支合併後刪除。

## 提交與協作語言

Commit 使用 Conventional Commits，格式為 `<type>(<scope>): <繁體中文摘要>`，例如：

```text
docs(project): 建立專案決策與協作規範
feat(calendar): 新增台灣年度行事曆
fix(image): 修正圖片方向判讀
```

`type` 與選用的 `scope` 使用英文；摘要、Pull Request、issue、規格與重要說明使用繁體中文。分支名稱使用英文 kebab-case。

## 發布流程

1. `feature/*` 通過 CI 與審查後合入 `develop`。
2. 從 `develop` 建立 `release/<semver>`，部署 release candidate。
3. 完成自動測試、無障礙、效能、內容與人工驗證。
4. release 以 Pull Request 合入 `main`，建立版本標籤並部署 production。
5. 將 release 的最終變更同步回 `develop`。

production 部署需要人工核准；feature preview、staging、release candidate 與 production 使用已定義的隔離環境。
