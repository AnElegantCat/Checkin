const crypto = require('crypto');
const got = require('got');

// ------------------------------------

const APP_VERSION = '10.4.26';
const APP_VERSION_REV = '866';

const DEFAULT_USER_AGENT_APP = `smzdm_android_V${APP_VERSION} rv:${APP_VERSION_REV} (Redmi Note 3;Android10.0;zh)smzdmapp`;
const DEFAULT_USER_AGENT_WEB = `Mozilla/5.0 (Linux; Android 10.0; Redmi Build/Redmi Note 3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36 smzdm_android_V${APP_VERSION} rv:${APP_VERSION_REV} (Redmi;Android10.0;zh) jsbv_1.0.0 webv_2.0 smzdmapp`;

const SIGN_KEY = 'apr1$AwP!wRRT$gJ/q.X24poeBInlUJC';

// ------------------------------------

const reVersion = /(smzdm_android_V|smzdm\s|iphone_smzdmapp\/)([\d.]+)/i;
const reRev = /rv:([\d.]+)/i;

const randomStr = (len = 18) => {
  const char = '0123456789';
  let str = '';

  for (let i = 0; i < len; i++) {
    str += char.charAt(Math.floor(Math.random() * char.length));
  }

  return str;
};

const parseJSON = (str) => {
  try {
    return JSON.parse(str);
  }
  catch (e) {
    return {};
  }
};

const removeTags = (str) => str.replace(/<[^<]+?>/g, '');

// debug 日志脱敏：Actions 日志对协作者可见，不能把完整 Cookie 明文打出去
const debugStringifyOptions = (gotOptions) => {
  const safe = { ...gotOptions };
  if (safe.headers && safe.headers.Cookie) {
    safe.headers = { ...safe.headers, Cookie: '***REDACTED***' };
  }
  return JSON.stringify(safe, null, 2);
};

// 添加公共参数并签名数据
const signFormData = (data) => {
  const newData = {
    weixin: 1,
    basic_v: 0,
    f: 'android',
    v: APP_VERSION,
    time: `${Math.round(new Date().getTime() / 1000)}000`,
    ...data
  };

  const keys = Object.keys(newData).filter(key => newData[key] !== '').sort();
  const signData = keys.map(key => `${key}=${String(newData[key]).replace(/\s+/g, '')}`).join('&');
  const sign = crypto.createHash('md5').update(`${signData}&key=${SIGN_KEY}`).digest('hex').toUpperCase();

  return {
    ...newData,
    sign
  };
};

// 公共请求函数
const requestApi = async (url, inputOptions = {}) => {
  const options = { ...inputOptions };

  if (!options.method) {
    options.method = 'get';
  }

  if (!options.data) {
    options.data = {};
  }

  Object.keys(options.data).forEach(key => options.data[key] === undefined && delete options.data[key]);

  if (options.sign !== false) {
    options.data = signFormData(options.data);
  }

  const gotOptions = {
    method: options.method.toUpperCase(),
    headers: options.headers,
    // got@11 默认无请求超时；接口挂起会一直卡到 workflow 30min 被强杀
    timeout: {
      request: 15000
    },
    retry: {
      limit: 2,
      methods: [
        'GET',
        'POST'
      ],
      // 恢复对限流/网关瞬时错误的重试（smzdm 风控/限流常见 429/5xx）
      statusCodes: [
        408,
        429,
        500,
        502,
        503,
        504
      ],
      errorCodes: [
        'ECONNRESET',
        'EAI_AGAIN'
      ]
    }
  };

  if (options.method === 'get') {
    gotOptions.searchParams = options.data;
  }
  else {
    gotOptions.form = options.data;
  }

  return got(url, gotOptions).then((response) => {
    const data = options.parseJSON === false ? response.body : parseJSON(response.body);

    if (options.debug) {
      console.log('------------------------');
      console.log(url);
      console.log('------------------------');
      console.log(debugStringifyOptions(gotOptions));
      console.log('------------------------');
      console.log(options.parseJSON === false ? response.body : JSON.stringify(data, null, 2));
      console.log('------------------------');
    }

    return {
      isSuccess: options.parseJSON === false ? true : (data.error_code == '0'),
      response: options.parseJSON === false ? response.body : JSON.stringify(data, null, 2),
      data
    };
  }).catch((error) => {
    if (options.debug) {
      console.log('------------------------');
      console.log(url);
      console.log('------------------------');
      console.log(debugStringifyOptions(gotOptions));
      console.log('------------------------');
      console.log(error);
      console.log('------------------------');
    }

    return {
      isSuccess: false,
      response: error,
      data: error
    };
  })
};

