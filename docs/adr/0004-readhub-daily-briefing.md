# Readhub 每日早报改用标题长图推送，并下线财联社早报

每天早上 06:05 推送的财联社新闻早报（AI 总结 + 文字消息）信息源单一，我们改为在 07:05 调用 Readhub 的 MCP 服务 `get_daily` 取当日早报，把话题标题渲染成一张竖版长图推到同一频道，并从 cron 删掉 06:05 的财联社早报。MCP 客户端自实现（约 60 行，复用 `build_session` 的重试与代理），不引入官方 SDK：实测只需 `initialize` → `notifications/initialized` → `tools/call` 三次 POST，仅接受 POST（GET 405）、无 SSE 回连、响应头无 `mcp-session-id`；`Accept` 必须同时列出 `application/json` 与 `text/event-stream` 否则 406；响应体是不带 charset 的 `text/event-stream`，必须显式 `encoding="utf-8"` 否则中文标题全乱码；`result.content[0].text` 是被字符串化的 JSON，需再解析一次；每条 topic 只有 `rank/id/url/title`，没有摘要与时间戳，所以长图只能画标题。时间点 07:05 的依据：用早报音频的 `Last-Modified` 当「该期定稿」的客观证据，实测最近 60 天有 55 天在 05:00 前定稿、3 天在 07:17 之后（最晚 14:52）、2 天在前一晚就定稿，即覆盖率约 57/60；该时刻也避开 03:00 的 ShellCrash 代理重启窗口，且实测 `mcp.readhub.cn` 直连约 0.6s 不吃代理。长图由 `DailyBriefingRenderer` 在内存生成（宽 1080，高度随条数浮动，实测 12 条 1080×2205/272KB、18 条 1080×3138/401KB），走既有 `sendPhoto`，caption 为空。当天该期尚未发布时（返回 0 条而非报错）不发空图，只记日志并发一条 Telegram 告警；抓取失败同样告警并抛出，生成图片或发图失败则降级为纯文本，不阻断主链路。

## Considered Options

- 继续用财联社早报：需要的是科技/互联网视角的每日精选，非财经单一来源。
- 另起独立子项目：Telegram 通道、代理、重试、日志、Pillow 渲染都要再抄一遍，改为在 `crawer` 内新增与 `assets_app` 并列的 `src/readhub_app/`。
- `trendingToday` 热度榜（固定 10 条）或 `latest` 时间流：条数固定、一次拿全，但语义是热度榜不是早报。
- 带底图的封面（复用 `morning.png` 或另画）：会把长图撑到近 4000px、首屏看不到标题，且底图右上的日期虚线框与长图内的日期重复。先用纯排版长图，将来要底图可从配置注入。
- 引入官方 `mcp` Python SDK：协议有官方维护，但需在树莓派上新增依赖，而 self-hosted 的三步握手自实现即可。
- 落盘已推日期做幂等：避免补跑刷屏，但需求是「只发 Telegram、其它地方不留备份」，冲突。
- 打包 GB2312 子集字体（6.84MB）：实测 90 天 1086 条真实标题里有 9 个 GB2312 之外的字（旸 昇 睒 祎 錤 镕 ・ U+200B ó），约每 120 条标题会有 1 条渲染成空白。
- 读取系统字体（树莓派 NotoSansCJK 或 macOS PingFang）：前者把渲染绑死到部署机的包管理器，后者在树莓派上不存在（`scripts/cp_fonts.sh` 清单里没有 PingFang/Hiragino Sans GB）。
- 运行时按标题动态取字形：覆盖完美且仓库零体积，但要把 fontTools 变成运行时依赖。

## Consequences

- 打包字体新增约 23.5MB 仓库体积：从 Noto Sans CJK SC（OFL 1.1）子集化出 Regular 与 Bold，字符集为 ASCII + 常用标点 + CJK 基本区（U+4E00–U+9FFF），生成脚本 `scripts/build_fonts.py`；换源字体需重跑该脚本。
- **「每日」的实际兑现率约 95%**：3/60 天在 07:05 时该期尚未发布，那些早上频道会静默（只有一条告警）。若要 100% 需改成按时段重试。
- 无幂等：同一天重复运行会重复推送，风险主要来自手动补跑。
- 财联社只剩午报（12:05）与晚报（20:05）；`_get_briefing_title` 的早报分支与 `morning.png` 映射保留作兜底，手动在早晨跑 `--summarize` 仍能出早报，但已无定时任务触达。
- 长图走 `sendPhoto`，Telegram 会二次压缩；尺寸随条数浮动而非固定画布。
- `CONTEXT.md` 新增「每日早报」「长图」词条，并明确它与「简报」是并列的推送类型。
