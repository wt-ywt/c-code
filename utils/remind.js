const config = require('../config.js');

const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MINUTE = 60000;

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function toDate(input) {
  return new Date(String(input).replace(/-/g, '/'));
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffDays(a, b) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

function weekdayOf(d) {
  const w = d.getDay();
  return w === 0 ? 7 : w;
}

function weekNumberOf(date, termStart) {
  return Math.floor(diffDays(date, toDate(termStart)) / 7) + 1;
}

function parseTime(text) {
  const parts = String(text || '0:0').split(':');
  return { h: parseInt(parts[0], 10) || 0, m: parseInt(parts[1], 10) || 0 };
}

function atMinutes(date, minutes) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0
  );
}

function formatCountdown(minutes) {
  if (minutes <= 0) return '马上开始';
  if (minutes < 60) return minutes + ' 分钟后';
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? h + ' 小时 ' + m + ' 分后' : h + ' 小时后';
  }
  return Math.floor(minutes / 1440) + ' 天后';
}

function formatWhen(d, minutesOfDay) {
  return pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) +
    ' ' + WEEK_NAMES[weekdayOf(d) - 1] +
    ' ' + pad2(Math.floor(minutesOfDay / 60)) + ':' + pad2(minutesOfDay % 60);
}

/**
 * 找出下一节要上的课（纯函数，不碰 wx API，方便测试）。
 * 往后最多扫 8 天，所以周末也能看到下周一的课。
 */
function nextClass(options) {
  const opts = options || {};
  const courses = opts.courses || [];
  const sectionTimes = opts.sectionTimes || config.sectionTimes;
  const termStart = opts.termStart || config.termStart;
  const now = opts.now || new Date();

  let best = null;

  for (let i = 0; i < 8; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const wd = weekdayOf(day);
    const week = weekNumberOf(day, termStart);
    if (week < 1) continue;

    for (let j = 0; j < courses.length; j++) {
      const c = courses[j];
      if (c.day !== wd) continue;
      if (!c.weeks || c.weeks.indexOf(week) < 0) continue;
      const slot = sectionTimes[c.start - 1];
      if (!slot) continue;

      const t = parseTime(slot);
      const minutesOfDay = t.h * 60 + t.m;
      const startAt = atMinutes(day, minutesOfDay);
      if (startAt.getTime() <= now.getTime()) continue;

      if (!best || startAt.getTime() < best.startAt.getTime()) {
        best = { course: c, startAt: startAt, minutesOfDay: minutesOfDay, week: week };
      }
    }

    // 日期是递增的，第一天里找到的就是最近的，不用再看后面
    if (best) break;
  }

  if (!best) return null;

  const minutes = Math.round((best.startAt.getTime() - now.getTime()) / MINUTE);
  return {
    course: best.course,
    startAt: best.startAt,
    minutes: minutes,
    whenLabel: formatWhen(best.startAt, best.minutesOfDay),
    countdown: formatCountdown(minutes),
    week: best.week
  };
}

function cloudReady() {
  if (typeof getApp !== 'function') return false;
  const app = getApp();
  return !!(app && app.globalData && app.globalData.cloudReady);
}

function requestPermission(templateId) {
  return new Promise(function (resolve, reject) {
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: function (res) {
        if (res[templateId] === 'accept') resolve(true);
        else resolve(false);
      },
      fail: reject
    });
  });
}

function callRemindFn(data) {
  return wx.cloud.callFunction({ name: 'remind', data: data }).then(function (res) {
    return res.result;
  });
}

module.exports = {
  WEEK_NAMES: WEEK_NAMES,
  nextClass: nextClass,
  formatCountdown: formatCountdown,
  weekNumberOf: weekNumberOf,
  weekdayOf: weekdayOf,
  cloudReady: cloudReady,
  requestPermission: requestPermission,
  callRemindFn: callRemindFn
};
