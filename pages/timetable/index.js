const config = require('../../config.js');
const store = require('../../utils/store.js');
const term = require('../../utils/term.js');
const remind = require('../../utils/remind.js');

const CELL_H = 50;        // 每节课高度（px），需与 WXSS 中 .cell 的 height 一致
const SECTION_COUNT = 8;  // 每天节数
const WEEK_COUNT = 20;    // 一学期周数
const COLORS = ['#4a7cff', '#ff7a45', '#36b37e', '#9f6bff', '#ff5c8a', '#00a6b8'];

Page({
  data: {
    week: 1,
    liveWeek: 1,
    weeks: [],
    days: [],
    sections: [],
    grid: [],
    showEmpty: false,
    loading: true,
    nextTip: '',
    nextSoon: false
  },

  onLoad() {
    const liveWeek = term.currentWeek();
    const weeks = [];
    const sections = [];
    for (let i = 1; i <= WEEK_COUNT; i++) weeks.push(i);
    for (let i = 1; i <= SECTION_COUNT; i++) sections.push(i);
    this.setData({
      liveWeek: liveWeek,
      week: liveWeek,
      weeks: weeks,
      sections: sections
    });
  },

  onShow() {
    this.render();
    this.tick();
    this.autoSync();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 30000);
  },

  onHide() {
    this.stopTimer();
  },

  onUnload() {
    this.stopTimer();
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  render() {
    const week = this.data.week;
    const grid = [];
    for (let i = 0; i < 7; i++) grid.push({ key: i, list: [] });

    const courses = store.getCourses().filter(function (c) {
      return c.weeks && c.weeks.indexOf(week) >= 0;
    });

    courses.forEach(function (c) {
      const day = Math.min(Math.max(c.day, 1), 7) - 1;
      grid[day].list.push({
        id: c.id,
        name: c.name,
        room: c.room,
        color: c.color || COLORS[day % COLORS.length],
        top: (c.start - 1) * CELL_H,
        height: c.span * CELL_H - 2
      });
    });

    this.setData({
      grid: grid,
      days: term.weekDates(week),
      showEmpty: courses.length === 0,
      loading: false
    });
  },

  tick() {
    const info = remind.nextClass({
      courses: store.getCourses(),
      sectionTimes: wx.getStorageSync('sectionTimes') || config.sectionTimes,
      termStart: wx.getStorageSync('termStart') || config.termStart
    });

    if (!info) {
      this.setData({ nextTip: '', nextSoon: false });
      return;
    }

    const c = info.course;
    let tip = c.name + ' · ' + info.whenLabel;
    if (c.room) tip += ' · ' + c.room;
    tip += ' · ' + info.countdown;

    this.setData({
      nextTip: tip,
      nextSoon: info.minutes <= 30
    });
  },

  // 课表改动后静默同步给云函数，保证推送用的是最新课程
  autoSync() {
    if (!wx.getStorageSync('remindEnabled')) return;
    if (!remind.cloudReady()) return;
    const now = Date.now();
    if (this.lastAutoSync && now - this.lastAutoSync < 5 * 60000) return;
    this.lastAutoSync = now;

    remind.callRemindFn({
      action: 'sync',
      payload: {
        courses: store.getCourses(),
        termStart: wx.getStorageSync('termStart') || config.termStart,
        sectionTimes: wx.getStorageSync('sectionTimes') || config.sectionTimes,
        advanceMinutes: wx.getStorageSync('advanceMinutes') || config.advanceMinutes,
        quotaDelta: 0
      }
    }).catch(function () {
      // 同步失败不打扰用户，设置页可以手动重试
    });
  },

  prevWeek() {
    if (this.data.week <= 1) return;
    const target = this.data.week - 1;
    this.setData({ week: target }, () => this.render());
  },

  nextWeek() {
    if (this.data.week >= WEEK_COUNT) return;
    const target = this.data.week + 1;
    this.setData({ week: target }, () => this.render());
  },

  backToday() {
    this.setData({ week: this.data.liveWeek }, () => this.render());
  },

  onWeekPick(e) {
    const target = parseInt(e.detail.value, 10) + 1;
    this.setData({ week: target }, () => this.render());
  },

  onCourseTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/edit/index?id=' + id });
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/edit/index?week=' + this.data.week });
  },

  goSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  }
});
