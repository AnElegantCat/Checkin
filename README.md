# NinebotCheckin - 九号出行自动签到

🛴 **九号出行（Ninebot）自动签到工具** - 基于 GitHub Actions 实现每日自动签到，支持微信/Bark 推送通知。

[![GitHub Actions](https://github.com/AnElegantCat/NinebotCheckin/actions/workflows/sign.yml/badge.svg)](https://github.com/AnElegantCat/NinebotCheckin/actions/workflows/sign.yml)

---

## ✨ 功能

- ✅ 每日自动签到
- ✅ 多账号支持
- ✅ PushPlus 微信推送
- ✅ Bark iOS 推送
- ✅ 自动重试机制

---

## 🚀 快速开始

### 1. Fork 仓库

点击右上角 **Fork** 按钮复制到你账号。

### 2. 配置 Secrets

进入 **Settings → Secrets and variables → Actions → New repository secret**

**单账号模式**（二选一）：

| Secret | 说明 |
|--------|------|
| `NINEBOT_DEVICE_ID` | 设备 ID |
| `NINEBOT_AUTHORIZATION` | Bearer Token |
| `NINEBOT_NAME` | 账号名称（可选） |

**多账号模式**（二选一）：

| Secret | 说明 |
|--------|------|
| `NINEBOT_ACCOUNTS` | JSON 格式账号列表 |

**推送通知**（可选）：

| Secret | 说明 |
|--------|------|
| `PUSHPLUS_TOKEN` | PushPlus Token |
| `BARK_KEY` | Bark Key |

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
   - **authorization**: 请求头中的 `Authorization`（含 `Bearer`）

### Android（HttpCanary）

步骤同上。

---

## ⚙️ 配置说明

### 单账号

```
NINEBOT_DEVICE_ID      = 550e8400-e29b-41d4-a716-446655440000
NINEBOT_AUTHORIZATION  = Bearer eyJhbGciOiJIUzI1NiIs...
NINEBOT_NAME           = 我的九号（可选）
```

### 多账号

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

### Bark 推送（可选）

| Secret | 说明 | 示例 |
|--------|------|------|
| `BARK_KEY` | Bark Key | `xxxxxxxxxx` |
| `BARK_URL` | 自定义服务器 | `https://api.day.app` |
| `BARK_GROUP` | 消息分组 | `九号签到` |
| `BARK_SOUND` | 提示音 | `bell` |
| `BARK_ICON` | 通知图标 | `https://xxx.png` |

---

## ⏰ 定时说明

默认每天 **北京时间 07:00** 运行。

修改 `.github/workflows/sign.yml`：

```yaml
on:
  schedule:
    - cron: '0 23 * * *'  # UTC 23:00 = 北京时间 07:00
```

---

## 📂 文件结构

```
.
├── .github/workflows/sign.yml   # Actions 配置
├── sign_ninebot.js              # 签到脚本
├── package.json                 # 依赖
└── README.md                    # 说明文档
```

---

## ⚠️ 免责声明

仅供学习交流，使用后果自负。

---

## 📄 License

MIT © AnElegantCat
