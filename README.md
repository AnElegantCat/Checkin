# NinebotCheckin - 九号出行自动签到

🛴 **九号出行（Ninebot）自动签到工具** - 基于 GitHub Actions 实现每日自动签到，支持签到里程碑奖励自动领取，支持多种推送通知。

[![GitHub Actions](https://github.com/AnElegantCat/NinebotCheckin/actions/workflows/sign.yml/badge.svg)](https://github.com/AnElegantCat/NinebotCheckin/actions/workflows/sign.yml)

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| ✅ 自动签到 | 每天定时自动完成九号出行 APP 签到 |
| ✅ 里程碑领取 | 自动领取连续签到奖励（7天、365天、666天等） |
| ✅ 多账号支持 | 支持配置多个账号同时签到 |
| ✅ 微信推送 | 支持 PushPlus 微信推送执行结果 |
| ✅ Bark 推送 | 支持 Bark iOS 推送通知 |
| ✅ 稳定可靠 | 基于 GitHub Actions，无需服务器 |
| ✅ 智能重试 | 网络异常自动指数退避重试（最多 3 次） |
| ✅ 启动校验 | 运行前自动检查必要环境变量 |

---

## 🚀 快速开始

### 1. Fork 本仓库

点击右上角 **Fork** 按钮，将仓库复制到你的账号下。

### 2. 配置 Secrets

进入仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

**单账号模式**（必填）：

| Secret 名称 | 说明 | 格式示例 |
|------------|------|---------|
| `NINEBOT_DEVICE_ID` | 设备 ID | `550e8400-e29b-41d4-a716-446655440000` |
| `NINEBOT_AUTHORIZATION` | 授权 Token | `Bearer eyJhbGciOiJIUzI1NiIs...` |

**多账号模式**（可选，与单账号二选一）：

| Secret 名称 | 说明 |
|------------|------|
| `NINEBOT_ACCOUNTS` | JSON 格式账号列表（见下方配置说明） |

**推送通知**（可选）：

| Secret 名称 | 说明 | 获取方式 |
|------------|------|---------|
| `PUSHPLUS_TOKEN` | PushPlus Token | [PushPlus 官网](https://www.pushplus.plus/) |
| `BARK_KEY` | Bark Key | [Bark App](https://apps.apple.com/cn/app/bark-%E7%BB%99%E4%BD%A0%E7%9A%84%E6%89%8B%E6%9C%BA%E5%8F%91%E6%B6%88%E6%81%AF/id1403753865) |

### 3. 启用 Actions

进入 **Actions** 页面，点击 **Enable** 启用工作流。

### 4. 测试运行

点击 **Run workflow** 手动触发一次签到，验证配置是否正确。

---

## 📱 抓包获取凭证

### iOS 用户（推荐 Stream）

1. App Store 下载 [Stream](https://apps.apple.com/cn/app/stream/id1312141691)
2. 安装证书并开启抓包
3. 打开「九号出行」APP → 进入「我的」→「签到中心」
4. 点击「立即签到」按钮
5. 返回 Stream，找到请求：
   ```
   POST https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/sign
   ```
6. 提取信息：
   - **deviceId**: 请求体 JSON 中的 `deviceId` 字段
   - **authorization**: 请求头中的 `Authorization` 字段（包含 `Bearer`）

### Android 用户（推荐 HttpCanary）

1. 下载安装 [HttpCanary](https://github.com/MegatronKing/HttpCanary)
2. 安装证书并开启抓包
3. 重复上述 iOS 步骤 3-6

---

## ⚙️ 详细配置

### 单账号配置

添加以下 Secrets：

```
NINEBOT_DEVICE_ID      = 550e8400-e29b-41d4-a716-446655440000
NINEBOT_AUTHORIZATION  = Bearer eyJhbGciOiJIUzI1NiIs...
NINEBOT_NAME           = 我的九号（可选，用于区分账号）
```

### 多账号配置

如需同时签到多个账号，添加 Secret `NINEBOT_ACCOUNTS`：

```json
[
  {
    "name": "账号1-主车",
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
  },
  {
    "name": "账号2-备用",
    "deviceId": "660e8400-e29b-41d4-a716-446655440001",
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
  }
]
```

> 💡 **提示**：使用多账号模式时，单账号的 Secrets 可不配置

### PushPlus 微信推送配置

1. 访问 [PushPlus 官网](https://www.pushplus.plus/)，微信扫码登录
2. 点击「一对一消息」，复制 Token
3. 添加 Secret `PUSHPLUS_TOKEN`
4. 运行后会收到微信推送通知

### Bark iOS 推送配置

1. App Store 下载 [Bark](https://apps.apple.com/cn/app/bark-%E7%BB%99%E4%BD%A0%E7%9A%84%E6%89%8B%E6%9C%BA%E5%8F%91%E6%B6%88%E6%81%AF/id1403753865)
2. 打开 App，复制你的 Bark Key（格式如：`xxxxxxxxxx`）
3. 添加 Secret `BARK_KEY`

**可选配置**：

| Secret 名称 | 说明 | 示例 |
|------------|------|------|
| `BARK_URL` | 自定义 Bark 服务器 | `https://api.day.app` |
| `BARK_GROUP` | 消息分组名称 | `九号签到` |
| `BARK_SOUND` | 提示音 | `bell` |
| `BARK_ICON` | 通知图标 URL | `https://example.com/icon.png` |

---

## ⏰ 定时说明

默认每天 **北京时间 07:00** 自动签到。

如需修改，编辑 `.github/workflows/sign.yml` 中的 cron 表达式：

```yaml
on:
  schedule:
    - cron: '0 23 * * *'  # UTC 23:00 = 北京时间 07:00
```

常用时间对照：

| 北京时间 | UTC 时间 | Cron 表达式 |
|---------|---------|------------|
| 06:00 | 22:00 | `0 22 * * *` |
| 07:00 | 23:00 | `0 23 * * *` |
| 08:00 | 00:00 | `0 0 * * *` |
| 09:00 | 01:00 | `0 1 * * *` |

---

## 📂 项目结构

```
.
├── .github/
│   └── workflows/
│       └── sign.yml          # GitHub Actions 工作流配置
├── sign_ninebot.js           # 签到脚本主文件
├── package.json              # Node.js 依赖配置
├── README.md                 # 项目说明文档
└── img/                      # 截图说明目录
```

---

## 🛠️ 技术栈

- [Node.js](https://nodejs.org/) 24.x - 运行环境
- [GitHub Actions](https://github.com/features/actions) - 定时任务调度
- [Axios](https://axios-http.com/) - HTTP 请求库
- [Moment.js](https://momentjs.com/) - 日期时间处理

---

## ❓ 常见问题

### Q: 签到失败提示 "Token 过期"？
A: Authorization 有效期有限，需要重新抓包获取最新的 Token。

### Q: 如何查看运行日志？
A: 进入仓库 → Actions → 选择最新运行记录 → 查看日志。

### Q: 支持哪些里程碑奖励？
A: 自动领取连续签到奖励，包括 7天（循环）、365天、666天等里程碑。

### Q: 多账号会冲突吗？
A: 不会，每个账号独立执行，互不影响。

---

## ⚠️ 免责声明

本项目仅供学习交流使用，请勿用于商业用途。

使用本项目即表示您同意：
- 自行承担使用风险
- 遵守九号出行用户协议
- 不将本项目用于非法用途

---

## 📄 License

[MIT](LICENSE) © AnElegantCat
