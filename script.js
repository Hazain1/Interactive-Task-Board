/* ==========================================================================
   Task Flow Board (Kanban Lite)
   Plain ES6+, no frameworks. All state lives in the `tasks` array and is
   saved to localStorage after every change. The board is re-rendered from
   that array, so the DOM never becomes the source of truth.
   ========================================================================== */

'use strict';

// ---------- Constants ----------

const STORAGE_KEY = 'tasks';
const THEME_KEY = 'taskflow-theme';

const STATUSES = ['todo', 'in-progress', 'completed'];
const STATUS_LABELS = {
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'completed': 'Completed'
};
const CATEGORIES = ['Development', 'Design', 'Marketing'];
const PRIORITIES = ['Low', 'Medium', 'High'];

// Used to sort cards inside a column: high priority first
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

// How long the "Undo" toast stays visible (ms)
const TOAST_DURATION = 5000;

// ---------- DOM references ----------

const taskForm = document.getElementById('task-form');
const taskTitle = document.getElementById('task-title');
const taskDescription = document.getElementById('task-description');
const taskCategory = document.getElementById('task-category');
const taskPriority = document.getElementById('task-priority');
const formError = document.getElementById('form-error');

const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const priorityFilter = document.getElementById('priority-filter');
const clearFiltersBtn = document.getElementById('clear-filters');

const themeToggle = document.getElementById('theme-toggle');
const board = document.querySelector('.board-container');

const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');
const toastUndo = document.getElementById('toast-undo');

// ---------- Application state ----------

let tasks = loadTasks();
let lastDeleted = null;   // { task, index } kept so a delete can be undone
let toastTimer = null;
let draggedTaskId = null;

// ---------- Storage ----------

/**
 * Read tasks from localStorage. Anything malformed is dropped, so a bad
 * value in storage can't break the whole board.
 */
function loadTasks() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(raw)) return [];
    return raw.filter(isValidTask).map(task => ({
      description: '',
      createdAt: Date.now(),
      ...task
    }));
  } catch (error) {
    console.warn('Could not read saved tasks, starting with an empty board.', error);
    return [];
  }
}

/** Write the current tasks array to localStorage. */
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    // Happens in some private browsing modes or when storage is full
    console.warn('Could not save tasks to localStorage.', error);
  }
}

/** Basic shape check for a task loaded from storage. */
function isValidTask(task) {
  return Boolean(task) &&
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    STATUSES.includes(task.status) &&
    CATEGORIES.includes(task.category) &&
    PRIORITIES.includes(task.priority);
}

// ---------- Task operations ----------

/** Create a unique id. crypto.randomUUID is not available on plain http, hence the fallback. */
function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Handle the "Add task" form. */
function handleAddTask(event) {
  event.preventDefault();

  const title = taskTitle.value.trim();
  const description = taskDescription.value.trim();
  const category = taskCategory.value;
  const priority = taskPriority.value;

  // Validate and point the user at the first missing field
  const problem =
    (!title && { field: taskTitle, message: 'Please enter a task title.' }) ||
    (!category && { field: taskCategory, message: 'Please choose a category.' }) ||
    (!priority && { field: taskPriority, message: 'Please choose a priority.' });

  if (problem) {
    showFormError(problem.message);
    problem.field.focus();
    return;
  }

  tasks.push({
    id: createId(),
    title,
    description,
    category,
    priority,
    status: 'todo',
    createdAt: Date.now()
  });

  saveTasks();
  renderTasks();

  taskForm.reset();
  showFormError('');
  taskTitle.focus();
}

/** Move a task to another column. */
function updateTaskStatus(id, newStatus) {
  if (!STATUSES.includes(newStatus)) return;

  tasks = tasks.map(task =>
    task.id === id ? { ...task, status: newStatus } : task
  );
  saveTasks();
  renderTasks();
}

/** Remove a task, keeping a copy so it can be restored with "Undo". */
function deleteTask(id) {
  const index = tasks.findIndex(task => task.id === id);
  if (index === -1) return;

  lastDeleted = { task: tasks[index], index };
  tasks = tasks.filter(task => task.id !== id);

  saveTasks();
  renderTasks();
  showToast(`Deleted "${lastDeleted.task.title}"`);
}

