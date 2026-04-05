# GitHub Actions 配置说明

## 已配置的账号信息

从抓包数据中提取：

| 字段 | 值 |
|------|-----|
| deviceId | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| authorization | `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT Token) |

---

## GitHub 配置步骤

### 1. Fork 仓库到个人账号

访问 https://github.com/waistu/Ninebot ，点击右上角 **Fork** 按钮。

或者推送当前配置好的仓库到你的 GitHub：

```bash
# 在 ninebot-waistu 目录下执行
git init
git add .
git commit -m "Initial commit with GitHub Actions"
git branch -M main
git remote add origin https://github.com/你的用户名/ninebot-sign.git
git push -u origin main
```

### 2. 设置 Secrets

进入你的 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

需要添加以下 Secrets：

| Secret 名称 | 值 | 必填 |
|------------|-----|------|
| `NINEBOT_DEVICE_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | ✅ |
| `NINEBOT_AUTHORIZATION` | `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...` (完整JWT) | ✅ |
| `NINEBOT_NAME` | 你的账号名称（如：九号账号） | ❌ |
| `BARK_KEY` | Bark 推送密钥 | ❌ |
| `BARK_URL` | Bark 服务器地址（默认：https://api.day.app） | ❌ |
| `BARK_GROUP` | 推送分组名称 | ❌ |
| `BARK_ICON` | 推送图标 URL | ❌ |
| `BARK_SOUND` | 推送铃声 | ❌ |

> ⚠️ **注意**：`NINEBOT_AUTHORIZATION` 需要填入完整的 JWT Token（以 `eyJhbGci...` 开头的那一长串）

### 3. 启用 Actions

进入仓库 → **Actions** 标签 → 点击 **I understand my workflows, go ahead and enable them**

### 4. 测试运行

进入 **Actions** → **九号出行自动签到** → **Run workflow** → 点击 **Run workflow** 手动触发测试。

---

## 自动运行时间

- 默认：每天北京时间 **08:00** 自动运行
- 如需修改，编辑 `.github/workflows/sign.yml` 中的 cron 表达式

---

## 查看运行日志

进入 **Actions** → 点击最新的 workflow run → 查看日志输出
