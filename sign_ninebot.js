import axios from "axios";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, appendFileSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

// ==================== 配置 ====================
const CONFIG = {
    MAX_RETRIES: 3,
    BASE_DELAY: 2000,
    REQUEST_TIMEOUT: 20000,
    LOG_DIR: join(__dirname, "logs"),
    LOG_FILE: join(__dirname, "logs", `sign_${formatDate(new Date())}.log`),
};

// ==================== 工具函数 ====================
function formatDate(date, format = "YYYY-MM-DD") {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hour = String(d.getHours()).padStart(2, "0");
    const minute = String(d.getMinutes()).padStart(2, "0");
    const second = String(d.getSeconds()).padStart(2, "0");
    
    return format
        .replace("YYYY", year)
        .replace("MM", month)
        .replace("DD", day)
        .replace("HH", hour)
        .replace("mm", minute)
        .replace("ss", second);
}

function now() {
    return formatDate(new Date(), "YYYY-MM-DD HH:mm:ss");
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 指数退避 + 抖动
function getRetryDelay(attempt) {
    const exponential = CONFIG.BASE_DELAY * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    return Math.min(exponential + jitter, 30000);
}

// 日志记录
function log(level, message, data = null) {
    const timestamp = now();
    const prefix = `[${timestamp}] [${level}]`;
    const logLine = data 
        ? `${prefix} ${message} ${JSON.stringify(data)}`
        : `${prefix} ${message}`;
    
    console.log(logLine);
    
    // 写入文件
    try {
        if (!existsSync(CONFIG.LOG_DIR)) {
            mkdirSync(CONFIG.LOG_DIR, { recursive: true });
        }
        appendFileSync(CONFIG.LOG_FILE, logLine + "\n");
    } catch (e) {
        // 文件写入失败不影响主程序
    }
}

// ==================== 环境校验 ====================
function checkSecrets() {
    const missing = [];
    if (!process.env.NINEBOT_ACCOUNTS) {
        if (!process.env.NINEBOT_DEVICE_ID) missing.push("NINEBOT_DEVICE_ID");
        if (!process.env.NINEBOT_AUTHORIZATION) missing.push("NINEBOT_AUTHORIZATION");
    }
    
    if (missing.length > 0) {
        log("ERROR", `缺少环境变量: ${missing.join(", ")}`);
        process.exit(1);
    }
    log("INFO", "环境变量校验通过");
}

// ==================== 核心类 ====================
class NineBot {
    constructor(deviceId, authorization, name = "九号出行") {
        this.name = name;
        this.deviceId = deviceId;
        this.authorization = authorization;
        this.logs = [];
        
        // 创建 axios 实例
        this.client = axios.create({
            timeout: CONFIG.REQUEST_TIMEOUT,
            headers: {
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
            },
        });
        
        // 响应拦截器 - 统一错误处理
        this.client.interceptors.response.use(
            response => response,
            error => {
                if (error.response) {
                    const { status, data } = error.response;
                    log("WARN", `HTTP ${status}`, { url: error.config?.url, data });
                    
                    // 401 可能是 token 过期
                    if (status === 401) {
                        throw new Error("授权已过期，请更新 authorization");
                    }
                } else if (error.request) {
                    log("WARN", "网络请求无响应", { url: error.config?.url });
                } else {
                    log("WARN", "请求配置错误", { message: error.message });
                }
                throw error;
            }
        );
        
        this.endpoints = {
            sign: "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/sign",
            status: "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/status",
        };
    }

    addLog(name, value) {
        this.logs.push({ name, value });
    }

    get logText() {
        return this.logs.map(o => `${o.name}: ${o.value}`).join("\n");
    }

    // 带重试的请求
    async requestWithRetry(method, url, data = null) {
        let lastError;
        
        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
            try {
                log("INFO", `[${this.name}] 请求 ${attempt}/${CONFIG.MAX_RETRIES}: ${method.toUpperCase()} ${url}`);
                
                const response = await this.client.request({
                    method,
                    url,
                    data,
                    params: method === "get" ? { t: Date.now() } : undefined,
                });
                
                return response.data;
            } catch (error) {
                lastError = error;
                const isLastAttempt = attempt === CONFIG.MAX_RETRIES;
                
                if (!isLastAttempt) {
                    const delay = getRetryDelay(attempt);
                    log("WARN", `[${this.name}] 请求失败，${delay}ms 后重试`, { error: error.message });
                    await sleep(delay);
                }
            }
        }
        
        throw new Error(`请求失败，已重试${CONFIG.MAX_RETRIES}次: ${lastError.message}`);
    }

    // 获取签到状态
    async getStatus() {
        try {
            const data = await this.requestWithRetry("get", this.endpoints.status);
            
            if (data.code === 0) {
                return { success: true, data: data.data };
            }
            return { success: false, error: data.msg || "获取状态失败" };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 执行签到
    async doSign() {
        try {
            const data = await this.requestWithRetry("post", this.endpoints.sign, {
                deviceId: this.deviceId,
            });
            
            if (data.code === 0) {
                return { success: true, data: data.data };
            }
            return { success: false, error: data.msg || "签到失败" };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 主流程
    async run() {
        log("INFO", `${"=".repeat(40)}\n  账号: ${this.name}\n${"=".repeat(40)}`);
        
        // 1. 获取当前状态
        const statusResult = await this.getStatus();
        
        if (!statusResult.success) {
            this.addLog("验证结果", `❌ ${statusResult.error}`);
            log("ERROR", `[${this.name}] 验证失败: ${statusResult.error}`);
            return false;
        }
        
        const status = statusResult.data;
        const isSignedToday = status.currentSignStatus === 1;
        
        this.addLog("连续签到", `${status.consecutiveDays || 0} 天`);
        this.addLog("今日状态", isSignedToday ? "✅ 已签到" : "⏳ 未签到");
        
        log("INFO", `[${this.name}] 连续签到: ${status.consecutiveDays || 0} 天，今日: ${isSignedToday ? "已签到" : "未签到"}`);
        
        // 2. 执行签到（如果未签到）
        if (!isSignedToday) {
            const signResult = await this.doSign();
            
            if (signResult.success) {
                this.addLog("签到结果", "✅ 成功");
                log("INFO", `[${this.name}] 签到成功`);
                
                // 重新获取状态确认
                await sleep(1000);
                const newStatus = await this.getStatus();
                if (newStatus.success) {
                    this.addLog("连续签到", `${newStatus.data.consecutiveDays || status.consecutiveDays} 天`);
                }
            } else {
                this.addLog("签到结果", `❌ ${signResult.error}`);
                log("ERROR", `[${this.name}] 签到失败: ${signResult.error}`);
                return false;
            }
        } else {
            log("INFO", `[${this.name}] 今日已签到，跳过`);
        }
        
        log("INFO", `[${this.name}] 签到流程完成`);
        return true;
    }
}

// ==================== 推送 ====================
class PushNotifier {
    static async bark(title, message) {
        const key = process.env.BARK_KEY;
        if (!key) return { success: false, skipped: true };
        
        const url = (process.env.BARK_URL || "https://api.day.app").replace(/\/$/, "");
        const params = new URLSearchParams();
        
        if (process.env.BARK_GROUP) params.append("group", process.env.BARK_GROUP);
        if (process.env.BARK_ICON) params.append("icon", process.env.BARK_ICON);
        if (process.env.BARK_SOUND) params.append("sound", process.env.BARK_SOUND);
        
        try {
            const queryString = params.toString();
            const fullUrl = `${url}/${key}/${encodeURIComponent(title)}/${encodeURIComponent(message)}${queryString ? '?' + queryString : ''}`;
            await axios.get(fullUrl, { timeout: 10000 });
            log("INFO", "[Bark] 推送成功");
            return { success: true };
        } catch (error) {
            log("ERROR", "[Bark] 推送失败", { error: error.message });
            return { success: false, error: error.message };
        }
    }

    static async pushPlus(title, message) {
        const token = process.env.PUSHPLUS_TOKEN;
        if (!token) return { success: false, skipped: true };
        
        try {
            await axios.post("https://www.pushplus.plus/send", {
                token,
                title,
                content: message.replace(/\n/g, "<br>"),
                template: "html",
            }, { timeout: 15000 });
            log("INFO", "[PushPlus] 推送成功");
            return { success: true };
        } catch (error) {
            log("ERROR", "[PushPlus] 推送失败", { error: error.message });
            return { success: false, error: error.message };
        }
    }

    static async send(title, message) {
        const results = await Promise.all([
            this.bark(title, message),
            this.pushPlus(title, message),
        ]);
        
        const allSkipped = results.every(r => r.skipped);
        if (allSkipped) {
            log("INFO", "未配置任何推送渠道");
        }
        
        return results;
    }
}

// ==================== 入口 ====================
async function init() {
    // 初始化日志目录
    initLogDir();
    
    log("INFO", "🚀 九号出行自动签到启动");
    
    try {
        checkSecrets();
        
        // 解析账号配置
        let accounts = [];
        if (process.env.NINEBOT_ACCOUNTS) {
            try {
                const parsed = JSON.parse(process.env.NINEBOT_ACCOUNTS);
                accounts = parsed.map((acc, i) => ({
                    name: acc.name || `账号${i + 1}`,
                    deviceId: acc.deviceId,
                    authorization: acc.authorization,
                }));
                log("INFO", `已加载 ${accounts.length} 个账号（多账号模式）`);
            } catch (e) {
                log("ERROR", "NINEBOT_ACCOUNTS JSON 格式错误", { error: e.message });
                process.exit(1);
            }
        } else {
            accounts.push({
                name: process.env.NINEBOT_NAME || "默认账号",
                deviceId: process.env.NINEBOT_DEVICE_ID,
                authorization: process.env.NINEBOT_AUTHORIZATION,
            });
            log("INFO", "已加载 1 个账号（单账号模式）");
        }
        
        // 执行签到
        const results = [];
        let successCount = 0;
        
        for (const acc of accounts) {
            const bot = new NineBot(acc.deviceId, acc.authorization, acc.name);
            const success = await bot.run();
            results.push({ name: acc.name, logs: bot.logText, success });
            if (success) successCount++;
            
            // 账号间延迟，避免请求过快
            if (accounts.length > 1) {
                await sleep(2000);
            }
        }
        
        // 汇总结果
        const title = `九号出行签到 - ${successCount}/${accounts.length} 成功`;
        const message = results.map(r => 
            `📱 ${r.name} ${r.success ? "✅" : "❌"}\n${r.logs.split("\n").map(l => `  ${l}`).join("\n")}`
        ).join("\n\n");
        
        log("INFO", `${"-".repeat(40)}\n汇总: ${successCount}/${accounts.length} 成功\n${"-".repeat(40)}`);
        
        // 发送推送
        await PushNotifier.send(title, message);
        
        // 如果有失败，返回非零退出码
        if (successCount < accounts.length) {
            process.exit(1);
        }
        
        log("INFO", "✅ 所有账号签到完成");
    } catch (error) {
        log("ERROR", "程序异常", { error: error.message, stack: error.stack });
        await PushNotifier.send("九号出行签到 - 程序异常", `错误: ${error.message}`);
        process.exit(1);
    }
}

init();
