# 封面日期标注统一到 common/cover，底图映射进 config

简报封面（`cls_news/cover.py`）与每日早报头图（`readhub_app/renderer.py`）各自维护一份「把日期画进框」的实现：两份星期名、两份日期格式、两套字号 fit 与居中绘制；cls_news 还把「推送标题 → 底图文件」的映射硬编码在 `_TEMPLATE_BY_PUSH_TITLE`。我们统一到 `common/cover.py`：日期标注原语 `stamp_date` 在给定框内排布日期文本——多行版式（日期/星期各一行）优先、单行兜底，避让框内装饰（`obstacles`），字号从大到小自适应缩小，完全排不进时不画——实测几何（行距 1.35、宽度占比 0.90、避障间距 14px、垂直偏移步长 2px）原样保留；`CoverGenerator` 一并搬入。「推送标题 → 底图文件」映射改为 config 数据（`cover.templates`，五条），section 缺映射在构造时大声抛错，generate 遇到未配置的推送标题记 warning 返回 None 走既有纯文本降级；标签框像素几何（`_LAYOUTS`）按底图文件名留在代码里——它是仓库底图的实测值，不随部署变化。

## Considered Options

- 只抽共享原语、两个 renderer 各自调用：星期名、日期格式与「推送标题↔底图」绑定仍各自维护，重复只减一半，下次改封面仍要碰多处。
- 标签框几何也进 yaml：几何是底图像素的实测值，换底图必然要改代码（重测坐标），放配置只会造成配置与底图版本脱节的另一种漂移。
- 不动现状：两处日期绘制已经各自演化（单行居中 vs 多行避障），同一仓库里同一件事有两套事实，改一处漏一处。

## Consequences

- `cls_news/cover.py` 删除；NewsTask/AssetsTask 的 `CoverGenerator` 从 common 导入，assets_app 对 cls_news 的跨包引用消除。
- 封面日期改走多行自适应版式（原单行居中）：同一标签框内字号更大；墨色、白描边与 JPEG 输出参数不变，仍内存生成不落盘。
- 「推送标题↔底图」绑定从代码迁到 `cover.templates`；未知推送标题不再回退午报底图，而是记 warning 返回 None 走纯文本降级；cover section 缺 `templates` 时 `CoverGenerator` 构造即抛，配置错误在最早可解析处失败。
- `docs/adr/0002`（封面改每日生成、caption 极简化）与 `docs/adr/0003`（市场复盘复用封面机制）是冻结历史：本 ADR 演进其 consequences——底图坐标绑定的位置改为 `common/cover.py` 的 `_LAYOUTS`，「推送标题↔底图」绑定的位置改为 `cover.templates`；「封面生成失败一律降级纯文本、绝不阻断推送主链路」的语义原样成立。
- `docs/adr/0004` 的字体约束原样成立：打包子集字体只含日期/星期字形，标注不得越出标签框，框外文案无字形可绘。
