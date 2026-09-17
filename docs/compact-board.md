# 精选价格看板

设计依据：用户选定的第 1 张分组价目表。1080px 居中、有限宽度，保留细分隔线、厂商分组和原币价格，不增加大横幅或营销模块。

## 首页选型

`lib/catalog-policy.cjs` 同时用于首页和同步发现：不设每个厂商的数量上限，各独立产品线分别保留代表型号，不是调用量排名。系列内比较版本号，同版优先官方别名而非重复快照；Grok 的非语义版本优先比较发布日期。实验、视觉专用和多智能体变体不进入默认文本价格表。新增厂商或改变产品命名体系时，需要明确更新 families 规则并补测试。

保留原数据集和旧详情链接；隐藏不代表宣布模型正式退役。首页展示 10 家中美厂商，原有 Mistral 数据仍保留在数据集与旧详情页。

## 核对记录（2026-09-08）

- OpenAI：2026-09-17 修正了错误的互斥关系；Sol 与 Astra 是独立产品线，必须同时保留，聚合来源如实标记。
- Anthropic 当前价格页列出 Fable 5.1、Opus 5、Sonnet 5、Haiku 4.5：https://platform.claude.com/docs/en/about-claude/pricing
- Google：当前 Flash 为 3.8，Pro 仍有 3.1 Pro Preview，Flash-Lite 单独保留：https://ai.google.dev/gemini-api/docs/pricing?hl=en
- xAI：当前价格页列出 Grok 4.6 与 Grok Build 0.1：https://docs.x.ai/developers/pricing
- 新增智谱 GLM-5.3 / GLM-5.3-Flash 官方国际平台报价：https://docs.z.ai/guides/overview/pricing
- 新增 MiniMax-M3 / M2.7 / M2.7-highspeed 官方按量报价：https://platform.minimax.io/docs/guides/pricing-paygo

DeepSeek、通义千问、豆包、Kimi 的现有官方/聚合报价保留来源与原核验时间，不将本轮 UI 改版冒充全量重新核价。新增智谱与 MiniMax 已加入自动发现厂商白名单；它们的官方报价本轮为手动核验，后续并非自动解析官网报价。

GLM-5.3-Flash 当前五折优惠显示明确标签，`priceSchedule` 在 2026-09-09T16:00:00Z 后恢复已公告标准价（页面下一次生成/刷新生效；ISR 最多存在一轮缓存延迟）。MiniMax-M3 展开说明 512K 输入阈值与 Priority 价格。所有数据都保留 USD/CNY，排序只在同厂商同币种范围内进行。

## 本地验证

2026-09-17：新增在售产品线共存、MiniMax 小版本升级及明确到期下架测试。下架字段 `lifecycle: retired` 或 `retireAt` 必须附 `lifecycleSource`，不能仅凭发布时间判定退役。目前仍需人工录入官方退役证据，不宣称已自动识别所有厂商退役公告。详情页显示各自核验日期；首页提示超过 30 天未核验的报价。同步失败只提交失败状态，不发布失败批次价格。尚未完成所有厂商官方价格解析器。

`npm run check` 执行规则测试、抓取回归测试、数据校验、TypeScript 与生产构建。生产预览：`npm run start -- --hostname 127.0.0.1 --port 4174`。

图标来自固定版本 `@lobehub/icons-static-svg`，原样复制至 `public/providers`，不依赖外部 CDN。授权文件随图标保存。
