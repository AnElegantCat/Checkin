const got = require('got');

// 失败才推送（静默成功）；正文只放失败原因，账号名/时间等渠道自带信息不重复
const notifyFail = async (title, content) => {
  const token = process.env.PUSHPLUS_TOKEN;

  if (!token) {
    console.log('未配置 PUSHPLUS_TOKEN，跳过失败推送');

    return;
  }

  try {
    const response = await got.post('https://www.pushplus.plus/send', {
      json: {
        token,
        title,
        content: String(content).slice(0, 500),
        template: 'txt'
      },
      responseType: 'json',
      timeout: { request: 10000 }
    });

    if (response.body && response.body.code === 200) {
      console.log('失败推送已发送');
    }
    else {
      console.log(`失败推送异常: ${JSON.stringify(response.body)}`);
    }
  }
  catch (e) {
    // 推送本身失败不再抛出，避免掩盖签到的退出码
    console.log(`失败推送异常: ${e}`);
  }
};

module.exports = { notifyFail };
