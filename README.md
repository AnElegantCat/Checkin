# NinebotCheckin - 九号出行自动签到

🛴 **九号出行（Ninebot）自动签到工具** - 基于 GitHub Actions 实现每日自动签到，支持多账号、微信/Bark 推送通知。

[![GitHub Actions](https://github.com/AnElegantCat/NinebotCheckin/actions/workflows/sign.yml/badge.svg)](https://github.com/AnElegantCat/NinebotCheckin/actions/workflows/sign.yml)

---

## ✨ 功能特性

- ✅ **每日自动签到** - 定时执行，无需人工干预
- ✅ **多账号支持** - 支持单账号或多账号批量签到
- ✅ **智能重试机制** - 指数退避 + 抖动，失败自动重试 3 次
- ✅ **多种推送渠道** - PushPlus 微信推送、Bark iOS 推送
- ✅ **本地日志记录** - 自动保存运行日志到 `logs/` 目录
- ✅ **稳定可靠** - 移除冗余依赖，代码精简高效

---

## 🚀 快速开始

### 1. Fork 仓库

点击右上角 **Fork** 按钮，将仓库复制到你的账号。

### 2. 配置 Secrets

进入 **Settings → Secrets and variables → Actions → New repository secret**

#### 单账号模式（二选一）

| Secret | 必填 | 说明 |
|--------|------|------|
| `NINEBOT_DEVICE_ID` | ✅ | 设备 ID |
| `NINEBOT_AUTHORIZATION` | ✅ | Bearer Token（含 `Bearer` 前缀） |
| `NINEBOT_NAME` | ❌ | 账号名称（用于推送显示） |

#### 多账号模式（二选一）

| Secret | 必填 | 说明 |
|--------|------|------|
| `NINEBOT_ACCOUNTS` | ✅ | JSON 格式账号列表 |

#### 推送通知（可选）

| Secret | 说明 |
|--------|------|
| `PUSHPLUS_TOKEN` | PushPlus Token（微信推送） |
| `BARK_KEY` | Bark Key（iOS 推送） |
| `BARK_URL` | Bark 自定义服务器地址 |
| `BARK_GROUP` | Bark 消息分组 |
| `BARK_ICON` | Bark 通知图标 URL |
| `BARK_SOUND` | Bark 提示音 |

### 3. 启用 Actions

进入 **Actions** 页面，点击 **Enable** 启用工作流。

---

## 📱 抓包获取凭证

### iOS（Stream）

1. 下载 [Stream](https://apps.apple.com/cn/app/stream/id1312141691)
2. 安装证书并开启抓包
3. 打开「九号出行」→「我的」→「签到中心」→ 点击「立即签到」
4. 返回 Stream，找到请求：
   ```
   POST https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/sign
   ```
5. 提取：
   - **deviceId**: 请求体中的 `deviceId`
   - **authorization**: 请求头中的 `Authorization`（含 `Bearer` 前缀）

### Android（HttpCanary）

步骤同上。

---

## ⚙️ 配置说明

### 单账号示例

```
NINEBOT_DEVICE_ID      = 550e8400-e29b-41d4-a716-446655440000
NINEBOT_AUTHORIZATION  = Bearer eyJhbGciOiJIUzI1NiIs...
NINEBOT_NAME           = 我的九号
```

### 多账号示例

`NINEBOT_ACCOUNTS`：

```json
[
  {
    "name": "账号1",
    "deviceId": "xxx",
    "authorization": "Bearer xxx"
  },
  {
    "name": "账号2",
    "deviceId": "yyy",
    "authorization": "Bearer yyy"
  }
]
```

### Bark 推送配置（可选）

| Secret | 说明 | 示例 |
|--------|------|------|
| `BARK_KEY` | Bark Key | `xxxxxxxxxx` |
| `BARK_URL` | 自定义服务器 | `https://api.day.app` |
| `BARK_GROUP` | 消息分组 | `九号签到` |
| `BARK_SOUND` | 提示音 | `bell` |
| `BARK_ICON` | 通知图标 | `https://example.com/icon.png` |

---

## ⏰ 定时说明

默认每天 **北京时间 07:00** 运行。

如需修改，编辑 `.github/workflows/sign.yml`：

```yaml
on:
  schedule:
    - cron: '0 23 * * *'  # UTC 23:00 = 北京时间 07:00
```

也支持手动触发：进入 Actions 页面，选择工作流，点击 **Run workflow**。

---

## 📂 文件结构

```
.
├── .github/workflows/sign.yml   # GitHub Actions 配置
├── sign_ninebot.js              # 签到脚本（主程序）
├── package.json                 # 依赖配置
├── README.md                    # 说明文档
└── logs/                        # 运行日志目录（自动创建）
    └── sign_YYYY-MM-DD.log
```

---

## 🔧 技术特性

- **Node.js 18+** - 使用 ES Module 模块化
- **指数退避重试** - 2s → 4s → 8s + 随机抖动
- **Axios 拦截器** - 统一错误处理，自动识别 Token 过期
- **零冗余依赖** - 仅依赖 `axios` 和 `dotenv`
- **本地日志持久化** - 每日独立日志文件

---

## ⚠️ 免责声明

本项目仅供学习交流使用，使用后果自负。请遵守九号出行用户协议，合理使用。
