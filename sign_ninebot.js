import axios from "axios";
import moment from "moment";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: `${__dirname}/.env` });

// 环境变量校验
function checkSecrets() {
    const required = [];
    if (!process.env.NINEBOT_ACCOUNTS) {
        if (!process.env.NINEBOT_DEVICE_ID) required.push("NINEBOT_DEVICE_ID");
        if (!process.env.NINEBOT_AUTHORIZATION) required.push("NINEBOT_AUTHORIZATION");
    }
    if (required.length > 0) {
        console.error(`[启动校验] ❌ 缺少环境变量: ${required.join(", ")}`);
        process.exit(1);
    }
    console.log("[启动校验] ✅ 环境变量校验通过");
}

// 核心类
class NineBot {
    constructor(deviceId, authorization, name = "九号出行") {
        this.msg = [];
        this.name = name;
        this.deviceId = deviceId;
        this.authorization = authorization;
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
        this.endpoints = {
            sign: "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/sign",
            status: "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/status",
        };
    }

    async makeRequest(method, url, data = null) {
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`[${this.name}] 尝试 ${attempt}/3: ${method.toUpperCase()} ${url}`);
                const response = await axios({ method, url, data, headers: this.headers, timeout: 15000 });
                return response.data;
            } catch (error) {
                console.warn(`[${this.name}] 请求失败 (${attempt}/3): ${error.message}`);
                if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }
        throw new Error("请求失败，已重试3次");
    }

    addLog(name, value) {
        this.msg.push({ name, value });
    }

    get logs() {
        return this.msg.map(o => `${o.name}: ${o.value}`).join("\n");
    }

    // 验证登录 & 获取签到状态
    async valid() {
        try {
            const data = await this.makeRequest("get", `${this.endpoints.status}?t=${moment().valueOf()}`);
            if (data.code === 0) return [data.data, ""];
            return [false, data.msg || "验证失败"];
        } catch (error) {
            return [false, `验证异常: ${error.message}`];
        }
    }

    // 执行签到
    async sign() {
        try {
            const data = await this.makeRequest("post", this.endpoints.sign, { deviceId: this.deviceId });
            if (data.code === 0) return true;
            this.addLog("签到结果", `❌ ${data.msg || "未知错误"}`);
            return false;
        } catch (error) {
            this.addLog("签到结果", `❌ 异常: ${error.message}`);
            return false;
        }
    }

    // 主流程
    async run() {
        console.log(`\n[${this.name}] ▶ 开始签到`);
        const [validData, errInfo] = await this.valid();

        if (!validData) {
            this.addLog("验证结果", errInfo || "登录验证失败");
            return;
        }

        const isSignedToday = validData.currentSignStatus === 1;
        this.addLog("连续签到", `${validData.consecutiveDays || 0} 天`);
        this.addLog("今日状态", isSignedToday ? "已签到 🎉" : "未签到");

        if (!isSignedToday) {
            const success = await this.sign();
            if (success) {
                const [newData] = await this.valid();
                this.addLog("签到结果", "✅ 成功");
                this.addLog("连续签到", `${newData?.consecutiveDays || validData.consecutiveDays} 天`);
            }
        }

        console.log(`[${this.name}] ■ 签到完成`);
    }
}

// Bark 推送
async function sendBark(title, message) {
    const key = process.env.BARK_KEY;
    if (!key) return;
    const url = (process.env.BARK_URL || "https://api.day.app").replace(/\/$/, "");
    const params = [];
    if (process.env.BARK_GROUP) params.push(`group=${encodeURIComponent(process.env.BARK_GROUP)}`);
    if (process.env.BARK_ICON) params.push(`icon=${encodeURIComponent(process.env.BARK_ICON)}`);
    if (process.env.BARK_SOUND) params.push(`sound=${encodeURIComponent(process.env.BARK_SOUND)}`);
    
    try {
        const fullUrl = `${url}/${key}/${encodeURIComponent(title)}/${encodeURIComponent(message)}${params.length ? "?" + params.join("&") : ""}`;
        await axios.get(fullUrl, { timeout: 8000 });
        console.log("[Bark] ✅ 发送成功");
    } catch (e) {
        console.error("[Bark] ❌ 发送失败:", e.message);
    }
}

// PushPlus 推送
async function sendPushPlus(title, message) {
    const token = process.env.PUSHPLUS_TOKEN;
    if (!token) return;
    try {
        await axios.post("https://www.pushplus.plus/send", {
            token, title,
            content: message.replace(/\n/g, "<br>"),
            template: "html",
        }, { timeout: 10000 });
        console.log("[PushPlus] ✅ 发送成功");
    } catch (e) {
        console.error("[PushPlus] ❌ 发送失败:", e.message);
    }
}

// 入口
async function init() {
    checkSecrets();

    let accounts = [];
    if (process.env.NINEBOT_ACCOUNTS) {
        try {
            const parsed = JSON.parse(process.env.NINEBOT_ACCOUNTS);
            accounts = parsed.map((acc, i) => ({
                name: acc.name || `账号${i + 1}`,
                deviceId: acc.deviceId,
                authorization: acc.authorization,
            }));
        } catch (e) {
            console.error("[账号解析] JSON 格式错误:", e.message);
            process.exit(1);
        }
    } else {
        accounts.push({
            name: process.env.NINEBOT_NAME || "默认账号",
            deviceId: process.env.NINEBOT_DEVICE_ID,
            authorization: process.env.NINEBOT_AUTHORIZATION,
        });
    }

    const results = [];
    for (const acc of accounts) {
        console.log(`\n${"═".repeat(40)}\n  账号: ${acc.name}\n${"═".repeat(40)}`);
        try {
            const bot = new NineBot(acc.deviceId, acc.authorization, acc.name);
            await bot.run();
            results.push({ name: acc.name, logs: bot.logs });
        } catch (e) {
            results.push({ name: acc.name, logs: `失败: ${e.message}` });
        }
    }

    const title = "九号出行签到结果";
    const message = results.map(r => `📱 ${r.name}\n${r.logs.split("\n").map(l => `  ${l}`).join("\n")}`).join("\n\n");
    
    console.log("\n" + "─".repeat(40) + "\n汇总:\n" + message + "\n" + "─".repeat(40));

    await sendBark(title, message);
    await sendPushPlus(title, message);
}

init().catch(err => {
    console.error("程序崩溃:", err);
    process.exit(1);
});
