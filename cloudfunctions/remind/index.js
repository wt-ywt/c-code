const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const COLLECTION = 'remind_users';
const MAX_QUOTA = 50;

/**
 * 部署后到云开发控制台 → 云函数 remind → 配置 → 环境变量 里填：
 *   REMIND_TEMPLATE_ID   订阅消息模板 ID
 *   TEMPLATE_KEY_COURSE  课程名对应的模板字段（默认 thing1）
 *   TEMPLATE_KEY_TIME    时间对应的模板字段（默认 time2）
 *   TEMPLATE_KEY_ROOM    地点对应的模板字段（默认 thing3）
 *
 * 字段名一定要和你选用的模板一致，否则微信会报 47003。
 */
const TEMPLATE_ID = process.env.REMIND_TEMPLATE_ID || '';
const KEY_COURSE = process.env.TEMPLATE_KEY_COURSE || 'thing1';
const KEY_TIME = process.env.TEMPLATE_KEY_TIME || 'time2';
const KEY_ROOM = process.env.TEMPLATE_KEY_ROOM || 'thing3';

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

/** 云函数运行时区是 UTC，统一按北京时间算 */
function bjNow() {
  const t = new Date(Date.now() + 8 * 3600 * 1000);
  const wd = t.getUTCDay();
  return {
    y: t.getUTCFullYear(),
    mo: t.getUTCMonth(),
    d: t.getUTCDate(),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
    weekday: wd === 0 ? 7 : wd
  };
}

function dayIndexOf(y, mo, d) {
  return Math.floor(Date.UTC(y, mo, d) / 86400000);
}

function parseDate(text) {
  const parts = String(text || '').split('-');
  return { y: parseInt(parts[0], 10), mo: parseInt(parts[1], 10) - 1, d: parseInt(parts[2], 10) };
}

function weekNumberOf(termStart, now) {
  const s = parseDate(termStart);
  if (isNaN(s.y)) return 1;
  const a = dayIndexOf(now.y, now.mo, now.d);
  const b = dayIndexOf(s.y, s.mo, s.d);
  return Math.floor((a - b) / 7) + 1;
}

function parseMinutes(text) {
  const parts = String(text || '0:0').split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function clip(text, max) {
  const s = String(text || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** 找出这一轮该提醒的那节课，没有就返回 null */
function pickDue(doc, now) {
  const courses = doc.courses || [];
  const slots = doc.sectionTimes || [];
  const advance = doc.advanceMinutes || 10;
  const week = weekNumberOf(doc.termStart, now);

  let best = null;
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    if (c.day !== now.weekday) continue;
    if (!c.weeks || c.weeks.indexOf(week) < 0) continue;

    const slot = slots[c.start - 1];
    if (!slot) continue;

    const startMinutes = parseMinutes(slot);
    const diff = startMinutes - now.minutes;
    if (diff < 0 || diff > advance) continue;

    if (!best || diff < best.diff) {
      best = { course: c, diff: diff, slot: slot };
    }
  }

  if (!best) return null;

  return {
    course: best.course,
    slot: best.slot,
    key: now.y + '-' + pad2(now.mo + 1) + '-' + pad2(now.d) + '_' + best.course.id
  };
}

async function handleSync(openid, payload) {
  if (!openid) return { ok: false, reason: 'no openid' };

  const base = {
    openid: openid,
    courses: payload.courses || [],
    termStart: payload.termStart || '',
    sectionTimes: payload.sectionTimes || [],
    advanceMinutes: payload.advanceMinutes || 10,
    enabled: true,
    updatedAt: db.serverDate()
  };

  const quotaDelta = Math.max(parseInt(payload.quotaDelta, 10) || 0, 0);
  const res = await db.collection(COLLECTION).where({ openid: openid }).get();

  if (res.data.length) {
    const doc = res.data[0];
    const patch = Object.assign({}, base);
    if (quotaDelta > 0) {
      patch.quota = _.min([_.inc(quotaDelta), MAX_QUOTA]);
    }
    await db.collection(COLLECTION).doc(doc._id).update({ data: patch });
    return { ok: true, action: 'updated', quotaHit: quotaDelta > 0 };
  }

  await db.collection(COLLECTION).add({
    data: Object.assign({}, base, {
      quota: Math.min(quotaDelta, MAX_QUOTA),
      sent: {},
      createdAt: db.serverDate()
    })
  });

  return { ok: true, action: 'created' };
}

async function handleDisable(openid) {
  if (!openid) return { ok: false, reason: 'no openid' };
  await db.collection(COLLECTION).where({ openid: openid }).update({
    data: {
      enabled: false,
      quota: 0,
      updatedAt: db.serverDate()
    }
  });
  return { ok: true, action: 'disabled' };
}

async function handleTimer() {
  if (!TEMPLATE_ID) {
    return { ok: false, reason: 'REMIND_TEMPLATE_ID 未配置' };
  }

  const now = bjNow();
  // 半夜不打扰
  if (now.hour < 6 || now.hour > 23) {
    return { ok: true, skipped: 'night', sent: 0 };
  }

  const res = await db.collection(COLLECTION).where({ enabled: true }).limit(500).get();
  let sent = 0;
  let noQuota = 0;
  let failed = 0;

  for (let i = 0; i < res.data.length; i++) {
    const doc = res.data[i];
    const due = pickDue(doc, now);
    if (!due) continue;

    if (!doc.quota || doc.quota <= 0) {
      noQuota++;
      continue;
    }
    if (doc.sent && doc.sent[due.key]) continue;

    const data = {};
    data[KEY_COURSE] = { value: clip(due.course.name, 20) };
    data[KEY_TIME] = { value: due.slot };
    data[KEY_ROOM] = { value: clip(due.course.room || '未填写', 20) };

    try {
      await cloud.openapi.subscribeMessage.send({
        touser: doc.openid,
        templateId: TEMPLATE_ID,
        page: 'pages/timetable/index',
        miniprogramState: 'formal',
        lang: 'zh_CN',
        data: data
      });
    } catch (err) {
      // 43101：用户没订阅额度或已拒收，停止给这个人发
      failed++;
      if (err && String(err.errCode) === '43101') {
        await db.collection(COLLECTION).doc(doc._id).update({
          data: { quota: 0, updatedAt: db.serverDate() }
        }).catch(function () {});
      }
      continue;
    }

    sent++;

    const patch = { updatedAt: db.serverDate() };
    patch['sent.' + due.key] = true;
    patch.quota = _.inc(-1);
    await db.collection(COLLECTION).doc(doc._id).update({ data: patch });
  }

  return { ok: true, scanned: res.data.length, sent: sent, noQuota: noQuota, failed: failed };
}

exports.main = async (event) => {
  const action = (event && event.action) || '';

  if (action === 'sync') {
    const ctx = cloud.getWXContext();
    return handleSync(ctx.OPENID, event.payload || {});
  }

  if (action === 'disable') {
    const ctx = cloud.getWXContext();
    return handleDisable(ctx.OPENID);
  }

  // 定时触发器
  return handleTimer();
};
