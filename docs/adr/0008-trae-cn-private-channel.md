# Trae CN 通道直连 mchost 私有接口，而非通过 traecli 子进程

trae-cn 通道要调用 Trae 的免费积分模型，而 Trae 官方不提供面向第三方程序的 API key：内置模型只在 IDE / CLI 内使用，官方 FAQ 对「是否支持第三方自定义 API」的回答是「不支持」。可用途径是复用本机登录态打它的客户端私有网关。实测在树莓派上（Trae CLI 2.0 登录态）`POST https://trae-api-cn.mchost.guru/api/agent/v3/llm_utils_chat` 返回 HTTP 200 与正常 SSE；同一任务的 token 消耗为 **33**，而走 `traecli exec` 为 **214 到 7787**。据此决定：crawer 在进程内直连 mchost，**不使用 subprocess**，凭据读 `~/.trae/cli/auth.json`（路径可配置覆盖），刷新委托 traecli 自己维护。

## Considered Options

- **`subprocess` 调 `traecli exec`**：省事，不用实现协议、SSE 重组与凭据刷新。放弃，三条理由：其一，token 消耗贵 6 到 236 倍，会很快耗尽免费额度；其二，`traecli` 是完整 Code Agent 而非补全接口，实测**无法限制它只做补全**——禁掉 `Bash` 后模型从 `Monitor` 绕过去照样执行 shell，对只想要一段摘要的 cron 而言这是不可接受的副作用面；其三，仓库当前 `subprocess` 使用为零，引入它等于新增一整套进程机制。
- **crawer 自己刷新 access token**：access token 14 天过期，刷新打 `POST /cloudide/api/v3/trae/oauth/ExchangeToken`。实测该 legacy 路径不需要 ECDSA 签名（HTTP 200 返回新 Token），技术上零新依赖可行。放弃，因为它要求 crawer 回写 `auth.json` 并处理 refresh token 轮换竞态，让一个总结程序承担凭据管理责任。
- **完全不刷新，过期即人工重新登录**：零依赖、零写入。放弃，因为 access token 每 14 天过期而 cron 无人值守。
- **引入官方 SDK / MCP 之类的中间层**：Trae 没有这类官方接口，该选项不存在。

## Consequences

- **这是一个无兼容承诺的私有接口。** 上游随时可能改协议或收紧访问，且没有任何官方文档可依据。参考实现自身记录过平台升级后「官方原生网络栈返回 200、普通 fetch 返回 400」的情况。通道失效表现为运行期错误，不是加载期错误。
- **凭据刷新依赖部署机上装有 `traecli`**：crawer 对凭据**只读**，刷新完全由 traecli 完成。crawer 提供 `--preheat-trae` 子命令，内部调用 `traecli models`（而非 `traecli exec`：两者都触发刷新，但实测 Pi 上峰值内存 3.6MB 对约 150MB）触发一次惰性刷新，预热失败只记日志、退出码仍为 0，真正的失败留给随后的总结调用暴露。
- **刷新窗口只有 2 小时**（实测二分逼近：剩余 2h10m 不刷，2h06m 刷，1h 与已过期均刷）：traecli 仅在 access token 剩余有效期不足 2 小时时才刷新，因此预热必须落在**每次总结之前**，低频预热（每天一次或每周一次）不起作用。`scripts/deploy_cron.sh` 装了 `--preheat-trae`，每天 11:35 / 19:35 各一次，即在 12:05 / 20:05 两次总结前 30 分钟。若预热任务长期失败，表现是 access token 过期后总结失败。
- access token 与 refresh token 的有效期都由服务端下发，且**刷新不滑动延长该期限**：实测间隔 12 分钟的两次刷新返回了**完全相同**的 `RefreshExpireAt`（2027-04-14T06:22:41），说明它是一个固定的会话截止时间，而不是每次刷新续期。
- 会话到期后 CLI 自己的报错是 `Token refresh not possible, re-authorization required.`。届时的恢复动作是**在这台机器上重新登录一次**：部署机上运行 `bash scripts/trae-relogin.sh`，向导脚本打印 Mac 侧的 SSH 转发命令与浏览器授权链接，按屏幕提示复制粘贴即可。脚本缺失时手动执行 `traecli login --personal`，从其输出的 `auth_callback_url=http%3A%2F%2F127.0.0.1%3A<port>` 里取端口号，用 `ssh -N -L <port>:127.0.0.1:<port> <host>` 转发到有浏览器的机器，在浏览器完成授权后回调即落回本机。登录态写入 `~/.trae/cli/auth.json`，crawer 无需改动。
- **具体期限未建立**：上面这个 `RefreshExpireAt` 是从「一次刷新」锚定的，不是从一次干净的登录锚定的，因此新登录能拿到多长窗口没有取样，不能在文档里断言为固定的 180 天。
- trae-cn 通道只放**已实测跑通**的模型：`deepseek-v4.1-flash` 与 `glm-5.3-flash`（两者均走 `solo_work_remote`）。模型名必须与列出它的 wire function 严格匹配，写错在配置加载期报错——实测 `DeepSeek-V4.1-Flash`（首字母大写、无点）返回 `4001`，正确写法是小写带点的 `deepseek-v4.1-flash`。
- 通道对上接收的请求参数采用**白名单**（`messages` / `max_tokens` / `reasoning_effort`）：实测传 `thinking={"type":"enabled"}` 会被上游**静默吞掉而不报错**，白名单让这类误解在请求前失败，而不是悄悄运行在一个并非用户以为的参数下。
- 错误码映射到既有语义：`4011`（限流）走既有 429 重试路径；`4008`（积分耗尽）与 `1005`（套餐档位不够）为不可重试错误；`4001`（该 function 不提供此模型）视为配置错误。
- 免费额度实测为「免费」套餐、总计 **750 积分**；真实负载（120 条新闻、约 4.7k 输入 tokens）单次约 11 秒。
