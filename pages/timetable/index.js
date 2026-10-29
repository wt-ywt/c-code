const store = require('../../utils/store.js');
const term = require('../../utils/term.js');

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
    loading: true
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
  }
});
