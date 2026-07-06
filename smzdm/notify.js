const got = require('got');

const notifyResult = async (title, content) => {
  const message = String(content).slice(0, 1000);
  const results = await Promise.all([
    notifyPushPlus(title, message),
    notifyBark(title, message)
  ]);

  if (results.every(result => result.skipped)) {
    console.log('未配置 PUSHPLUS_TOKEN 或 BARK_KEY，跳过推送');
  }
};

const notifyFail = notifyResult;

const notifyPushPlus = async (title, content) => {
  const token = process.env.PUSHPLUS_TOKEN;
  if (!token) return { skipped: true };

  try {
    const response = await got.post('https://www.pushplus.plus/send', {
      json: {
        token,
        title,
        content,
        template: 'txt'
      },
      responseType: 'json',
      timeout: { request: 10000 }
    });

    if (response.body && response.body.code === 200) {
      console.log('PushPlus 推送已发送');
      return { success: true };
    }
    else {
      console.log(`PushPlus 推送异常: ${JSON.stringify(response.body)}`);
      return { success: false };
    }
  }
  catch (e) {
    // 推送本身失败不再抛出，避免掩盖签到的退出码
    console.log(`PushPlus 推送异常: ${e}`);
    return { success: false };
  }
};

const notifyBark = async (title, content) => {
  const key = process.env.BARK_KEY;
  if (!key) return { skipped: true };

  const url = (process.env.BARK_URL || 'https://api.day.app').replace(/\/$/, '');
  const payload = { title, body: content };
  if (process.env.BARK_GROUP) payload.group = process.env.BARK_GROUP;
  if (process.env.BARK_ICON) payload.icon = process.env.BARK_ICON;
  if (process.env.BARK_SOUND) payload.sound = process.env.BARK_SOUND;

  try {
    const response = await got.post(`${url}/${key}`, {
      json: payload,
      responseType: 'json',
      timeout: { request: 10000 }
    });

    if (response.body && response.body.code === 200) {
      console.log('Bark 推送已发送');
      return { success: true };
    }

    console.log(`Bark 推送异常: ${JSON.stringify(response.body)}`);
    return { success: false };
  }
  catch (e) {
    console.log(`Bark 推送异常: ${e}`);
    return { success: false };
  }
};

module.exports = { notifyResult, notifyFail };
