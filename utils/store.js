const COURSE_KEY = 'courses';
const TODO_KEY = 'todos';

function getCourses() {
  return wx.getStorageSync(COURSE_KEY) || [];
}

function saveCourses(list) {
  wx.setStorageSync(COURSE_KEY, list);
}

function getCourse(id) {
  const list = getCourses();
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

function upsertCourse(course) {
  const list = getCourses();
  let hit = -1;
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === course.id) {
      hit = i;
      break;
    }
  }
  if (hit >= 0) {
    list[hit] = course;
  } else {
    list.push(course);
  }
  saveCourses(list);
}

function removeCourse(id) {
  saveCourses(getCourses().filter(function (c) {
    return c.id !== id;
  }));
}

function getTodos() {
  return wx.getStorageSync(TODO_KEY) || [];
}

function saveTodos(list) {
  wx.setStorageSync(TODO_KEY, list);
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = {
  getCourses: getCourses,
  saveCourses: saveCourses,
  getCourse: getCourse,
  upsertCourse: upsertCourse,
  removeCourse: removeCourse,
  getTodos: getTodos,
  saveTodos: saveTodos,
  newId: newId
};
