# NinebotCheckin - 九号出行自动签到

🛴 **九号出行（Ninebot）自动签到工具** - 基于 GitHub Actions 实现每日自动签到，支持微信推送通知。

[![GitHub Actions](https://github.com/AnElegantCat/NinebotCheckin/actions/workflows/sign.yml/badge.svg)](https://github.com/AnElegantCat/NinebotCheckin/actions/workflows/sign.yml)

---

## ✨ 功能特性

- ✅ **自动签到** - 每天定时自动完成九号出行 APP 签到
- ✅ **分享任务领奖励** - 自动执行分享回调并领取可用任务奖励
- ✅ **盲盒里程碑检查** - 自动查询盲盒积分与可兑换状态
- ✅ **多账号支持** - 支持配置多个账号同时执行所有任务
- ✅ **微信推送** - 支持 PushPlus 微信推送执行结果
- ✅ **Bark 推送** - 支持 Bark iOS 推送通知
- ✅ **稳定可靠** - 基于 GitHub Actions，无需服务器
- ✅ **重试机制** - 网络异常自动指数退避重试（最多 3 次）
- ✅ **启动校验** - 运行前自动检查必要环境变量，缺失提前报错

---

## 🚀 快速开始

### 1. Fork 本仓库

点击右上角 **Fork** 按钮，将仓库复制到你的账号下。

### 2. 配置 Secrets

进入仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

添加以下 Secrets：

| Secret 名称 | 说明 | 获取方式 |
|------------|------|---------|
| `NINEBOT_DEVICE_ID` | 设备 ID | 抓包获取 |
| `NINEBOT_AUTHORIZATION` | 授权 Token | 抓包获取 |
| `PUSHPLUS_TOKEN` | PushPlus Token（可选） | [PushPlus 官网](https://www.pushplus.plus/) |
| `BARK_KEY` | Bark Key（可选） | Bark App |

### 3. 启用 Actions

进入 **Actions** 页面，点击 **Enable** 启用工作流。

### 4. 测试运行

点击 **Run workflow** 手动触发一次签到，验证配置是否正确。

---

## 📱 抓包教程

### 使用 Stream（iOS）或 HttpCanary（Android）

1. 安装抓包工具并配置证书
2. 打开「九号出行」APP，进入签到页面
3. 点击签到按钮
4. 在抓包工具中找到请求：
   ```
   POST https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/sign
   ```
5. 提取以下信息：
   - **deviceId**: 请求体中的 `deviceId`
   - **authorization**: 请求头中的 `Authorization`（包含 `Bearer`）

---

## ⚙️ 配置说明

### 单账号配置

添加 Secrets：
- `NINEBOT_DEVICE_ID` = 你的设备ID
- `NINEBOT_AUTHORIZATION` = Bearer 你的Token

### 多账号配置（可选）

添加 Secret `NINEBOT_ACCOUNTS`，值为 JSON 格式：

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

### 推送通知配置

#### PushPlus 微信推送

1. 访问 [PushPlus 官网](https://www.pushplus.plus/)，微信扫码登录
2. 点击 **一对一消息**，复制 Token
3. 添加 Secret `PUSHPLUS_TOKEN`

#### Bark iOS 推送

1. App Store 下载 Bark
2. 复制你的 Bark Key
3. 添加 Secret `BARK_KEY`

---

## ⏰ 定时说明

默认每天 **北京时间 07:00** 自动签到。

如需修改时间，编辑 `.github/workflows/sign.yml` 中的 cron：

```yaml
- cron: '0 23 * * *'  # UTC 23:00 = 北京时间 07:00
```

| 北京时间 | Cron 表达式 |
|---------|------------|
| 07:00 | `0 23 * * *` |
| 08:00 | `0 0 * * *` |
| 09:00 | `0 1 * * *` |

---

## 📂 文件结构

```
.
├── .github/workflows/sign.yml    # GitHub Actions 工作流
├── sign_ninebot.js               # 签到脚本
├── package.json                  # 项目依赖
└── README.md                     # 本文件
```

---

## 🛠️ 技术栈

- **Node.js** - 运行环境
- **GitHub Actions** - 定时任务
- **Axios** - HTTP 请求
- **PushPlus** - 微信推送

---

## ⚠️ 免责声明

本项目仅供学习交流使用，请勿用于商业用途。使用本项目造成的任何后果由使用者自行承担。
