# 总结调用抽象为「模型通道」，由配置在官方 API 与 Trae CN 之间切换

`Summarizer` 目前把 OpenAI 兼容客户端写死在自己的构造函数里（`src/cls_news/summarizer.py:81`），模型来源通过 `openai.base_url` 与 `openai.model` 表达。要新增「调用 Trae CN 免费积分模型」而不改变原有调用方式，我们把「一次总结由哪个上游承接」抽成一个显式枚举 **模型通道**（`openai.provider`），取值为 `openai-compatible`（现役：商汤 / DeepSeek / 火山方舟）与 `trae-cn`，两个通道各自持有自己的子配置。通道选择的落点是 `Summarizer` 已有的 client 注入缝（`summarizer.py:72`），而不是新增入口或常驻进程。**缺省值为 `openai-compatible`**，即未写 `provider` 的既有配置行为完全不变。

## Considered Options

- **让 Trae 伪装成 OpenAI 兼容 base_url，新增一个常驻本地回环桥进程**：这样 `Summarizer` 可以字面不改地继续用 `client.chat.completions.create()`。放弃，因为它新增了一个受支持的入口和一份独立的生命周期，与「单一受支持的入口」「一次异步操作一个生命周期控制器」两条约定直接冲突；而且桥的端口与密钥会泄漏成用户可见配置。
- **按 provider 在 `Summarizer` 内 if/else 拼参数**：改动面很小，但把两套协议差异散进总结逻辑，且无法让「通道不认识某参数」在请求前被拒绝。
- **provider 设为必填，旧配置启动即报错**：最贴合「配置错误大声失败 / 不用兜底默认值把缺失静默补齐」。放弃，因为现网 `config/settings.yaml` 没有该字段，必填会让所有已部署实例在升级瞬间中断，而收益只是省掉一个默认值。
- **缺省时按「是否存在 trae 段」推断通道**：两种配置形态都能跑，但「推断」本身是隐式规则，比显式默认更难自证，且用户写错段名时会静默走到另一条通道。
- **不新增抽象，直接改 `summarizer.py` 支持 Trae**：仓库只有这一个 LLM 调用点（已核实全仓唯一），改动看似可控；但那样 `extra_body={"thinking":{"type":"enabled"}}`（`summarizer.py:118`）这类只对单一上游有意义的字段会继续硬编码在总结逻辑里。

## Consequences

- `provider` 是一个封闭联合，取值只有 `openai-compatible` 与 `trae-cn`；写其他值在配置加载期报错。
- 通道自己声明它接受哪些请求参数；`Summarizer` 不再硬编码 `extra_body={"thinking":{"type":"enabled"}}`，该参数改为 `openai-compatible` 通道的声明内容。这是行为等价的搬迁，不是新增行为。
- 缺省值 `openai-compatible` 是一个有意保留的隐式默认，与「不用兜底默认值把缺失静默补齐」有张力；保留理由是升级零中断，且该默认只影响「未声明」这一种情形，不影响任何显式写错的值。
- `GLOSSARY.md` 新增「模型通道」与「Trae CN 通道」两条词条。
- trae-cn 通道**只在真正要调用模型时**校验凭据（未登录 / 路径错 / 文件损坏），不在配置加载期校验：`--fetch` 每 4 分钟跑一次且完全不碰模型，加载期强校验会让抓取任务在凭据缺失时整体失败。