/** Put the most recently deleted task back where it was. */
function undoDelete() {
  if (!lastDeleted) return;

  tasks.splice(lastDeleted.index, 0, lastDeleted.task);
  lastDeleted = null;

  saveTasks();
  renderTasks();
  hideToast();
}

// ---------- Rendering ----------

/** Return the tasks that match the search box and both dropdown filters. */
function getFilteredTasks() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedPriority = priorityFilter.value;

  return tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm);
    const matchesCategory = selectedCategory === 'All' || task.category === selectedCategory;
    const matchesPriority = selectedPriority === 'All' || task.priority === selectedPriority;
    return matchesSearch && matchesCategory && matchesPriority;
  });
}

/** Rebuild every column from the tasks array. */
function renderTasks() {
  const filteredTasks = getFilteredTasks();
  const filtersActive = filteredTasks.length !== tasks.length;

  STATUSES.forEach(status => {
    const list = document.getElementById(`list-${status}`);
    const columnTasks = filteredTasks
      .filter(task => task.status === status)
      .sort((a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt - b.createdAt
      );

    list.replaceChildren(); // clear the column

    if (columnTasks.length === 0) {
      list.appendChild(createEmptyState(filtersActive));
    } else {
      columnTasks.forEach(task => list.appendChild(createTaskCard(task)));
    }

    // Column badge shows what is currently visible in that column
    document.getElementById(`count-${status}`).textContent = columnTasks.length;
  });

  updateStats();
}

/** Header counter: active vs completed, always across all tasks (ignores filters). */
function updateStats() {
  const completed = tasks.filter(task => task.status === 'completed').length;
  document.getElementById('stat-active').textContent = tasks.length - completed;
  document.getElementById('stat-completed').textContent = completed;
  document.getElementById('stat-total').textContent = tasks.length;
}

/** Placeholder text for an empty column. */
function createEmptyState(filtersActive) {
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = filtersActive ? 'No matching tasks' : 'No tasks here yet';
  return empty;
}

/**
 * Build one task card. Text is set with textContent rather than innerHTML,
 * so a title like <img onerror=...> is shown as plain text and never run.
 */
function createTaskCard(task) {
  const card = document.createElement('article');
  card.className = 'task-card';
  card.dataset.id = task.id;
  card.dataset.priority = task.priority;
  card.draggable = true;
  if (task.status === 'completed') card.classList.add('is-completed');

  // Top row: priority badge and category tag
  const badges = document.createElement('div');
  badges.className = 'task-badges';
  badges.append(
    createElement('span', `badge badge-priority badge-${task.priority.toLowerCase()}`, task.priority),
    createElement('span', 'badge badge-category', task.category)
  );

  const title = createElement('h3', 'task-card-title', task.title);

  card.append(badges, title);

  if (task.description) {
    card.appendChild(createElement('p', 'task-card-description', task.description));
  }

  // Bottom row: status dropdown and delete button
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const statusSelect = document.createElement('select');
  statusSelect.className = 'status-select';
  statusSelect.dataset.action = 'move';
  statusSelect.setAttribute('aria-label', `Move "${task.title}" to`);
  STATUSES.forEach(status => {
    const option = new Option(STATUS_LABELS[status], status, false, status === task.status);
    statusSelect.add(option);
  });

  const deleteBtn = createElement('button', 'btn-danger', 'Delete');
  deleteBtn.type = 'button';
  deleteBtn.dataset.action = 'delete';
  deleteBtn.setAttribute('aria-label', `Delete "${task.title}"`);

  actions.append(statusSelect, deleteBtn);
  card.appendChild(actions);

  return card;
}

/** Small helper to create an element with a class and text in one line. */
function createElement(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

// ---------- Card actions (event delegation) ----------
// One listener on the board handles every card, including cards added later.

function handleBoardClick(event) {
  const deleteBtn = event.target.closest('[data-action="delete"]');
  if (!deleteBtn) return;

  const card = deleteBtn.closest('.task-card');
  deleteTask(card.dataset.id);
}

function handleBoardChange(event) {
  const select = event.target.closest('[data-action="move"]');
  if (!select) return;

  const card = select.closest('.task-card');
  updateTaskStatus(card.dataset.id, select.value);
}

// ---------- Drag and drop (native HTML5 API) ----------

function handleDragStart(event) {
  const card = event.target.closest('.task-card');
  if (!card) return;

  draggedTaskId = card.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', draggedTaskId); // needed for Firefox

  // Add the class on the next frame so the drag preview keeps the normal look
  requestAnimationFrame(() => card.classList.add('is-dragging'));
}

function handleDragEnd(event) {
  const card = event.target.closest('.task-card');
  if (card) card.classList.remove('is-dragging');
  draggedTaskId = null;
  clearDropHighlights();
}

function handleDragOver(event) {
  const column = event.target.closest('.column');
  if (!column || !draggedTaskId) return;

  event.preventDefault(); // without this the browser won't allow a drop
  event.dataTransfer.dropEffect = 'move';

  if (!column.classList.contains('is-drop-target')) {
    clearDropHighlights();
    column.classList.add('is-drop-target');
  }
}

function handleDragLeave(event) {
  const column = event.target.closest('.column');
  // Only remove the highlight when the pointer actually leaves the column,
  // not when it moves between child elements inside it
  if (column && !column.contains(event.relatedTarget)) {
    column.classList.remove('is-drop-target');
  }
}

function handleDrop(event) {
  const column = event.target.closest('.column');
  if (!column) return;

  event.preventDefault();
  const id = event.dataTransfer.getData('text/plain') || draggedTaskId;
  clearDropHighlights();

  if (id) updateTaskStatus(id, column.dataset.status);
}

function clearDropHighlights() {
  document.querySelectorAll('.column.is-drop-target')
    .forEach(column => column.classList.remove('is-drop-target'));
}

// ---------- Filters ----------

function clearFilters() {
  searchInput.value = '';
  categoryFilter.value = 'All';
  priorityFilter.value = 'All';
  renderTasks();
  searchInput.focus();
}

// ---------- Theme ----------

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  themeToggle.checked = theme === 'dark';
}

function handleThemeToggle() {
  const theme = themeToggle.checked ? 'dark' : 'light';
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) { /* ignore: the theme just won't be remembered */ }
}

