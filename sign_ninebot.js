import axios from "axios";
import moment from "moment";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

// 初始化环境变量和路径
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: `${__dirname}/.env` });

// ─────────────────────────────────────────────
// 环境变量校验（启动时检查，缺失则提前退出）
// ─────────────────────────────────────────────
function checkSecrets() {
    const required = [];

    // 单账号模式必填项
    const isSingleMode = !process.env.NINEBOT_ACCOUNTS;
    if (isSingleMode) {
        if (!process.env.NINEBOT_DEVICE_ID)     required.push("NINEBOT_DEVICE_ID");
        if (!process.env.NINEBOT_AUTHORIZATION) required.push("NINEBOT_AUTHORIZATION");
    }

    if (required.length > 0) {
        console.error(`[启动校验] ❌ 缺少必要的环境变量: ${required.join(", ")}`);
        console.error("[启动校验] 请在仓库 Settings → Secrets and variables → Actions 中配置");
        process.exit(1);
    }
    console.log("[启动校验] ✅ 环境变量校验通过");
}

// ─────────────────────────────────────────────
// 核心：NineBot 账号操作类
// ─────────────────────────────────────────────
class NineBot {
    constructor(deviceId, authorization, name = "九号出行") {
        if (!deviceId || !authorization) {
            throw new Error("缺少必要的参数: deviceId 或 authorization");
        }

        this.msg = [];
        this.name = name;
        this.deviceId = deviceId;
        this.authorization = authorization;

        // 签到/状态接口通用 Headers
        this.headers = {
            Accept: "application/json, text/plain, */*",
            Authorization: authorization,
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-CN,zh-Hans;q=0.9",
            "Content-Type": "application/json",
            Host: "cn-cbu-gateway.ninebot.com",
            Origin: "https://h5-bj.ninebot.com",
            from_platform_1: "1",
            language: "zh",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Segway v6 C 609033420",
            Referer: "https://h5-bj.ninebot.com/",
        };

        // 分享任务 & 盲盒专用 Headers（Access-Token 格式）
        this.headersV2 = {
            Host: "cn-cbu-gateway.ninebot.com",
            "User-Agent": "Ninebot/6.10.1 (cn.ninebot.segway; build:3676; iOS 26.3.1) Alamofire/5.6.1",
            "Access-Token": authorization,
            "Device-Id": deviceId,
            "Content-Type": "application/json",
            Platform: "iOS",
            Language: "zh",
            "App-Version": "610013676",
            Accept: "application/json",
        };

        // API 端点
        this.endpoints = {
            sign:         "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/sign",
            status:       "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/status",
            milestoneList: "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v1/milestone/list",
            milestoneClaim: "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v1/milestone/claim",
        };

        // 请求配置：重试 3 次，每次递增等待
        this.requestConfig = {
            timeout: 15000,
            maxRetries: 3,
            retryBaseDelay: 2000, // 毫秒，实际等待 = retryBaseDelay * attempt
        };
    }

