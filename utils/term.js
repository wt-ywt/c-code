// 必须是「第一周的周一」，否则表头和星期错位
const DEFAULT_TERM_START = '2026-08-31';
const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * iOS 不接受 "2026-09-01" 这种带连字符的格式，会返回 Invalid Date，
 * 必须替换成 "2026/09/01"。
 */
function toDate(input) {
  return new Date(String(input).replace(/-/g, '/'));
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatDate(d) {
  return pad(d.getMonth() + 1) + '/' + pad(d.getDate());
}

function getTermStart() {
  return wx.getStorageSync('termStart') || DEFAULT_TERM_START;
}

function currentWeek() {
  const start = toDate(getTermStart());
  const days = Math.floor((Date.now() - start.getTime()) / 86400000);
  const week = Math.floor(days / 7) + 1;
  return Math.min(Math.max(week, 1), 30);
}

function weekDates(week) {
  const start = toDate(getTermStart());
  const offset = (week - 1) * 7;
  const list = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + (offset + i) * 86400000);
    list.push({
      name: DAY_NAMES[i],
      date: formatDate(d)
    });
  }
  return list;
}

module.exports = {
  DAY_NAMES: DAY_NAMES,
  DEFAULT_TERM_START: DEFAULT_TERM_START,
  toDate: toDate,
  getTermStart: getTermStart,
  currentWeek: currentWeek,
  weekDates: weekDates
};
