// ==========================================
// 1. HELPER API (POIN 01 & 04)
// ==========================================

/**
 * Wrapper fungsi fetch() yang mengecek res.ok dan melempar Error jika server gagal
 */
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || errorData.error || `HTTP Error ${response.status}`;
    throw new Error(message);
  }

  // 204 No Content (DELETE)
  if (response.status === 204) return null;

  return response.json();
}

// ==========================================
// 2. STATE DATA & DOM ELEMENTS
// ==========================================

let tasks = [];
let currentFilter = 'semua';
let searchQuery = '';

const taskForm = document.getElementById('task-form');
const taskTitleInput = document.getElementById('task-title');
const taskMatkulSelect = document.getElementById('task-matkul');
const taskDeadlineInput = document.getElementById('task-deadline');
const errorMessage = document.getElementById('error-message');
const taskList = document.getElementById('task-list');
const taskCounter = document.getElementById('task-counter');
const filterButtons = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('search-input');
const submitBtn = taskForm.querySelector('button[type="submit"]');

// Helper Pesan Error UI Form
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}

// ==========================================
// 3. FUNGSI RENDER UI
// ==========================================

function render() {
  taskList.innerHTML = '';

  // Filter berdasarkan status & kata kunci pencarian
  const filteredTasks = tasks.filter(task => {
    const matchesFilter =
      currentFilter === 'semua' ||
      (currentFilter === 'aktif' && !task.selesai) ||
      (currentFilter === 'selesai' && task.selesai);

    const matchesSearch = task.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          task.matkul.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Urutkan berdasarkan deadline terdekat
  filteredTasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  // Update Counter
  const activeCount = tasks.filter(t => !t.selesai).length;
  taskCounter.textContent = `${activeCount} tugas aktif`;

  // State Kosong
  if (filteredTasks.length === 0) {
    taskList.innerHTML = '<li class="empty-state">Belum ada tugas yang sesuai.</li>';
    return;
  }

  // Render Daftar Tugas
  filteredTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item ${task.selesai ? 'completed' : ''}`;
    li.dataset.id = task.id;

    li.innerHTML = `
      <div class="task-info">
        <input type="checkbox" class="task-checkbox" ${task.selesai ? 'checked' : ''}>
        <div class="task-details">
          <span class="task-title-text"></span>
          <span class="task-meta">${task.matkul} · deadline ${task.deadline}</span>
        </div>
      </div>
      <button type="button" class="btn-delete">✕</button>
    `;

    // Proteksi XSS
    li.querySelector('.task-title-text').textContent = task.judul;

    taskList.appendChild(li);
  });
}

// ==========================================
// 4. PEMUATAN DATA PARALEL (POIN 01, 02 & 05)
// ==========================================

async function loadInitialData() {
  // State Loading
  taskList.innerHTML = '<li class="empty-state">Memuat tugas...</li>';
  hideError();

  try {
    // Promise.all untuk mengambil tugas & daftar mata kuliah secara bersamaan
    const [dataTugas, dataMatkul] = await Promise.all([
      api('/api/tugas'),
      api('/api/matkul')
    ]);

    // Opsi Mata Kuliah Dinamis
    if (Array.isArray(dataMatkul) && dataMatkul.length > 0) {
      taskMatkulSelect.innerHTML = dataMatkul
        .map(m => `<option value="${m}">${m}</option>`)
        .join('');
    }

    tasks = Array.isArray(dataTugas) ? dataTugas : [];
    render();

  } catch (error) {
    // State Error + Tombol Coba Lagi
    taskList.innerHTML = `
      <li class="empty-state">
        <p>Gagal memuat data dari server.</p>
        <button type="button" id="btn-retry" class="btn-retry">Coba Lagi</button>
      </li>
    `;
    taskCounter.textContent = '0 tugas aktif';

    const retryBtn = document.getElementById('btn-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', loadInitialData);
    }
  }
}

// ==========================================
// 5. FORM TAMBAH TUGAS - POST (POIN 02 & 03)
// ==========================================

taskForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const judul = taskTitleInput.value.trim();
  const matkul = taskMatkulSelect.value;
  const deadline = taskDeadlineInput.value;

  hideError();

  // Nonaktifkan tombol selama pengiriman
  submitBtn.disabled = true;

  try {
    const newTask = await api('/api/tugas', {
      method: 'POST',
      body: JSON.stringify({ judul, matkul, deadline })
    });

    tasks.push(newTask);
    taskForm.reset();
    render();
  } catch (error) {
    // Tampilkan pesan error dari server (seperti 400 Bad Request)
    showError(error.message);
  } finally {
    submitBtn.disabled = false;
  }
});

// ==========================================
// 6. EVENT DELEGATION - PATCH & DELETE (POIN 03 & 06)
// ==========================================

taskList.addEventListener('click', async function (e) {
  const li = e.target.closest('li');
  if (!li || !li.dataset.id) return;

  const taskId = Number(li.dataset.id);
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) return;

  // A. PATCH Selesai (dengan Optimistic Update)
  if (e.target.classList.contains('task-checkbox')) {
    const previousStatus = tasks[taskIndex].selesai;
    const newStatus = e.target.checked;

    // 1. Optimistic Update (Ubah UI Dulu)
    tasks[taskIndex].selesai = newStatus;
    render();

    try {
      await api(`/api/tugas/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ selesai: newStatus })
      });
    } catch (error) {
      // Rollback jika server gagal
      tasks[taskIndex].selesai = previousStatus;
      render();
      showError(`Gagal memperbarui status: ${error.message}`);
    }
  }

  // B. DELETE Hapus (dengan Optimistic Update)
  if (e.target.classList.contains('btn-delete')) {
    const originalTasks = [...tasks];

    // 1. Optimistic Update (Hapus dari UI Dulu)
    tasks = tasks.filter(t => t.id !== taskId);
    render();

    try {
      await api(`/api/tugas/${taskId}`, { method: 'DELETE' });
    } catch (error) {
      // Rollback jika server gagal
      tasks = originalTasks;
      render();
      showError(`Gagal menghapus tugas: ${error.message}`);
    }
  }
});

// ==========================================
// 7. DEBOUNCE SEARCH & FILTER (BONUS 06)
// ==========================================

// Helper Debounce
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

if (searchInput) {
  searchInput.addEventListener('input', debounce(function (e) {
    searchQuery = e.target.value.trim();
    render();
  }, 300));
}

filterButtons.forEach(button => {
  button.addEventListener('click', function () {
    filterButtons.forEach(btn => btn.classList.remove('on'));
    this.classList.add('on');
    currentFilter = this.dataset.filter;
    render();
  });
});

// Inisialisasi Aplikasi saat halaman dimuat
loadInitialData();