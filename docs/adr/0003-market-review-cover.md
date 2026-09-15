# 市场复盘推送复用封面机制，caption 链接文案可配

市场复盘推送此前只发「标题 + 时间 + 链接」纯文本，与每日三档新闻简报的观感割裂。我们决定：把 ADR-0002 的封面机制从「简报」泛化为「任意推送」——底图按推送标题选择（`cover.py` 的 `_TEMPLATE_BY_PUSH_TITLE` 增加 `市场复盘更新 → review.png`），新增底图 `assets/covers/review.png`（1024×1536，画面已印「市场复盘分析」字样，右上虚线框供日期使用），其日期标签框内区 `(552, 66, 978, 264)` 按实测写入 `_LAYOUTS`，避开左上猫爪与右下鲸鱼角标。`--fetch-assets` 在 GitHub 推送成功后调用同一个 `CoverGenerator` 生成封面并随 `sendPhoto` 发出。caption 链接文案随之参数化：`send_summary` 新增 `link_text`（默认「🔗 查看完整简报」），市场复盘传「🔗 查看市场复盘」，避免指着一个 Pages 复盘页说「完整简报」。封面生成或照片发送失败仍降级为原有纯文本推送，不阻断主链路；GitHub 推送失败时维持现有错误通知分支。

## Considered Options

- 为市场复盘另写一套封面生成器：与 `CoverGenerator` 仅底图映射不同，重复 Pillow 渲染、字体适配、JPEG 压缩与降级逻辑。
- 复盘推送不带封面、保持纯文本：与三档简报观感不一致，也没有承担日期信息的载体。
- caption 保留完整标题/时间/链接（`link_text` 以外再叠文本）：与封面信息重复，且与 ADR-0002 的极简 caption 决策冲突。
- 底图沿用 `noon.png`：画面文案是「午报」，与「市场复盘更新」语义不符。

## Consequences

- 封面文案依赖底图本身：打包字体 `NotoSansSC.ttf` 只含数字与「年月日/星期」字形，封面上不能再绘制其他中文（如「市场复盘」二字无字形，实测渲染为空白）。
- `review.png` 入库约 2.3MB，构图变更需同步更新 `_LAYOUTS["review.png"]`。
- `send_summary` 的 caption 文案由调用方决定，新增推送类型需自行给出 `link_text`，否则沿用简报文案。
- 底图文件名与推送标题的绑定关系集中在 `cover.py`，`CONTEXT.md` 的「底图」词条同步指向 `_TEMPLATE_BY_PUSH_TITLE`。
