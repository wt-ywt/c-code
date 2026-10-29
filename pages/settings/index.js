const config = require('../../config.js');
const store = require('../../utils/store.js');
const remind = require('../../utils/remind.js');

const ADVANCE_OPTIONS = [5, 10, 15, 20, 30];

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

Page({
  data: {
    cloudReady: false,
    templateReady: false,
    subscribed: false,
    advanceOptions: ADVANCE_OPTIONS,
    advanceIndex: 1,
    sectionTimes: [],
    slots: [],
    lastSync: '',
    busy: false
  },

  onLoad() {
    const times = wx.getStorageSync('sectionTimes') || config.sectionTimes.slice();
    const advance = wx.getStorageSync('advanceMinutes') || config.advanceMinutes;
    let advanceIndex = ADVANCE_OPTIONS.indexOf(advance);
    if (advanceIndex < 0) advanceIndex = 1;

    this.setData({
      cloudReady: remind.cloudReady(),
      templateReady: !!config.remindTemplateId,
      subscribed: !!wx.getStorageSync('remindEnabled'),
      sectionTimes: times,
      advanceIndex: advanceIndex,
      lastSync: wx.getStorageSync('remindLastSync') || ''
    });
    this.buildSlots();
  },

  buildSlots() {
    const slots = this.data.sectionTimes.map(function (time, i) {
      return { key: i, no: i + 1, time: time };
    });
    this.setData({ slots: slots });
  },

  onTimePick(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const times = this.data.sectionTimes.slice();
    times[index] = e.detail.value;
    this.setData({ sectionTimes: times });
    wx.setStorageSync('sectionTimes', times);
    this.buildSlots();
  },

  onAdvancePick(e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({ advanceIndex: index });
    wx.setStorageSync('advanceMinutes', ADVANCE_OPTIONS[index]);
  },

  onToggle(e) {
    if (e.detail.value) {
      this.enable();
    } else {
      this.disable();
    }
  },

  enable() {
    const that = this;

    if (!this.data.cloudReady) {
      wx.showToast({ title: '未配置云开发环境', icon: 'none' });
      this.setData({ subscribed: false });
      return;
    }
    if (!this.data.templateReady) {
      wx.showToast({ title: '未配置模板 ID', icon: 'none' });
      this.setData({ subscribed: false });
      return;
    }
    if (this.data.busy) return;
    this.setData({ busy: true });

    remind.requestPermission(config.remindTemplateId).then(function (accepted) {
      if (!accepted) {
        that.setData({ subscribed: false, busy: false });
        wx.showToast({ title: '你拒绝了授权', icon: 'none' });
        return null;
      }
      return that.sync(1);
    }).then(function () {
      that.setData({ busy: false });
    }).catch(function () {
      that.setData({ subscribed: false, busy: false });
      wx.showToast({ title: '开启失败', icon: 'none' });
    });
  },

  disable() {
    wx.setStorageSync('remindEnabled', false);
    this.setData({ subscribed: false });
    remind.callRemindFn({ action: 'disable' }).catch(function () {
      // 云函数没部署也不该影响本地开关
    });
    wx.showToast({ title: '已关闭提醒', icon: 'none' });
  },

  sync(quotaDelta) {
    const that = this;
    const payload = {
      courses: store.getCourses(),
      termStart: wx.getStorageSync('termStart') || config.termStart,
      sectionTimes: this.data.sectionTimes,
      advanceMinutes: ADVANCE_OPTIONS[this.data.advanceIndex],
      quotaDelta: quotaDelta || 0
    };

    return remind.callRemindFn({ action: 'sync', payload: payload }).then(function (res) {
      const stamp = that.nowLabel();
      wx.setStorageSync('remindEnabled', true);
      wx.setStorageSync('remindLastSync', stamp);
      that.setData({ subscribed: true, lastSync: stamp });
      if (quotaDelta > 0) {
        wx.showModal({
          title: '提醒已开启',
          content: '这次授权能收 1 条上课提醒。微信的一次性订阅就是这个规则：想多收几次，就关掉开关再打开一次。',
          showCancel: false
        });
      }
      return res;
    });
  },

  onManualSync() {
    if (!this.data.subscribed) {
      wx.showToast({ title: '先打开提醒开关', icon: 'none' });
      return;
    }
    this.sync(0).then(function () {
      wx.showToast({ title: '课表已同步', icon: 'success' });
    }).catch(function () {
      wx.showToast({ title: '同步失败', icon: 'none' });
    });
  },

  nowLabel() {
    const d = new Date();
    return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
});
