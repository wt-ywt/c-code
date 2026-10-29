const store = require('../../utils/store.js');

const SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const SPANS = [1, 2, 3, 4];
const PARITIES = ['每周', '单周', '双周'];
const COLORS = ['#4a7cff', '#ff7a45', '#36b37e', '#9f6bff', '#ff5c8a', '#00a6b8'];
const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const WEEK_COUNT = 20;

Page({
  data: {
    id: '',
    isEdit: false,
    name: '',
    teacher: '',
    room: '',
    dayNames: DAY_NAMES,
    dayIndex: 0,
    sections: SECTIONS,
    startIndex: 0,
    spans: SPANS,
    spanIndex: 0,
    weeks: [],
    weekStartIndex: 0,
    weekEndIndex: 15,
    parities: PARITIES,
    parityIndex: 0,
    colors: COLORS,
    colorIndex: 0,
    preview: ''
  },

  onLoad(query) {
    const weeks = [];
    for (let i = 1; i <= WEEK_COUNT; i++) weeks.push(i);
    const patch = { weeks: weeks };

    if (query.id) {
      const c = store.getCourse(query.id);
      if (c) {
        const range = this.weekRange(c.weeks);
        patch.id = c.id;
        patch.isEdit = true;
        patch.name = c.name;
        patch.teacher = c.teacher || '';
        patch.room = c.room || '';
        patch.dayIndex = Math.min(Math.max(c.day - 1, 0), 6);
        patch.startIndex = Math.min(Math.max(c.start - 1, 0), SECTIONS.length - 1);
        patch.spanIndex = Math.max(SPANS.indexOf(c.span), 0);
        patch.weekStartIndex = range[0] - 1;
        patch.weekEndIndex = range[1] - 1;
        patch.parityIndex = this.parityOf(c.weeks, range[0], range[1]);
        patch.colorIndex = Math.max(COLORS.indexOf(c.color), 0);
      }
    } else if (query.week) {
      const w = Math.min(Math.max(parseInt(query.week, 10) - 1, 0), WEEK_COUNT - 1);
      patch.weekStartIndex = w;
      patch.weekEndIndex = Math.max(w, 15);
    }

    this.setData(patch, () => this.updatePreview());
  },

  weekRange(weeks) {
    if (!weeks || !weeks.length) return [1, WEEK_COUNT];
    return [weeks[0], weeks[weeks.length - 1]];
  },

  parityOf(weeks, start, end) {
    let total = 0;
    let odd = 0;
    for (let i = start; i <= end; i++) {
      total++;
      if (i % 2 === 1) odd++;
    }
    if (weeks.length === total) return 0;
    if (weeks.length === odd) return 1;
    return 2;
  },

  updatePreview() {
    const start = this.data.sections[this.data.startIndex];
    const span = this.data.spans[this.data.spanIndex];
    const end = start + span - 1;
    const text = this.data.dayNames[this.data.dayIndex] +
      ' 第' + start + (span > 1 ? '-' + end : '') + '节 · ' +
      this.data.parities[this.data.parityIndex] + ' ' +
      '第' + this.data.weeks[this.data.weekStartIndex] + '-' +
      this.data.weeks[this.data.weekEndIndex] + '周';
    this.setData({ preview: text });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch[field] = e.detail.value;
    this.setData(patch);
  },

  onPick(e) {
    const field = e.currentTarget.dataset.field;
    const patch = {};
    patch[field] = parseInt(e.detail.value, 10);
    this.setData(patch, () => this.updatePreview());
  },

  onColor(e) {
    this.setData({ colorIndex: parseInt(e.currentTarget.dataset.value, 10) });
  },

  buildWeeks() {
    const a = this.data.weekStartIndex + 1;
    const b = this.data.weekEndIndex + 1;
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    const parity = this.data.parityIndex;
    const list = [];
    for (let i = from; i <= to; i++) {
      if (parity === 1 && i % 2 === 0) continue;
      if (parity === 2 && i % 2 === 1) continue;
      list.push(i);
    }
    return list;
  },

  save() {
    const name = (this.data.name || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写课程名', icon: 'none' });
      return;
    }

    const weeks = this.buildWeeks();
    if (!weeks.length) {
      wx.showToast({ title: '周次范围无效', icon: 'none' });
      return;
    }

    const start = SECTIONS[this.data.startIndex];
    const span = SPANS[this.data.spanIndex];
    if (start + span - 1 > SECTIONS.length) {
      wx.showToast({ title: '超出当天节数', icon: 'none' });
      return;
    }

    const course = {
      id: this.data.id || store.newId(),
      name: name,
      teacher: (this.data.teacher || '').trim(),
      room: (this.data.room || '').trim(),
      day: this.data.dayIndex + 1,
      start: start,
      span: span,
      weeks: weeks,
      color: COLORS[this.data.colorIndex]
    };

    store.upsertCourse(course);
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(function () {
      wx.navigateBack();
    }, 400);
  },

  remove() {
    const that = this;
    wx.showModal({
      title: '删除课程',
      content: '确定删除「' + this.data.name + '」吗？',
      success(res) {
        if (res.confirm) {
          store.removeCourse(that.data.id);
          wx.navigateBack();
        }
      }
    });
  }
});
