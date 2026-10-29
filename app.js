const config = require('./config.js');

App({
  globalData: {
    termStart: '',
    cloudReady: false
  },

  onLaunch() {
    // 学期第一周的周一，开学前在 config.js 里改成你自己的日期
    const saved = wx.getStorageSync('termStart');
    if (!saved) {
      wx.setStorageSync('termStart', config.termStart);
    }
    this.globalData.termStart = wx.getStorageSync('termStart') || config.termStart;

    // 没配 cloudEnv 就跳过，课程表和待办不依赖云开发
    if (config.cloudEnv && wx.cloud) {
      try {
        wx.cloud.init({ env: config.cloudEnv, traceUser: true });
        this.globalData.cloudReady = true;
      } catch (err) {
        this.globalData.cloudReady = false;
      }
    }
  }
});
