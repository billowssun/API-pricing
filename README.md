# API Pricing

大模型 API 价格对比与预算估算网站，支持模型检索、费用计算、价格变更展示及数据同步。

## 功能

- 按模型和供应商浏览价格与能力信息。
- 对比模型费用，估算不同调用量的预算。
- 查看价格变更与同步状态。
- 使用脚本及 GitHub Actions 更新价格数据。

## 本地运行

需要 Node.js 22。

```bash
npm ci
npm run dev
```

访问 `http://localhost:3000`。

## 数据维护与验证

`pricing.json` 保存模型价格数据，`scraper.js` 负责同步与验证，`sync-status.json` 保存同步状态。

```bash
npm run data:validate
npm run data:sync
npm run check
```

`data:sync` 会访问外部来源并更新本地数据；`check` 包含测试、数据校验、类型检查与构建。自动同步配置见 [.github/workflows/scrape.yml](./.github/workflows/scrape.yml)，说明见 [docs/actions-sync.md](./docs/actions-sync.md)。

## 部署

这是 Next.js 项目，可从仓库根目录导入 Vercel，也可运行 `npm run build`、`npm start` 自托管。

价格数据可能存在更新延迟、计价单位或缓存优惠差异；预算结果仅供估算，实际费用以供应商账单和官方定价为准。
