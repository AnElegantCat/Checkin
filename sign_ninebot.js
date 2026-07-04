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
    MAX_RESPONSE_BYTES: 1024 * 1024,
    LOG_DIR: join(__dirname, "logs"),
    TOKEN_INVALID_ERROR: "Token失效/未授权，请重新抓包更新 authorization",
};

// 初始化日志目录
function initLogDir() {
    try {
        if (!existsSync(CONFIG.LOG_DIR)) {
            mkdirSync(CONFIG.LOG_DIR, { recursive: true });
        }
    } catch (e) {
        console.error("[ERROR] 创建日志目录失败:", e.message);
    }
}

// 获取日志文件路径（每次调用获取当前日期）
function getLogFile() {
    return join(CONFIG.LOG_DIR, `sign_${formatDate(new Date())}.log`);
}

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

function safeJsonStringify(value) {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// 指数退避 + 抖动
function getRetryDelay(attempt) {
    const exponential = CONFIG.BASE_DELAY * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;
    return Math.min(exponential + jitter, 30000);
}

function shouldRetryRequest(error) {
    if (error.noRetry) return false;
    if (!error.response) return true;

    const retryableStatus = [408, 409, 425, 429, 500, 502, 503, 504];
    return retryableStatus.includes(error.response.status);
}

// 日志记录
function log(level, message, data = null) {
    const timestamp = now();
    const prefix = `[${timestamp}] [${level}]`;
    const logLine = data 
        ? `${prefix} ${message} ${safeJsonStringify(data)}`
        : `${prefix} ${message}`;
    
    console.log(logLine);
    
    // 写入文件
    try {
        if (!existsSync(CONFIG.LOG_DIR)) {
            mkdirSync(CONFIG.LOG_DIR, { recursive: true });
        }
        appendFileSync(getLogFile(), logLine + "\n");
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

function normalizeAccount(acc, index) {
    if (!acc || typeof acc !== "object" || Array.isArray(acc)) {
        throw new Error(`账号${index + 1} 必须是对象`);
    }

    const name = String(acc.name || `账号${index + 1}`).trim();
    const deviceId = String(acc.deviceId || acc.device_id || acc.DeviceId || "").trim();
    let authorization = String(acc.authorization || acc.Authorization || acc.token || acc.Token || "").trim();
    // 漏写 Bearer 前缀是最常见的配置错误，自动补全
    if (authorization && !/^bearer\s/i.test(authorization)) {
        authorization = `Bearer ${authorization}`;
    }
    const missing = [];
    if (!deviceId) missing.push("deviceId");
    if (!authorization) missing.push("authorization");
    if (missing.length > 0) {
        throw new Error(`${name} 缺少字段: ${missing.join(", ")}`);
    }
    return { name, deviceId, authorization };
}

// Token 有效性校验
function checkTokenValid(data) {
    if (!data || typeof data !== "object") return true;
    const invalidCodes = [401, 403, 50001, 50002, 50003];

    // 检查错误码
    if (invalidCodes.includes(data.code)) return false;

    // 仅检查业务提示信息 msg，避免扫描整个响应体时被正常数据（如 xxToken 字段、"过期时间"文案）误伤
    const msg = String(data.msg || "").toLowerCase();
    if (!msg) return true;
    const invalidMsgs = ["token", "authorization", "未登录", "重新登录", "登录过期", "登录失效", "授权"];
    return !invalidMsgs.some(kw => msg.includes(kw));
}

// ==================== 核心类 ====================
class NineBot {
    constructor(deviceId, authorization, name = "九号出行") {
        this.name = name;
        this.deviceId = deviceId;
        this.authorization = authorization;
        this.logs = [];
        this.consecutiveDays = 0;
        this.isSignedToday = false;
        this.signSuccess = false;

        // 盲盒相关
        this.blindBoxResults = [];
        this.blindBoxSummary = "";
        
        // 创建 axios 实例
        this.client = axios.create({
            timeout: CONFIG.REQUEST_TIMEOUT,
            maxContentLength: CONFIG.MAX_RESPONSE_BYTES,
            maxBodyLength: CONFIG.MAX_RESPONSE_BYTES,
            headers: {
                Accept: "application/json",
                Authorization: authorization,
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "zh-CN,zh-Hans;q=0.9",
                "Content-Type": "application/json",
                aid: "10000004",
                device_id: deviceId,
                from_platform_1: "1",
                language: "zh",
                Origin: "https://h5-bj.ninebot.com",
                platform: "h5",
                Referer: "https://h5-bj.ninebot.com/",
                sys_language: "zh-CN",
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Segway v6 C 609033420",
            },
        });
        
        // 响应拦截器 - 统一错误处理 + Token 有效性检测
        this.client.interceptors.response.use(
            response => {
                // 检查响应体中的业务错误码
                const { data } = response;
                if (data && !checkTokenValid(data)) {
                    const err = new Error(CONFIG.TOKEN_INVALID_ERROR);
                    err.noRetry = true;
                    throw err;
                }
                return response;
            },
            error => {
                if (error.response) {
                    const { status, data } = error.response;
                    // 只记录 code/msg，不 dump 完整响应体（Actions 日志公开可见）
                    log("WARN", `HTTP ${status}`, { url: error.config?.url, code: data?.code, msg: data?.msg });
                    
                    // HTTP 级 Token 失效检测
                    if (status === 401 || status === 403) {
                        const err = new Error("授权已过期/失效，请更新 authorization");
                        err.noRetry = true;
                        throw err;
                    }
                    // 检查响应体中的错误码
                    if (data && !checkTokenValid(data)) {
                        const err = new Error(CONFIG.TOKEN_INVALID_ERROR);
                        err.noRetry = true;
                        throw err;
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
            blindBoxReceive: "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/blind-box/receive",
            blindBoxList: "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/blind-box/list",
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
                
                if (error.noRetry) {
                    throw error;
                }
                
                if (!shouldRetryRequest(error)) {
                    throw error;
                }

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

    // 领取当日盲盒
    async receiveBlindBox() {
        try {
            const data = await this.requestWithRetry("post", this.endpoints.blindBoxReceive, {});
            if (data.code === 0) {
                log("INFO", `[${this.name}] ✅ 盲盒领取成功`);
                return { success: true };
            }
            log("INFO", `[${this.name}] 盲盒: ${data.msg || "已领取/无资格"}`);
            return { success: false, error: data.msg };
        } catch (error) {
            log("WARN", `[${this.name}] 盲盒领取异常: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // 自动开箱：通过 receive 接口传入 rewardId 来开箱
    async openAvailableBoxes() {
        const boxResults = [];
        try {
            const data = await this.requestWithRetry("get", this.endpoints.blindBoxList);
            if (data.code !== 0) {
                throw new Error(data.msg || "盲盒列表查询失败");
            }
            const notOpened = data?.data?.notOpenedBoxes || [];
            const openedBefore = (data?.data?.openedBoxes || []).length;
            
            // 可开条件：rewardStatus === 1 或 leftDaysToOpen === 0
            const available = notOpened.filter(b => 
                b.rewardStatus === 1 || Number(b.leftDaysToOpen ?? -1) === 0
            );
            
            if (available.length === 0) {
                log("INFO", `[${this.name}] 无即时可开盲盒（待攒: ${notOpened.length}个）`);
                boxResults.push(`无即时可开盲盒（待开箱: ${notOpened.length}个）`);
                return { boxResults, summary: `盲盒: 已开${openedBefore}个 待开${notOpened.length}个(可开0个)` };
            }
            
            log("INFO", `[${this.name}] 待开盲盒: ${available.length}个`);
            let openedCount = 0;
            
            for (const box of available) {
                // 取 blindBoxIds[0] 作为 rewardId
                const rewardId = (box.blindBoxIds && box.blindBoxIds[0]) || box.boxId || box.id;
                if (!rewardId) {
                    boxResults.push(`❌ 盲盒缺少ID`);
                    continue;
                }
                try {
                    // 开箱 = 调用 receive 接口传入 rewardId
                    const openResp = await this.requestWithRetry("post", this.endpoints.blindBoxReceive, { rewardId: String(rewardId) });
                    if (openResp.code === 0) {
                        const typeName = openResp.data.rewardType === 1 ? "经验" : "N币";
                        const label = box.awardDays ? `${box.awardDays}天盲盒` : "盲盒";
                        boxResults.push(`${label}: +${openResp.data.rewardValue}${typeName}`);
                        openedCount++;
                    } else {
                        boxResults.push(`盲盒: ${openResp.msg || "开箱失败"}`);
                    }
                } catch (e) {
                    boxResults.push(`盲盒异常: ${String(e).substring(0, 25)}`);
                }
                await sleep(1200);
            }
            
            const summary = `盲盒: 已开${openedBefore + openedCount}个 待开${notOpened.length - openedCount}个(可开0个)`;
            return { boxResults, summary };
        } catch (error) {
            log("WARN", `[${this.name}] 盲盒列表异常: ${error.message}`);
            boxResults.push(`盲盒列表查询异常`);
            return { boxResults, summary: "盲盒: 查询失败" };
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
        this.isSignedToday = status.currentSignStatus === 1;
        this.consecutiveDays = status.consecutiveDays || 0;
        
        this.addLog("连续签到", `${this.consecutiveDays} 天`);
        this.addLog("今日状态", this.isSignedToday ? "✅ 已签到" : "⏳ 未签到");
        
        log("INFO", `[${this.name}] 连续签到: ${this.consecutiveDays} 天，今日: ${this.isSignedToday ? "已签到" : "未签到"}`);
        
        // 2. 执行签到（如果未签到）
        if (!this.isSignedToday) {
            const signResult = await this.doSign();
            
            if (signResult.success) {
                this.signSuccess = true;
                this.addLog("签到结果", "✅ 成功");
                log("INFO", `[${this.name}] 签到成功`);
                
                // 重新获取状态确认
                await sleep(1000);
                const newStatus = await this.getStatus();
                if (newStatus.success) {
                    this.consecutiveDays = newStatus.data.consecutiveDays || this.consecutiveDays;
                    this.addLog("连续签到", `${this.consecutiveDays} 天`);
                }
            } else {
                this.addLog("签到结果", `❌ ${signResult.error}`);
                log("ERROR", `[${this.name}] 签到失败: ${signResult.error}`);
                return false;
            }
        } else {
            this.signSuccess = true;
            log("INFO", `[${this.name}] 今日已签到，跳过`);
        }
        
        // 3. 盲盒领取+开箱（签到成功后）
        if (this.signSuccess) {
            // 领取当日盲盒
            const receiveResult = await this.receiveBlindBox();
            if (receiveResult.success) {
                this.addLog("盲盒领取", "✅ 已领取");
            }
            
            // 自动开箱
            const boxResult = await this.openAvailableBoxes();
            this.blindBoxResults = boxResult.boxResults;
            this.blindBoxSummary = boxResult.summary;
            if (boxResult.boxResults.length > 0) {
                this.addLog("盲盒开箱", boxResult.boxResults.join("; "));
            }
            
            log("INFO", `[${this.name}] ${this.blindBoxSummary}`);
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
        // 用 POST 发送，消息放请求体，避免多账号长消息超出 URL 长度限制
        const payload = { title, body: message };
        if (process.env.BARK_GROUP) payload.group = process.env.BARK_GROUP;
        if (process.env.BARK_ICON) payload.icon = process.env.BARK_ICON;
        if (process.env.BARK_SOUND) payload.sound = process.env.BARK_SOUND;

        try {
            const response = await axios.post(`${url}/${key}`, payload, {
                timeout: 10000,
                maxContentLength: CONFIG.MAX_RESPONSE_BYTES,
                maxBodyLength: CONFIG.MAX_RESPONSE_BYTES,
            });
            if (response.data?.code !== 200) {
                throw new Error(response.data?.message || `Bark返回异常: ${safeJsonStringify(response.data)}`);
            }
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
            const content = escapeHtml(message).replace(/\n/g, "<br>");
            const response = await axios.post("https://www.pushplus.plus/send", {
                token,
                title,
                content,
                template: "html",
            }, {
                timeout: 15000,
                maxContentLength: CONFIG.MAX_RESPONSE_BYTES,
                maxBodyLength: CONFIG.MAX_RESPONSE_BYTES,
            });
            if (response.data?.code !== 200) {
                throw new Error(response.data?.msg || `PushPlus返回异常: ${JSON.stringify(response.data)}`);
            }
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
// Actions 定时任务随机延迟 0-10 分钟，避免每天固定时刻从数据中心 IP 签到形成风控特征
// 仅在 schedule 触发时生效，手动触发和本地运行不延迟
async function randomStartupDelay() {
    if (process.env.GITHUB_EVENT_NAME !== "schedule") return;
    const delay = Math.floor(Math.random() * 10 * 60 * 1000);
    log("INFO", `随机延迟 ${Math.round(delay / 1000)} 秒后开始签到`);
    await sleep(delay);
}

async function init() {
    // 初始化日志目录
    initLogDir();

    log("INFO", "🚀 九号出行自动签到启动");

    try {
        checkSecrets();
        await randomStartupDelay();
        
        // 解析账号配置
        let accounts = [];
        if (process.env.NINEBOT_ACCOUNTS) {
            try {
                const parsed = JSON.parse(process.env.NINEBOT_ACCOUNTS);
                if (!Array.isArray(parsed) || parsed.length === 0) {
                    throw new Error("NINEBOT_ACCOUNTS 必须是非空 JSON 数组");
                }
                accounts = parsed.map(normalizeAccount);
                log("INFO", `已加载 ${accounts.length} 个账号（多账号模式）`);
            } catch (e) {
                log("ERROR", "NINEBOT_ACCOUNTS JSON 格式错误", { error: e.message });
                process.exit(1);
            }
        } else {
            accounts.push(normalizeAccount({
                name: process.env.NINEBOT_NAME || "默认账号",
                deviceId: process.env.NINEBOT_DEVICE_ID,
                authorization: process.env.NINEBOT_AUTHORIZATION,
            }, 0));
            log("INFO", "已加载 1 个账号（单账号模式）");
        }
        
        // 执行签到
        const results = [];
        let successCount = 0;
        
        for (const acc of accounts) {
            const bot = new NineBot(acc.deviceId, acc.authorization, acc.name);
            // 单个账号异常不影响其余账号
            let success = false;
            try {
                success = await bot.run();
            } catch (error) {
                log("ERROR", `[${acc.name}] 运行异常`, { error: error.message });
            }
            results.push({
                name: acc.name, 
                success, 
                consecutiveDays: bot.consecutiveDays,
                isSignedToday: bot.isSignedToday,
                signSuccess: bot.signSuccess,
                blindBoxResults: bot.blindBoxResults,
                blindBoxSummary: bot.blindBoxSummary,
            });
            if (success) successCount++;
            
            // 账号间延迟，避免请求过快
            if (accounts.length > 1) {
                await sleep(2000);
            }
        }
        
        // 构建简洁的推送消息
        const timeStr = now();

        const title = "九号出行签到结果";
        const message = results.map(r => {
            const emoji = r.signSuccess ? "✅" : "❌";
            const statusText = r.isSignedToday ? "今日已签到" : (r.signSuccess ? "签到成功 🎉" : "签到失败");
            const parts = [
                `${emoji} ${r.name}`,
                `连续签到: ${r.consecutiveDays} 天`,
                `签到结果: ${statusText}`,
            ];
            // 盲盒信息
            if (r.signSuccess && r.blindBoxSummary) {
                parts.push(r.blindBoxSummary);
            }
            if (r.blindBoxResults && r.blindBoxResults.length > 0) {
                parts.push(`开箱: ${r.blindBoxResults.join(", ")}`);
            }
            return parts.join("\n");
        }).join("\n\n");
        
        log("INFO", `${"-".repeat(40)}\n汇总: ${successCount}/${accounts.length} 成功\n${"-".repeat(40)}`);
        
        // 发送推送
        await PushNotifier.send(title, `${accounts[0]?.name || '用户'} ${timeStr}\n\n${message}`);
        
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
