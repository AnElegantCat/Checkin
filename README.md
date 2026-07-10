# Checkin - 九号出行 & 什么值得买 自动签到

🛴 **九号出行（Ninebot）自动签到** + 🛒 **什么值得买（SMZDM）自动签到** - 基于 GitHub Actions 实现每日自动签到、九号盲盒和值得买每日任务，支持多账号、多推送渠道。

[![Ninebot Actions](https://github.com/AnElegantCat/Checkin/actions/workflows/sign.yml/badge.svg)](https://github.com/AnElegantCat/Checkin/actions/workflows/sign.yml)
[![SMZDM Actions](https://github.com/AnElegantCat/Checkin/actions/workflows/smzdm.yml/badge.svg)](https://github.com/AnElegantCat/Checkin/actions/workflows/smzdm.yml)

---

## ✨ 功能特性

### 🛴 九号出行 (Ninebot)
- ✅ **每日自动签到** - 定时执行，无需人工干预
- ✅ **盲盒自动领取+开箱** - 签到后自动领取盲盒，即时可开盲盒自动开启
- ✅ **多账号支持** - 支持单账号或多账号批量签到
- ✅ **智能重试机制** - 指数退避 + 抖动，失败自动重试 3 次
- ✅ **Token 失效检测** - HTTP 401/403 + 业务错误码 + 关键词多级检测

### 🛒 什么值得买 (SMZDM)
- ✅ **每日签到** - 自动签到获取金币、碎银、经验
- ✅ **每日任务** - 自动完成浏览文章、分享、点赞、收藏、评论、关注等任务

### 🔧 通用
- ✅ **多种推送渠道** - PushPlus 微信推送、Bark iOS 推送
- ✅ **仓库保活** - 每月自动调用 API 重置暂停计时器，防止 Actions 被禁用（无空提交）
- ✅ **本地日志记录** - 自动保存运行日志到 `logs/` 目录

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
| `NINEBOT_AUTHORIZATION` | ✅ | 抓包得到的原始 JWT（`eyJ` 开头；如误带 `Bearer ` 前缀脚本会自动剥掉） |
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

### 2b. 配置 SMZDM Secrets

| Secret | 必填 | 说明 |
|--------|------|------|
| `SMZDM_COOKIE` | ✅ | 什么值得买 Cookie（多账号用 `&` 分隔） |
| `SMZDM_SK` | ❌ | SK 参数（可选，不填自动计算） |

#### SMZDM 环境变量（Settings → Variables → Actions）

| Variable | 说明 |
|----------|------|
| `SMZDM_COMMENT` | 评论任务默认文案（需 >10 字符） |
| `SMZDM_CROWD_SILVER_5` | 设为 `yes` 启用 5 碎银子抽奖 |

### 3. 启用 Actions

进入 **Actions** 页面，点击 **Enable** 启用工作流。

> 💡 保活工作流（keepalive.yml）每月调用一次 GitHub 官方 API 重新启用定时任务，重置「60 天不活跃自动暂停」计时器，不产生任何提交。默认只在源仓库运行；fork 用户可删除其中 `if: github.event.repository.fork == false` 一行来启用。

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
   - **authorization**: 请求头中的 `Authorization` 值（`eyJ` 开头的原始 JWT，不带 `Bearer` 前缀）

### Android（HttpCanary）

步骤同上。

---

## ⚙️ 配置说明

### 单账号示例

```
NINEBOT_DEVICE_ID      = 550e8400-e29b-41d4-a716-446655440000
NINEBOT_AUTHORIZATION  = eyJhbGciOiJIUzI1NiIs...
NINEBOT_NAME           = 我的九号
```

### 多账号示例

`NINEBOT_ACCOUNTS`：

```json
[
  {
    "name": "账号1",
    "deviceId": "xxx",
    "authorization": "xxx"
  },
  {
    "name": "账号2",
    "deviceId": "yyy",
    "authorization": "yyy"
  }
]
```

---

## ⏰ 定时说明

每天两个工作流分别在两个时段执行：

| 工作流 | 触发时间 | 说明 |
|--------|---------|------|
| **九号出行** (`sign.yml`) | 每天 **北京时间 06:05** | UTC 22:05，脚本随机延迟 0-10 分钟，预留 GitHub 排队时间 |
| **什么值得买** (`smzdm.yml`) | 每天 **北京时间 05:07** | UTC 前一日 21:07，避开整点排队高峰，叠加 GitHub 延迟通常落在 06-07 点，稳稳早于 08:00 |

修改编辑 `.github/workflows/sign.yml` 或 `.github/workflows/smzdm.yml`。

也支持手动触发：进入 Actions 页面，选择对应工作流，点击 **Run workflow**。

---

## 📂 文件结构

```
.
├── .github/workflows/
│   ├── sign.yml                # 九号出行签到工作流
│   ├── smzdm.yml               # 什么值得买签到工作流
│   └── keepalive.yml           # 仓库保活工作流（API 保活，无空提交）
├── sign_ninebot.js              # 九号出行签到脚本
├── smzdm/                       # 什么值得买签到脚本
│   ├── env.js                  # 通用运行环境
│   ├── bot.js                  # SMZDM 基类 + 签名 + 请求
│   ├── library_task.js         # 任务逻辑库
│   ├── smzdm_checkin.js        # 每日签到
│   └── smzdm_task.js           # 每日任务
├── package.json                 # 依赖配置
├── GITHUB_SETUP.md              # GitHub Actions 配置说明
├── .env.example                 # 环境变量示例
├── .gitignore                   # Git 忽略配置
├── README.md                    # 说明文档
└── logs/                        # 运行日志目录（自动创建）
    └── sign_YYYY-MM-DD.log
```

---

## 🔧 技术特性

### 🛴 九号出行
- **Node.js 18+** - 使用 ES Module 模块化（Actions 环境使用 Node 24）
- **签到+盲盒一体化** - 签到成功后自动领取盲盒并开启（rewardStatus===1）
- **Token 多级校验** - HTTP 状态码 + 业务错误码（50001-50003）+ msg 关键词匹配
- **指数退避重试** - 2s → 4s → 8s + 随机抖动
- **随机延迟** - 定时任务启动后随机延迟 0-10 分钟，降低固定时间特征
- **Axios 拦截器** - 统一错误处理，响应体级 Token 校验

### 🛒 什么值得买
- **Cookie 认证+MD5 签名** - 基于 `got` 库、MD5 参数签名
- **多账号支持** - `&` 分隔 Cookie 实现多账号
- **任务全覆盖** - 浏览/分享/点赞/收藏/评论/关注/抽奖 10+ 种任务类型

### 🔧 通用
- **零冗余依赖** - 仅依赖 `axios`、`dotenv`、`got`、`crypto-js`、`tough-cookie`
- **仓库自动保活** - 每月 15 号自动调用 workflow enable API 重置暂停计时器，历史零噪音
- **本地日志持久化** - 每日独立日志文件

---

## ⚠️ 免责声明

本项目仅供学习交流使用，使用后果自负。请遵守九号出行用户协议，合理使用。