    // ── 带指数退避重试的底层请求方法 ──────────────
    async makeRequest(method, url, data = null, customHeaders = null) {
        const headers = customHeaders || this.headers;
        let lastError;

        for (let attempt = 1; attempt <= this.requestConfig.maxRetries; attempt++) {
            try {
                console.log(`[${this.name}] 尝试 ${attempt}/${this.requestConfig.maxRetries}: ${method.toUpperCase()} ${url}`);
                const response = await axios({ method, url, data, headers, timeout: this.requestConfig.timeout });
                return response.data;
            } catch (error) {
                lastError = error;
                const isRetryable = !error.response || [429, 500, 502, 503, 504].includes(error.response?.status);
                console.warn(`[${this.name}] 请求失败 (${attempt}/${this.requestConfig.maxRetries}): ${error.message}`);

                if (attempt < this.requestConfig.maxRetries && isRetryable) {
                    const delay = this.requestConfig.retryBaseDelay * attempt;
                    console.log(`[${this.name}] ${delay / 1000}s 后重试...`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        throw lastError;
    }

    // ── 添加日志条目 ──────────────────────────────
    addLog(name, value) {
        this.msg.push({ name, value });
    }

    // ── 提取错误信息 ──────────────────────────────
    getErrorMessage(error) {
        return error.response
            ? `HTTP ${error.response.status}: ${error.response.data?.msg || error.message}`
            : error.message;
    }

    // ── 获取日志文本 ──────────────────────────────
    get logs() {
        return this.msg.map(o => `${o.name}: ${o.value}`).join("\n");
    }

    // ══════════════════════════════════════════════
    // 1. 验证登录 & 获取签到状态
    // ══════════════════════════════════════════════
    async valid() {
        try {
            console.log(`[${this.name}] 验证登录状态...`);
            const timestamp = moment().valueOf();
            const data = await this.makeRequest("get", `${this.endpoints.status}?t=${timestamp}`);

            if (data.code === 0) {
                console.log(`[${this.name}] 登录验证成功`);
                return [data.data, ""];
            }
            const msg = data.msg || "验证失败";
            console.error(`[${this.name}] 验证失败: ${msg}`);
            return [false, msg];
        } catch (error) {
            const msg = `登录验证异常: ${this.getErrorMessage(error)}`;
            console.error(`[${this.name}] ${msg}`);
            return [false, msg];
        }
    }

    // ══════════════════════════════════════════════
    // 2. 执行签到
    // ══════════════════════════════════════════════
    async sign() {
        try {
            console.log(`[${this.name}] 执行签到...`);
            const data = await this.makeRequest("post", this.endpoints.sign, { deviceId: this.deviceId });

            if (data.code === 0) {
                console.log(`[${this.name}] 签到成功`);
                return true;
            }
            const msg = data.msg || "未知错误";
            this.addLog("签到结果", `签到失败: ${msg}`);
            console.error(`[${this.name}] 签到失败: ${msg}`);
            return false;
        } catch (error) {
            const msg = this.getErrorMessage(error);
            this.addLog("签到结果", `签到异常: ${msg}`);
            console.error(`[${this.name}] 签到异常: ${msg}`);
            return false;
        }
    }



    // ══════════════════════════════════════════════
    // 4. 签到里程碑领取（连续签到奖励）
    // ══════════════════════════════════════════════
    async checkMilestone() {
        console.log(`[${this.name}] 检查签到里程碑...`);
        this.addLog("=== 签到里程碑 ===", "");

        try {
            // 获取里程碑列表
            const listData = await this.makeRequest("get", this.endpoints.milestoneList, null, this.headers);

            if (listData.code !== 0) {
                const msg = listData.msg || "获取失败";
                console.warn(`[${this.name}] 里程碑列表获取失败: ${msg}`);
                this.addLog("里程碑", `❌ ${msg}`);
                return;
            }

            const milestones = listData.data?.list || [];
            if (milestones.length === 0) {
                this.addLog("里程碑", "暂无里程碑任务");
                return;
            }

            // 显示所有里程碑状态
            let claimableCount = 0;
            for (const item of milestones) {
                const status = item.status === 1 ? "✅ 已领取" : item.status === 2 ? "🎁 可领取" : `⏳ 还差${item.remainingDays}天`;
                this.addLog(`${item.days}天奖励`, `${item.rewardName || '未知奖励'} - ${status}`);
                if (item.status === 2) claimableCount++;
            }

            // 领取可领取的奖励
            if (claimableCount === 0) {
                this.addLog("里程碑领取", "暂无可领取奖励");
                return;
            }

            let claimedCount = 0;
            for (const item of milestones) {
                if (item.status !== 2) continue;

                try {
                    const claimData = await this.makeRequest(
                        "post",
                        this.endpoints.milestoneClaim,
                        { milestoneId: item.milestoneId },
                        this.headers
                    );

                    if (claimData.code === 0) {
                        console.log(`[${this.name}] ${item.days}天里程碑奖励领取成功: ${item.rewardName}`);
                        claimedCount++;
                    } else {
                        console.warn(`[${this.name}] ${item.days}天里程碑领取失败: ${claimData.msg}`);
                    }
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) {
                    console.warn(`[${this.name}] 领取${item.days}天奖励异常: ${this.getErrorMessage(e)}`);
                }
            }

            this.addLog("里程碑领取", `✅ 成功领取 ${claimedCount}/${claimableCount} 个奖励`);

        } catch (error) {
            const msg = this.getErrorMessage(error);
            console.error(`[${this.name}] 里程碑检查异常: ${msg}`);
            this.addLog("里程碑检查", `❌ 异常: ${msg}`);
        }
    }

    // ══════════════════════════════════════════════
    // 主流程：按顺序执行所有任务
    // ══════════════════════════════════════════════
    async run() {
        console.log(`\n[${this.name}] ▶ 开始执行所有任务`);

        try {
            // ── 阶段一：签到 ──────────────────────────
            const [validData, errInfo] = await this.valid();

            if (!validData) {
                this.addLog("验证结果", errInfo || "登录验证失败，请检查 Token 是否过期");
                console.error(`[${this.name}] 登录失败，跳过后续任务`);
                return;
            }

            const isSignedToday = validData.currentSignStatus === 1;
            this.addLog("连续签到天数", `${validData.consecutiveDays || 0} 天`);
            this.addLog("今日签到状态", isSignedToday ? "已签到 🎉" : "未签到 ❌");

            if (!isSignedToday) {
                const signSuccess = await this.sign();
                if (signSuccess) {
                    // 重新拉取最新数据
                    const [newData] = await this.valid();
                    if (newData) {
                        this.msg = this.msg.map(item =>
                            item.name === "连续签到天数"
                                ? { name: "连续签到天数", value: `${newData.consecutiveDays || 0} 天` }
                                : item.name === "今日签到状态"
                                    ? { name: "今日签到状态", value: "已签到 🎉" }
                                    : item
                        );
                    }
                    this.addLog("签到结果", "✅ 签到成功");
                }
            } else {
                console.log(`[${this.name}] 今日已签到，跳过`);
            }

            // ── 阶段二：签到里程碑检查 ──────────────────
            await this.checkMilestone();

        } catch (error) {
            this.addLog("执行结果", `执行异常: ${error.message}`);
            console.error(`[${this.name}] 执行异常:`, error);
        } finally {
            console.log(`[${this.name}] ■ 所有任务执行完成`);
        }
    }
}

// ─────────────────────────────────────────────
// 推送：Bark（支持完整参数）
// ─────────────────────────────────────────────
async function sendBarkNotification(title, message) {
    const barkKey = process.env.BARK_KEY;
    if (!barkKey) {
        console.log("[Bark] 未配置 BARK_KEY，跳过");
        return false;
    }

    const barkUrl = (process.env.BARK_URL || "https://api.day.app").replace(/\/$/, "");

    try {
        let url = `${barkUrl}/${barkKey}/${encodeURIComponent(title)}/${encodeURIComponent(message)}`;

        const params = [];
        if (process.env.BARK_GROUP)     params.push(`group=${encodeURIComponent(process.env.BARK_GROUP)}`);
        if (process.env.BARK_ICON)      params.push(`icon=${encodeURIComponent(process.env.BARK_ICON)}`);
        if (process.env.BARK_SOUND)     params.push(`sound=${encodeURIComponent(process.env.BARK_SOUND)}`);
        if (process.env.BARK_URL_JUMP)  params.push(`url=${encodeURIComponent(process.env.BARK_URL_JUMP)}`);
        if (process.env.BARK_AUTO_COPY === "1") params.push("autoCopy=1");
        if (process.env.BARK_COPY) {
            const dayMatch = message.match(/连续签到天数: (\d+)/);
            const day = dayMatch ? dayMatch[1] : "未知";
            params.push(`copy=${encodeURIComponent(process.env.BARK_COPY.replace("%day%", day))}`);
        }

        if (params.length > 0) url += `?${params.join("&")}`;

        const response = await axios.get(url, { timeout: 8000 });
        if (response.data.code === 200) {
            console.log("[Bark] ✅ 通知发送成功");
            return true;
        }
        console.error("[Bark] ❌ 通知发送失败:", response.data);
        return false;
    } catch (error) {
        console.error("[Bark] ❌ 发送异常:", error.message);
        return false;
    }
}

// ─────────────────────────────────────────────
// 推送：PushPlus
// ─────────────────────────────────────────────
async function sendPushPlusNotification(title, message) {
    const token = process.env.PUSHPLUS_TOKEN;
    if (!token) {
        console.log("[PushPlus] 未配置 PUSHPLUS_TOKEN，跳过");
        return false;
    }

    try {
        const response = await axios.post(
            "https://www.pushplus.plus/send",
            {
                token,
                title,
                content: message.replace(/\n/g, "<br>"),
                template: "html",
            },
            { timeout: 10000, headers: { "Content-Type": "application/json" } }
        );

        if (response.data.code === 200) {
            console.log("[PushPlus] ✅ 通知发送成功");
            return true;
        }
        console.error("[PushPlus] ❌ 通知发送失败:", response.data.msg);
        return false;
    } catch (error) {
        console.error("[PushPlus] ❌ 发送异常:", error.message);
        return false;
    }
}

// ─────────────────────────────────────────────
// 入口：解析账号 → 执行 → 汇总推送
// ─────────────────────────────────────────────
async function init() {
    // 1. 环境变量校验（缺失则退出）
    checkSecrets();

    // 2. 解析账号列表
    let accounts = [];

    if (process.env.NINEBOT_ACCOUNTS) {
        // 多账号 JSON 模式
        try {
            const parsed = JSON.parse(process.env.NINEBOT_ACCOUNTS);
            accounts = parsed.map((acc, idx) => ({
                name:          acc.name || `账号${idx + 1}`,
                deviceId:      acc.deviceId,
                authorization: acc.authorization,
            }));
        } catch (e) {
            console.error("[账号解析] NINEBOT_ACCOUNTS JSON 格式错误:", e.message);
            process.exit(1);
        }
    } else {
        // 单账号模式
        accounts.push({
            name:          process.env.NINEBOT_NAME || "默认账号",
            deviceId:      process.env.NINEBOT_DEVICE_ID,
            authorization: process.env.NINEBOT_AUTHORIZATION,
        });
    }

    if (accounts.length === 0) {
        console.error("[账号解析] 未解析到任何有效账号");
        process.exit(1);
    }

    // 3. 逐账号执行
    const allResults = [];
    for (const account of accounts) {
        console.log(`\n${"═".repeat(50)}`);
        console.log(`  账号: ${account.name}`);
        console.log(`${"═".repeat(50)}`);
        try {
            const bot = new NineBot(account.deviceId, account.authorization, account.name);
            await bot.run();
            const success = bot.logs.includes("签到成功") || bot.logs.includes("已签到");
            allResults.push({ name: account.name, success, logs: bot.logs });
        } catch (e) {
            allResults.push({ name: account.name, success: false, logs: `初始化失败: ${e.message}` });
        }
    }

    // 4. 生成汇总通知
    const title = "九号出行任务结果";
    const message = allResults
        .map(acc => {
            const icon = acc.success ? "✅" : "❌";
            return `${icon} ${acc.name}\n${acc.logs.split("\n").map(l => `  ${l}`).join("\n")}`;
        })
        .join("\n\n");

    console.log("\n" + "─".repeat(50));
    console.log("汇总结果:");
    console.log(message);
    console.log("─".repeat(50));

    // 5. 发送通知
    await sendBarkNotification(title, message);
    await sendPushPlusNotification(title, message);
}

// 启动
init().catch(err => {
    console.error("程序崩溃:", err);
    process.exit(1);
});