const updateCookie = (cookie, name, value) => {
  const re = new RegExp(`(^|;)${name}=[^;]+;`, 'ig');

  return cookie.replace(re, `$1${name}=${encodeURIComponent(value)};`);
};

const getEnvCookies = () => {
  let cookies = [];

  // 判断环境变量里面是否有 cookie
  if (process.env.SMZDM_COOKIE) {
    if (process.env.SMZDM_COOKIE.indexOf('&') > -1) {
      cookies = process.env.SMZDM_COOKIE.split('&');
    }
    else if (process.env.SMZDM_COOKIE.indexOf('\n') > -1) {
      cookies = process.env.SMZDM_COOKIE.split('\n');
    }
    else {
      cookies = [process.env.SMZDM_COOKIE];
    }
  }

  return cookies[0] ? cookies : false;
};

const randomDecimal = (min, max, decimal) => {
  const rand = Math.random() * (max - min + 1) + min;

  return Math.floor(rand * decimal) / decimal;
};

const wait = (minSecond, maxSecond) => {
  // 生成随机小数秒数
  const randomSecond = randomDecimal(minSecond, maxSecond, 1000);

  console.log(`等候 ${minSecond}-${maxSecond}(${randomSecond}) 秒`);

  return new Promise(resolve => setTimeout(resolve, randomSecond * 1000));
};

// ------------------------------------

class SmzdmBot {
  constructor(cookie) {
    this.cookie = cookie.trim();

    // 兼容 cookie 末位无尾随分号的情况（原 /sess=(.*?);/ 会漏取，导致 token 为空）
    const match = this.cookie.match(/sess=([^;]*)/);
    this.token = match ? match[1] : '';

    // 处理 cookie
    this.androidCookie = this.cookie.replace('iphone', 'android').replace('iPhone', 'Android');
    this.androidCookie = updateCookie(this.androidCookie, 'smzdm_version', APP_VERSION);
    this.androidCookie = updateCookie(this.androidCookie, 'device_smzdm_version', APP_VERSION);
    this.androidCookie = updateCookie(this.androidCookie, 'v', APP_VERSION);
    this.androidCookie = updateCookie(this.androidCookie, 'device_smzdm_version_code', APP_VERSION_REV);
    this.androidCookie = updateCookie(this.androidCookie, 'device_system_version', '10.0');
    this.androidCookie = updateCookie(this.androidCookie, 'apk_partner_name', 'smzdm_download');
    this.androidCookie = updateCookie(this.androidCookie, 'partner_name', 'smzdm_download');
    this.androidCookie = updateCookie(this.androidCookie, 'device_type', 'Android');
    this.androidCookie = updateCookie(this.androidCookie, 'device_smzdm', 'android');
    this.androidCookie = updateCookie(this.androidCookie, 'device_name', 'Android');
  }

  getHeaders() {
    let userAgent = DEFAULT_USER_AGENT_APP;

    if (process.env.SMZDM_USER_AGENT_APP) {
      userAgent = process.env.SMZDM_USER_AGENT_APP
        .replace(reVersion, `$1${APP_VERSION}`)
        .replace(reRev, `rv:${APP_VERSION_REV}`);
    }

    return {
      Accept: '*/*',
      'Accept-Language': 'zh-Hans-CN;q=1',
      'Accept-Encoding': 'gzip',
      'request_key': randomStr(18),
      'User-Agent': userAgent,
      Cookie: this.androidCookie
    };
  }

  getHeadersForWeb() {
    let userAgent = DEFAULT_USER_AGENT_WEB;

    if (process.env.SMZDM_USER_AGENT_WEB) {
      userAgent = process.env.SMZDM_USER_AGENT_WEB
        .replace(reVersion, `$1${APP_VERSION}`)
        .replace(reRev, `rv:${APP_VERSION_REV}`);
    }

    return {
      Accept: '*/*',
      'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
      'Accept-Encoding': 'gzip',
      'User-Agent': userAgent,
      Cookie: this.androidCookie
    };
  }

  getOneByRandom(listing) {
    return listing[Math.floor(Math.random() * listing.length)];
  }
}

module.exports = {
  SmzdmBot,
  requestApi,
  removeTags,
  parseJSON,
  getEnvCookies,
  wait
};