// ---------- Form feedback & toast ----------

function showFormError(message) {
  formError.textContent = message;
}

function showToast(message) {
  toastMessage.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, TOAST_DURATION);
}

function hideToast() {
  toast.hidden = true;
  clearTimeout(toastTimer);
}

// ---------- Start-up ----------

function init() {
  // Sync the switch with whatever theme the inline script in <head> applied
  themeToggle.checked = document.documentElement.getAttribute('data-theme') === 'dark';

  taskForm.addEventListener('submit', handleAddTask);
  taskForm.addEventListener('input', () => showFormError(''));

  searchInput.addEventListener('input', renderTasks);
  categoryFilter.addEventListener('change', renderTasks);
  priorityFilter.addEventListener('change', renderTasks);
  clearFiltersBtn.addEventListener('click', clearFilters);

  themeToggle.addEventListener('change', handleThemeToggle);
  toastUndo.addEventListener('click', undoDelete);

  board.addEventListener('click', handleBoardClick);
  board.addEventListener('change', handleBoardChange);
  board.addEventListener('dragstart', handleDragStart);
  board.addEventListener('dragend', handleDragEnd);
  board.addEventListener('dragover', handleDragOver);
  board.addEventListener('dragleave', handleDragLeave);
  board.addEventListener('drop', handleDrop);

  // Keep several open tabs in sync with each other
  window.addEventListener('storage', event => {
    if (event.key === STORAGE_KEY) {
      tasks = loadTasks();
      renderTasks();
    }
  });

  renderTasks();
}

// The script tag sits at the end of <body>, so the DOM is already parsed here
init();
