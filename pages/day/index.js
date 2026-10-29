const store = require('../../utils/store.js');
const term = require('../../utils/term.js');

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

Page({
  data: {
    todos: [],
    left: 0,
    title: '',
    date: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const list = store.getTodos().map(function (t) {
      let diff = null;
      if (t.date) {
        diff = Math.round((term.toDate(t.date).getTime() - base) / 86400000);
      }
      let diffText = '';
      if (diff !== null) {
        if (diff > 0) diffText = '还剩 ' + diff + ' 天';
        else if (diff === 0) diffText = '就是今天';
        else diffText = '已过 ' + (-diff) + ' 天';
      }
      return {
        id: t.id,
        title: t.title,
        date: t.date,
        done: t.done,
        diff: diff === null ? 9999 : diff,
        diffText: diffText,
        urgent: !t.done && diff !== null && diff <= 1
      };
    });

    list.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.diff !== b.diff) return a.diff - b.diff;
      return 0;
    });

    let left = 0;
    for (let i = 0; i < list.length; i++) {
      if (!list[i].done) left++;
    }

    this.setData({
      todos: list,
      left: left,
      date: this.data.date || todayStr()
    });
  },

  onTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onDate(e) {
    this.setData({ date: e.detail.value });
  },

  add() {
    const title = (this.data.title || '').trim();
    if (!title) {
      wx.showToast({ title: '先写点内容', icon: 'none' });
      return;
    }
    const list = store.getTodos();
    list.push({
      id: store.newId(),
      title: title,
      date: this.data.date,
      done: false
    });
    store.saveTodos(list);
    this.setData({ title: '' });
    this.refresh();
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id;
    const list = store.getTodos().map(function (t) {
      if (t.id === id) {
        t.done = !t.done;
      }
      return t;
    });
    store.saveTodos(list);
    this.refresh();
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    const that = this;
    wx.showModal({
      title: '删除',
      content: '确定删除这条日程？',
      success(res) {
        if (res.confirm) {
          store.saveTodos(store.getTodos().filter(function (t) {
            return t.id !== id;
          }));
          that.refresh();
        }
      }
    });
  }
});
