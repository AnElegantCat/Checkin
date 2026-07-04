# GitHub Actions 配置说明

## 准备：抓包获取凭证

参考 [README「抓包获取凭证」](README.md#-抓包获取凭证)章节，从签到请求中提取两个字段（下表为占位示例，请替换为你自己的值）：

| 字段 | 示例 |
|------|-----|
| deviceId | `550e8400-e29b-41d4-a716-446655440000` |
| authorization | `Bearer eyJhbGci...`（完整 JWT，Bearer 前缀可省略，脚本会自动补全） |

> ⚠️ **切勿把真实的 deviceId / authorization 写进任何会提交到仓库的文件**（包括本文档），只存放在 GitHub Secrets 或本地 `.env` 中。

---

## GitHub 配置步骤

### 1. Fork 仓库到个人账号

访问 https://github.com/AnElegantCat/NinebotCheckin ，点击右上角 **Fork** 按钮。

或者将本地配置好的仓库推送到你的 GitHub：

```bash
# 在项目目录下执行
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
| `NINEBOT_DEVICE_ID` | 抓包获取的 deviceId | ✅ |
| `NINEBOT_AUTHORIZATION` | 抓包获取的完整 JWT（以 `eyJhbGci...` 开头的那一长串） | ✅ |
| `NINEBOT_NAME` | 你的账号名称（如：九号账号） | ❌ |
| `BARK_KEY` | Bark 推送密钥 | ❌ |
| `BARK_URL` | Bark 服务器地址（默认：https://api.day.app） | ❌ |
| `BARK_GROUP` | 推送分组名称 | ❌ |
| `BARK_ICON` | 推送图标 URL | ❌ |
| `BARK_SOUND` | 推送铃声 | ❌ |

### 3. 启用 Actions

进入仓库 → **Actions** 标签 → 点击 **I understand my workflows, go ahead and enable them**

> 💡 保活工作流（keepalive.yml）默认只在源仓库运行，fork 仓库不会自动空提交（避免与上游产生分叉）。fork 用户请留意 GitHub「定时任务因仓库不活跃被暂停」的邮件提醒并手动恢复，或删除 keepalive.yml 中的 `if: github.event.repository.fork == false` 一行来启用保活。

### 4. 测试运行

进入 **Actions** → **九号出行自动签到** → **Run workflow** → 点击 **Run workflow** 手动触发测试。

---

## 自动运行时间

- 默认：每天北京时间 **07:37** 触发（避开整点高峰），脚本再随机延迟 0-10 分钟执行
- 如需修改，编辑 `.github/workflows/sign.yml` 中的 cron 表达式，建议避开整点/半点

---

## 查看运行日志

进入 **Actions** → 点击最新的 workflow run → 查看日志输出
