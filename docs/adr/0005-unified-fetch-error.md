# 统一出站抓取失败约定：FetchError，assets 失败当日不发

四个出站数据源（财联社新闻、市场复盘、Readhub 早报、今日热榜）各自使用不同的失败信号：cls 用 None 表示失败、[] 表示真空，assets 把异常吞成空数据结构照常推送，readhub 有自己的 ReadhubError，hotrank 用 None 由 publisher 翻译成 RuntimeError。我们统一为：抓取失败一律抛 `common.errors.FetchError`（`source` 属性标记来源），由各 app 的任务编排层在记日志、发 Telegram 告警后重新抛出，让 cron 的退出码体现失败；空数据载荷是合法返回值，调用方据此「当日无数据」而不是「抓取坏了」，不发空推送。assets 由「失败吞成空数据、页面照常更新并推送」改为「告警且当日不发」——当日不更新 Telegram 与 Pages（历史存档目录不受影响，已提交的世代不动），这是经确认的行为变化；上游真实返回的空载荷（如 jin10 当日无记录）仍合法地得到空数据结构，推送与存档照常，故障与真空的区分就此保留。

## Considered Options

- Result/Either 类型承载失败：Python 侧没有语言级支持，每个调用方都要显式拆包，全仓改造收益低于一个共享异常类型。
- 各 app 保留自己的异常名（ReadhubError 等）：告警与文档要为每个来源记一套名字，跨 app 的编排层无法用单一 except 统一处理。
- 抓取失败也降级为空数据照常推送（assets 原行为）：故障日会向订阅者推送空页面并写入历史存档，把「坏了」伪装成「没数据」，且历史存档里留下空世代。
- 统一为返回 None 哨兵：调用方极易忘记判 None（hotrank 原实现就漏过），且无法携带错误信息。

## Consequences

- 告警语义不变的部分：cls 采集失败仍只落日志不打扰 Telegram（每 4 分钟的高频任务靠下个周期自愈）；readhub/hotrank 抓取失败仍告警后抛出。
- assets 当日失败的可见性从「页面数据为空」变为「一条 Telegram 告警 + cron 退出码非零」；连续失败时 Pages 停留在上一成功日的数据。
- 各 app 的传输层异常（requests.RequestException）统一包装成 FetchError 上抛，publisher 只需捕获一种异常。
- `ReadhubError` 删除；hotrank publisher 的 None→RuntimeError 翻译删除。
