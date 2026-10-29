App({
  globalData: {
    termStart: ''
  },

  onLaunch() {
    // 学期第一周的周一，开学前改成你自己的日期
    const saved = wx.getStorageSync('termStart');
    if (!saved) {
      wx.setStorageSync('termStart', '2026-08-31');
    }
    this.globalData.termStart = wx.getStorageSync('termStart');
  }
});
