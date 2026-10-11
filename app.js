// ==========================================
// 1. STATE DATA & INITIALIZATION
// ==========================================

// Inisialisasi data tugas
let tasks = [];

let currentFilter = 'semua';

// DOM Elements
const taskForm = document.getElementById('task-form');
const taskTitleInput = document.getElementById('task-title');
const taskMatkulSelect = document.getElementById('task-matkul');
const taskDeadlineInput = document.getElementById('task-deadline');
const errorMessage = document.getElementById('error-message');
const taskList = document.getElementById('task-list');
const taskCounter = document.getElementById('task-counter');
const filterButtons = document.querySelectorAll('.filter-btn');

// Helper LocalStorage
function saveToLocalStorage() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Helper Pesan Error
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.textContent = '';
  errorMessage.classList.add('hidden');
}


// ==========================================
// 2. FUNGSI RENDER UTAMA
// ==========================================

function render() {
  // A. Bersihkan elemen list
  taskList.innerHTML = '';

  // B. Sorting berdasarkan deadline terdekat (Bonus)
  const sortedTasks = [...tasks].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  // C. Filter data sesuai status filter saat ini
  const filteredTasks = sortedTasks.filter(task => {
    if (currentFilter === 'aktif') return !task.selesai;
    if (currentFilter === 'selesai') return task.selesai;
    return true; // 'semua'
  });

  // D. Update counter tugas aktif
  const activeCount = tasks.filter(task => !task.selesai).length;
  taskCounter.textContent = `${activeCount} tugas aktif`;

  // E. Tampilkan empty state jika daftar kosong
  if (filteredTasks.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'empty-state';
    emptyLi.textContent = 'Belum ada tugas';
    taskList.appendChild(emptyLi);
    return;
  }

  // F. Render setiap elemen item tugas
  filteredTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item ${task.selesai ? 'completed' : ''}`;
    li.dataset.id = task.id;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'task-info';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.selesai;

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'task-details';

    // XSS Protection: Menggunakan textContent
    const titleSpan = document.createElement('span');
    titleSpan.className = 'task-title-text';
    titleSpan.textContent = task.judul;

    const metaSpan = document.createElement('span');
    metaSpan.className = 'task-meta';
    metaSpan.textContent = `${task.matkul} · deadline ${task.deadline}`;

    detailsDiv.appendChild(titleSpan);
    detailsDiv.appendChild(metaSpan);

    infoDiv.appendChild(checkbox);
    infoDiv.appendChild(detailsDiv);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-delete';
    deleteBtn.textContent = '✕';

    li.appendChild(infoDiv);
    li.appendChild(deleteBtn);

    taskList.appendChild(li);
  });
}


// ==========================================
// 3. FORM TAMBAH TUGAS & VALIDASI
// ==========================================

taskForm.addEventListener('submit', function (e) {
  e.preventDefault();

  const judul = taskTitleInput.value.trim();
  const matkul = taskMatkulSelect.value;
  const deadline = taskDeadlineInput.value;

  if (judul.length < 3) {
    showError('Judul tugas minimal harus 3 karakter.');
    return;
  }

  if (!deadline) {
    showError('Tanggal deadline wajib diisi.');
    return;
  }

  hideError();

  const newTask = {
    id: Date.now(),
    judul: judul,
    matkul: matkul,
    deadline: deadline,
    selesai: false
  };

  tasks.push(newTask);
  saveToLocalStorage();

  taskForm.reset();
  render();
});


// ==========================================
// 4. EVENT DELEGATION PADA <ul>
// ==========================================

taskList.addEventListener('click', function (e) {
  const li = e.target.closest('li');
  if (!li || !li.dataset.id) return;

  const taskId = Number(li.dataset.id);

  // Toggle Checkbox Selesai
  if (e.target.classList.contains('task-checkbox')) {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      task.selesai = e.target.checked;
      saveToLocalStorage();
      render();
    }
  }

  // Tombol Hapus
  if (e.target.classList.contains('btn-delete')) {
    tasks = tasks.filter(t => t.id !== taskId);
    saveToLocalStorage();
    render();
  }
});


// ==========================================
// 5. FILTER TUGAS & FINALISASI
// ==========================================

filterButtons.forEach(button => {
  button.addEventListener('click', function () {
    // Pindahkan class 'on' ke tombol yang baru diklik
    filterButtons.forEach(btn => btn.classList.remove('on'));
    this.classList.add('on');

    // Update state filter dan panggil render ulang
    currentFilter = this.dataset.filter;
    render();
  });
});

// ==========================================
// 6. PENGAMBILAN DATA DARI SERVER (GET /api/tugas)
// ==========================================

async function fetchTasks() {
  // 1. State Loading: Sebelum dan selama data diambil
  taskList.innerHTML = '<li class="empty-state">Memuat...</li>';

  try {
    const response = await fetch('/api/tugas');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 2. State Berhasil (Ada Data) vs 3. State Kosong
    if (Array.isArray(data) && data.length > 0) {
      tasks = data;
      render();
    } else {
      tasks = [];
      taskList.innerHTML = '<li class="empty-state">Belum ada tugas</li>';
      taskCounter.textContent = '0 tugas aktif';
    }
  } catch (error) {
    // 4. State Error: Gagal koneksi atau server error
    taskList.innerHTML = `
      <li class="empty-state">
        <p>Gagal memuat tugas.</p>
        <button type="button" id="btn-retry" class="btn-retry">Coba Lagi</button>
      </li>
    `;
    taskCounter.textContent = '0 tugas aktif';

    const retryBtn = document.getElementById('btn-retry');
    if (retryBtn) {
      retryBtn.addEventListener('click', fetchTasks);
    }
  }
}

// Inisialisasi: panggil fungsi saat web pertama kali diakses
fetchTasks();