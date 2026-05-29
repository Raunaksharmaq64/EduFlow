/* ========================================
   EduFlow AI — Student Dashboard Logic
   ========================================
   Features:
   - Auth guard & profile rendering
   - Sidebar panel tab switching
   - AI Study Plan Generator (Gemini)
   - AI Doubt Solver (Text + Image / Multimodal)
   - Interactive Quiz Engine (MCQ)
   ======================================== */

// Centralized backend host detection. Queries global window.CONFIG first, with hostname-based automatic detection fallback.
const BACKEND_URL = (window.CONFIG && window.CONFIG.BACKEND_URL) ||
    ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '')
        ? 'http://127.0.0.1:8000'
        : 'https://eduflow-api.onrender.com');

const API_BASE = `${BACKEND_URL}/api`;

/* ========================================
   DYNAMIC TOAST NOTIFICATION SYSTEM
   ======================================== */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const isErrorOrWarning = type === 'error' || type === 'warning';
    toast.className = `toast toast-${type} ${isErrorOrWarning ? 'toast-shake' : ''}`;

    let icon = 'bx-info-circle';
    if (type === 'success') icon = 'bx-check-circle';
    else if (type === 'error') icon = 'bx-error-circle';
    else if (type === 'warning') icon = 'bx-error';

    const isOffline = message.includes('Server is offline') || message.includes('offline');

    toast.innerHTML = `
        <i class='bx ${icon} toast-icon'></i>
        <div class="toast-content" style="display: flex; flex-direction: column; flex-grow: 1;">
            <span class="toast-message">${message}</span>
            ${isOffline ? `
                <button class="toast-retry-btn" id="toast-retry-btn">
                    <i class='bx bx-refresh'></i> Retry Connection
                </button>
            ` : ''}
        </div>
        <button class="toast-close" style="align-self: flex-start; margin-left: auto;">&times;</button>
        <div class="toast-progress"></div>
    `;

    const progressEl = toast.querySelector('.toast-progress');
    if (progressEl) {
        progressEl.style.animation = 'toast-progress-shrink 4.5s linear forwards';
    }

    if (isOffline) {
        const retryBtn = toast.querySelector('#toast-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                retryBtn.disabled = true;
                retryBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Checking...";
                try {
                    const testRes = await fetch(`${BACKEND_URL}/`, { method: 'GET' });
                    if (testRes.ok) {
                        retryBtn.innerHTML = "<i class='bx bx-check'></i> Connected!";
                        toast.classList.add('toast-fade-out');
                        setTimeout(() => toast.remove(), 300);
                        showToast('🎉 Server is back online! Reconnecting...', 'success');
                    } else {
                        throw new Error('Offline');
                    }
                } catch (err) {
                    toast.classList.remove('toast-shake');
                    void toast.offsetWidth; // trigger reflow
                    toast.classList.add('toast-shake');
                    retryBtn.disabled = false;
                    retryBtn.innerHTML = "<i class='bx bx-refresh'></i> Retry Failed. Try Again?";
                }
            });
        }
    }

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    });

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            const retryBtn = toast.querySelector('#toast-retry-btn');
            if (retryBtn && retryBtn.disabled) return;

            toast.classList.add('toast-fade-out');
            setTimeout(() => {
                toast.remove();
                if (container.children.length === 0) {
                    container.remove();
                }
            }, 300);
        }
    }, 4500);
}

/* ========================================
   AUTH GUARD — Redirect if not logged in
   ======================================== */
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'student') {
    showToast('Please login as a Student to access this dashboard.', 'error');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
}

/* ========================================
   HELPER — Auth headers
   ======================================== */
function authHeaders() {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

/* ========================================
   STATS SYNC ENGINE
   ======================================== */
async function syncUserStats() {
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const updatedUser = await res.json();

        // Update localStorage
        localStorage.setItem('user', JSON.stringify(updatedUser));

        // Render stats in header
        document.getElementById('header-xp').textContent = `${updatedUser.xp || 0} XP`;
        document.getElementById('header-level').textContent = `Lvl ${updatedUser.level || 1}`;

        // Level progression: every 500 XP is a level
        const currentLevelXP = (updatedUser.level - 1) * 500;
        const xpProgressInLevel = (updatedUser.xp - currentLevelXP);
        const progressPercentage = Math.max(0, Math.min(100, (xpProgressInLevel / 500) * 100));
        document.getElementById('header-level-bar').style.width = `${progressPercentage}%`;

        // Sync overview profile fields
        document.getElementById('profile-name').textContent = updatedUser.name || 'Student';
        const avatarEl = document.getElementById('profile-avatar');
        if (updatedUser.profile_pic) {
            avatarEl.innerHTML = `<img src="${updatedUser.profile_pic.startsWith('http') ? updatedUser.profile_pic : BACKEND_URL + updatedUser.profile_pic}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            avatarEl.textContent = (updatedUser.name || 'S').charAt(0).toUpperCase();
        }

        // Sync badge unlocked styles
        const badges = updatedUser.badges || [];
        document.querySelectorAll('.badge-item').forEach(item => {
            const badgeName = item.getAttribute('data-badge');
            if (badges.includes(badgeName)) {
                item.classList.remove('locked');
                item.classList.add('unlocked');
            } else {
                item.classList.add('locked');
                item.classList.remove('unlocked');
            }
        });
    } catch (err) {
        console.error('Failed to sync user stats:', err);
    }
}

async function addXP(amount, actionType) {
    try {
        const res = await fetch(`${API_BASE}/auth/stats/add-xp?amount=${amount}&action_type=${actionType}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
            if (data.leveled_up) {
                showToast(`🎉 Level Up! You reached Level ${data.level}!`, 'success');
            } else {
                showToast(`+${amount} XP Gained!`, 'success');
            }
            if (data.unlocked_badge) {
                showToast(`🏆 Badge Unlocked: ${data.unlocked_badge}!`, 'success');
            }
            await syncUserStats();
        }
    } catch (err) {
        console.error('Error adding XP:', err);
    }
}

/* ========================================
   DATE SETTING
   ======================================== */
const now = new Date();
document.getElementById('current-date-string').textContent = now.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

/* ========================================
   LOGOUT
   ======================================== */
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
});

/* ========================================
   SIDEBAR PANEL SWITCHING
   ======================================== */
const menuItems = document.querySelectorAll('.menu-item');
const panels = document.querySelectorAll('.dashboard-panel');

const panelTitles = {
    'overview-panel': { title: 'Welcome Back!', sub: 'Here is your learning summary for today.' },
    'study-panel': { title: 'AI Study Plan', sub: 'Generate a personalized revision schedule powered by AI.' },
    'doubt-panel': { title: 'AI Doubt Solver', sub: 'Get step-by-step solutions to any academic question.' },
    'quiz-panel': { title: 'Practice Quizzes', sub: 'Take AI-generated MCQ tests and sharpen your skills.' },
    'flashcards-panel': { title: '3D Flashcards', sub: 'Review key terms and practice active recall concepts.' },
    'assignments-panel': { title: 'Assignments Hub', sub: 'Solve homework worksheets, check Google Drive resources, and track performance grades.' },
    'chat-panel': { title: 'Direct Messages', sub: 'Communicate with teachers of your classrooms.' },
    'profile-panel': { title: 'My Profile', sub: 'Manage your settings, update details, and view linked connections.' }
};

function switchPanel(panelId) {
    panels.forEach(p => p.classList.remove('active'));
    menuItems.forEach(m => m.classList.remove('active'));

    const targetPanel = document.getElementById(panelId);
    if (targetPanel) targetPanel.classList.add('active');

    const targetMenu = document.querySelector(`[data-panel="${panelId}"]`);
    if (targetMenu) targetMenu.classList.add('active');

    const info = panelTitles[panelId];
    if (info) {
        document.getElementById('panel-title').textContent = info.title;
        document.getElementById('panel-subtitle').textContent = info.sub;
    }

    if (panelId === 'chat-panel') {
        loadChatContacts();
    } else {
        stopChatPolling();
    }

    if (panelId === 'profile-panel') {
        initProfilePanel();
    }
}

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        switchPanel(item.getAttribute('data-panel'));
    });
});

window.switchPanel = switchPanel;

/* ========================================
   DYNAMIC NCERT SYLLABUS LOADER HELPERS
   ======================================== */
async function loadSyllabusSubjects(gradeSelectId, subjectSelectId, checklistOrSelectId, isChecklist = false) {
    const gradeSelect = document.getElementById(gradeSelectId);
    const subjectSelect = document.getElementById(subjectSelectId);
    const target = document.getElementById(checklistOrSelectId);
    
    if (!gradeSelect || !subjectSelect) return;
    
    const selectedGrade = gradeSelect.value;
    if (!selectedGrade) {
        subjectSelect.innerHTML = '<option value="" disabled selected>Select class first</option>';
        if (isChecklist) {
            target.innerHTML = '<span style="font-size: 0.82rem; color: var(--text-secondary);">Select Class and Subject first...</span>';
        } else {
            target.innerHTML = '<option value="" disabled selected>Select subject first</option>';
        }
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/syllabus/subjects?grade=${encodeURIComponent(selectedGrade)}`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const subjects = await res.json();
        
        subjectSelect.innerHTML = '<option value="" disabled selected>Select subject</option>' + 
            subjects.map(sub => `<option value="${sub}">${sub}</option>`).join('');
            
        if (isChecklist) {
            target.innerHTML = '<span style="font-size: 0.82rem; color: var(--text-secondary);">Select Subject first...</span>';
        } else {
            target.innerHTML = '<option value="" disabled selected>Select subject first</option>';
        }
    } catch (err) {
        console.error('Failed to load syllabus subjects:', err);
        showToast('Error loading subjects.', 'error');
    }
}

async function loadSyllabusChapters(gradeSelectId, subjectSelectId, targetId, isChecklist = false) {
    const gradeSelect = document.getElementById(gradeSelectId);
    const subjectSelect = document.getElementById(subjectSelectId);
    const target = document.getElementById(targetId);
    
    if (!gradeSelect || !subjectSelect || !target) return;
    
    const selectedGrade = gradeSelect.value;
    const selectedSubject = subjectSelect.value;
    
    if (!selectedGrade || !selectedSubject) return;
    
    try {
        const res = await fetch(`${API_BASE}/syllabus/chapters?grade=${encodeURIComponent(selectedGrade)}&subject=${encodeURIComponent(selectedSubject)}`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const chapters = await res.json();
        
        if (isChecklist) {
            if (chapters.length === 0) {
                target.innerHTML = '<span style="font-size: 0.82rem; color: var(--text-secondary);">No chapters found.</span>';
                return;
            }
            target.innerHTML = chapters.map(ch => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem; cursor: pointer; color: var(--text-primary); margin-bottom: 4px;">
                    <input type="checkbox" name="study-chapters" value="${ch.chapter_name}" style="accent-color: var(--secondary);">
                    <span>Ch ${ch.chapter_number}. ${ch.chapter_name}</span>
                </label>
            `).join('');
        } else {
            target.innerHTML = '<option value="" disabled selected>Select chapter/topic</option>' + 
                chapters.map(ch => `<option value="${ch.chapter_name}">Ch ${ch.chapter_number}. ${ch.chapter_name}</option>`).join('');
        }
    } catch (err) {
        console.error('Failed to load syllabus chapters:', err);
        showToast('Error loading chapters.', 'error');
    }
}

/* ========================================
   AI KANBAN STUDY PLANNER BOARD
   ======================================== */
let activeKanbanPlan = null;

async function loadKanbanPlans() {
    try {
        const res = await fetch(`${API_BASE}/ai/study-kanban`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const plans = await res.json();

        document.getElementById('stat-plans-count').textContent = plans.length;

        if (plans.length > 0) {
            activeKanbanPlan = plans[plans.length - 1];
            renderKanbanBoard(activeKanbanPlan);
            document.getElementById('study-output-box').style.display = 'block';
        }
    } catch (err) {
        console.error('Failed to load Kanban plans:', err);
    }
}

function renderKanbanBoard(plan) {
    const columns = {
        todo: document.getElementById('kanban-todo'),
        inprogress: document.getElementById('kanban-inprogress'),
        completed: document.getElementById('kanban-completed')
    };

    Object.values(columns).forEach(col => col.innerHTML = '');
    const counts = { todo: 0, inprogress: 0, completed: 0 };

    plan.tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.id = `kanban-task-${task.id}`;
        card.textContent = task.title;

        card.addEventListener('dragstart', (e) => {
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', task.id);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        const colId = task.status === 'todo' ? 'todo' : (task.status === 'inprogress' ? 'inprogress' : 'completed');
        if (columns[colId]) {
            columns[colId].appendChild(card);
            counts[colId]++;
        }
    });

    document.getElementById('count-todo').textContent = counts.todo;
    document.getElementById('count-inprogress').textContent = counts.inprogress;
    document.getElementById('count-completed').textContent = counts.completed;

    initKanbanDragEvents();
}

function initKanbanDragEvents() {
    const containers = document.querySelectorAll('.kanban-cards-container');
    containers.forEach(container => {
        const column = container.closest('.kanban-column');

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            column.classList.add('dragover');
        });

        container.addEventListener('dragleave', () => {
            column.classList.remove('dragover');
        });

        container.addEventListener('drop', async (e) => {
            e.preventDefault();
            column.classList.remove('dragover');

            const taskId = e.dataTransfer.getData('text/plain');
            const draggedCard = document.getElementById(`kanban-task-${taskId}`);
            if (!draggedCard) return;

            const newStatus = column.getAttribute('data-status');
            const task = activeKanbanPlan.tasks.find(t => t.id === taskId);
            if (!task || task.status === newStatus) return;

            task.status = newStatus;
            container.appendChild(draggedCard);

            try {
                const res = await fetch(`${API_BASE}/ai/study-kanban/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ task_id: taskId, status: newStatus })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Failed to update task');

                showToast(`Task moved to ${column.querySelector('h4').textContent}!`, 'success');

                if (newStatus === 'completed') {
                    await addXP(30, 'plan');
                }

                renderKanbanBoard(activeKanbanPlan);
            } catch (err) {
                console.error(err);
                showToast('Failed to save task move to database.', 'error');
                await loadKanbanPlans();
            }
        });
    });
}

document.getElementById('study-plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const subject = document.getElementById('study-subject').value;
    const grade = document.getElementById('study-grade').value;
    const goals = document.getElementById('study-goals').value.trim();

    const checkedBoxes = document.querySelectorAll('input[name="study-chapters"]:checked');
    const selectedChapters = Array.from(checkedBoxes).map(cb => cb.value);

    if (selectedChapters.length === 0) {
        showToast('Please select at least one NCERT chapter.', 'warning');
        return;
    }

    document.getElementById('study-loader').style.display = 'flex';
    document.getElementById('study-output-box').style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/ai/study-kanban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                subject,
                grade,
                weak_topics: selectedChapters,
                target_goals: goals || null
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate study board');

        activeKanbanPlan = data;
        renderKanbanBoard(activeKanbanPlan);
        document.getElementById('study-output-box').style.display = 'block';

        showToast('🎉 Study Kanban board generated successfully!', 'success');
        await addXP(80, 'plan');

        // Reset selections
        document.getElementById('study-grade').value = '';
        document.getElementById('study-subject').innerHTML = '<option value="" disabled selected>Select class first</option>';
        document.getElementById('study-chapters-checklist').innerHTML = '<span style="font-size: 0.82rem; color: var(--text-secondary);">Select Class and Subject first...</span>';
        document.getElementById('study-goals').value = '';
    } catch (err) {
        let errMsg = err.message || 'Error occurred';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
            errMsg = '🔌 Server is offline! Please start the backend server.';
        }
        showToast(errMsg, 'error');
        console.error(err);
    } finally {
        document.getElementById('study-loader').style.display = 'none';
    }
});

document.getElementById('btn-reset-kanban').addEventListener('click', () => {
    document.getElementById('study-output-box').style.display = 'none';
    document.getElementById('study-plan-form').scrollIntoView({ behavior: 'smooth' });
});

/* ========================================
   AI DOUBT SOLVER (MULTIMODAL + SPEECH-TO-TEXT + HISTORY)
   ======================================== */
const dropzone = document.getElementById('image-dropzone');
const imageFileInput = document.getElementById('doubt-image-file');
const imagePreview = document.getElementById('image-upload-preview');
let selectedImageFile = null;

if (dropzone) {
    dropzone.addEventListener('click', () => imageFileInput.click());

    imageFileInput.addEventListener('change', () => {
        if (imageFileInput.files.length > 0) {
            selectedImageFile = imageFileInput.files[0];
            showImagePreview(selectedImageFile);
        }
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            selectedImageFile = e.dataTransfer.files[0];
            showImagePreview(selectedImageFile);
        }
    });
}

function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function loadDoubtHistory() {
    const listContainer = document.getElementById('doubt-history-list');
    if (!listContainer) return;
    try {
        const res = await fetch(`${API_BASE}/ai/doubts/history`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const history = await res.json();

        document.getElementById('stat-doubts-count').textContent = history.length;

        if (history.length === 0) {
            listContainer.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-secondary); text-align: center; margin: 2rem 0;">No doubts solved yet</p>`;
            return;
        }

        listContainer.innerHTML = '';
        history.forEach(item => {
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '';

            const div = document.createElement('div');
            div.className = 'doubt-history-item';
            div.innerHTML = `
                <h4>${item.question_text || 'Image Doubt Question'}</h4>
                <p>${item.explanation.replace(/[#*`]/g, '')}</p>
                <div class="doubt-date">${dateStr}</div>
            `;
            div.addEventListener('click', () => {
                const html = marked.parse(item.explanation);
                document.getElementById('doubt-markdown-content').innerHTML = html;
                document.getElementById('doubt-output-box').style.display = 'block';
                document.getElementById('doubt-output-box').scrollIntoView({ behavior: 'smooth' });
            });
            listContainer.appendChild(div);
        });
    } catch (err) {
        console.error('Failed to load doubt history:', err);
    }
}

function initSpeechRecognition() {
    const micBtn = document.getElementById('btn-doubt-mic');
    const micIcon = document.getElementById('mic-icon');
    const textarea = document.getElementById('doubt-text');
    if (!micBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        micBtn.style.display = 'none';
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    let isListening = false;

    recognition.onstart = () => {
        isListening = true;
        micBtn.style.backgroundColor = '#e71d36';
        micBtn.style.color = '#fff';
        micIcon.className = 'bx bx-dots-horizontal-rounded bx-flashing';
        showToast('Listening... Speak your question now.', 'info');
    };

    recognition.onend = () => {
        isListening = false;
        micBtn.style.backgroundColor = '';
        micBtn.style.color = '';
        micIcon.className = 'bx bx-microphone';
    };

    recognition.onerror = (e) => {
        console.error('Speech recognition error', e);
        showToast('Could not recognize voice. Please try again.', 'warning');
    };

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (textarea.value) {
            textarea.value += ' ' + text;
        } else {
            textarea.value = text;
        }
    };

    micBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });
}

document.getElementById('doubt-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('doubt-text').value.trim();
    if (!text && !selectedImageFile) {
        showToast('Please enter a question or upload an image.', 'warning');
        return;
    }

    document.getElementById('doubt-loader').style.display = 'flex';
    document.getElementById('doubt-output-box').style.display = 'none';

    try {
        const formData = new FormData();
        if (text) formData.append('question_text', text);
        if (selectedImageFile) formData.append('image', selectedImageFile);

        const res = await fetch(`${API_BASE}/ai/solve-doubt`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to solve doubt');

        const html = marked.parse(data.explanation);
        document.getElementById('doubt-markdown-content').innerHTML = html;
        document.getElementById('doubt-output-box').style.display = 'block';

        showToast('🎉 Doubt resolved successfully!', 'success');
        await addXP(50, 'doubt');

        document.getElementById('doubt-text').value = '';
        if (imagePreview) {
            imagePreview.style.display = 'none';
            imagePreview.src = '';
        }
        selectedImageFile = null;
        imageFileInput.value = '';

        await loadDoubtHistory();
    } catch (err) {
        let errMsg = err.message || 'Error occurred';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
            errMsg = '🔌 Server is offline! Please start the backend server.';
        }
        showToast(errMsg, 'error');
        console.error(err);
    } finally {
        document.getElementById('doubt-loader').style.display = 'none';
    }
});

/* ========================================
   AI QUIZ PRACTICE ENGINE (BOT BATTLE MODE)
   ======================================== */
let quizData = null;
let currentQ = 0;
let score = 0;
let answered = false;
let isBattleMode = false;
let playerHP = 3;
let botHP = 3;
let battleTimerInterval = null;
let secondsLeft = 15;

document.getElementById('quiz-setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const topicSelect = document.getElementById('quiz-chapter');
    const topic = topicSelect ? topicSelect.value : '';
    if (!topic) {
        showToast('Please select a quiz chapter.', 'warning');
        return;
    }
    const grade = document.getElementById('quiz-grade').value;
    const difficulty = document.getElementById('quiz-difficulty').value;
    const numQ = parseInt(document.getElementById('quiz-count').value);
    const qType = document.getElementById('quiz-type')?.value || 'mixed';
    const battleToggle = document.getElementById('quiz-battle-toggle');
    isBattleMode = battleToggle ? battleToggle.checked : false;

    document.getElementById('quiz-setup-box').style.display = 'none';
    document.getElementById('quiz-loader').style.display = 'flex';
    document.getElementById('quiz-active-box').style.display = 'none';
    document.getElementById('quiz-summary-box').style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/ai/generate-quiz`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ topic, grade, num_questions: numQ, difficulty, question_type: qType })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate quiz');

        quizData = data;
        currentQ = 0;
        score = 0;
        answered = false;

        if (isBattleMode) {
            playerHP = 3;
            botHP = 3;
            document.getElementById('quiz-battle-hud').style.display = 'block';
            updateBattleHUD();
        } else {
            document.getElementById('quiz-battle-hud').style.display = 'none';
        }

        renderQuestion();
        document.getElementById('quiz-active-box').style.display = 'block';
    } catch (err) {
        let errMsg = err.message || 'Error occurred';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
            errMsg = '🔌 Server is offline! Please start the backend server.';
        }
        showToast(errMsg, 'error');
        document.getElementById('quiz-setup-box').style.display = 'block';
        console.error(err);
    } finally {
        document.getElementById('quiz-loader').style.display = 'none';
    }
});

function updateBattleHUD() {
    const playerBar = document.getElementById('player-health');
    const botBar = document.getElementById('bot-health');
    const playerHPText = document.getElementById('player-hp-text');
    const botHPText = document.getElementById('bot-hp-text');

    if (!playerBar || !botBar) return;

    const playerPct = (playerHP / 3) * 100;
    const botPct = (botHP / 3) * 100;

    playerBar.style.width = `${playerPct}%`;
    botBar.style.width = `${botPct}%`;

    playerHPText.textContent = `HP: ${playerHP}/3`;
    botHPText.textContent = `HP: ${botHP}/3`;

    if (playerHP === 2) playerBar.style.backgroundColor = '#f1c40f';
    else if (playerHP === 1) playerBar.style.backgroundColor = '#e74c3c';
    else playerBar.style.backgroundColor = '#2ecc71';

    if (botHP === 2) botBar.style.backgroundColor = '#f1c40f';
    else if (botHP === 1) botBar.style.backgroundColor = '#e74c3c';
    else botBar.style.backgroundColor = '#e74c3c';
}

function startQuestionTimer() {
    clearInterval(battleTimerInterval);
    if (!isBattleMode) return;

    secondsLeft = 15;
    document.getElementById('quiz-next-btn').textContent = `Next Question (15s)`;

    battleTimerInterval = setInterval(() => {
        secondsLeft--;
        document.getElementById('quiz-next-btn').textContent = `Next Question (${secondsLeft}s)`;

        if (secondsLeft <= 0) {
            clearInterval(battleTimerInterval);
            handleBattleTimeout();
        }
    }, 1000);
}

function handleBattleTimeout() {
    if (answered) return;
    answered = true;

    playerHP--;
    updateBattleHUD();
    showToast('⏳ Time is up! You took 1 damage.', 'warning');

    const q = quizData.questions[currentQ];
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => {
        const optText = opt.querySelector('span:first-child').textContent;
        if (optText === q.correct_option) {
            opt.classList.add('correct');
        }
    });

    document.getElementById('quiz-explanation-text').textContent = q.explanation;
    document.getElementById('quiz-explanation-box').style.display = 'block';

    document.getElementById('quiz-next-btn').disabled = false;
    document.getElementById('quiz-next-btn').textContent = 'Next Question';

    if (playerHP <= 0) {
        setTimeout(() => {
            endBattleMode(false);
        }, 1500);
    }
}

function renderQuestion() {
    const q = quizData.questions[currentQ];
    const total = quizData.questions.length;

    let formatLabel = "Multiple Choice";
    let formatClass = "status-good";
    if (q.question_type === 'tf') {
        formatLabel = "True / False";
        formatClass = "status-struggling";
    } else if (q.question_type === 'fill') {
        formatLabel = "Fill in the Blank";
        formatClass = "status-badge";
    }
    
    document.getElementById('quiz-q-num').innerHTML = `Question ${currentQ + 1} of ${total} <span class="status-badge ${formatClass}" style="margin-left: 8px; font-size: 0.65rem; padding: 2px 6px; vertical-align: middle; background-color: ${q.question_type === 'tf' ? 'rgba(231,111,81,0.1)' : q.question_type === 'fill' ? 'rgba(0,0,0,0.05)' : 'rgba(42,157,143,0.1)'}; color: ${q.question_type === 'tf' ? 'var(--parent)' : q.question_type === 'fill' ? 'var(--text-secondary)' : 'var(--secondary)'};">${formatLabel}</span>`;
    document.getElementById('quiz-q-text').textContent = q.question_text;

    const letters = ['A', 'B', 'C', 'D'];
    const container = document.getElementById('quiz-options-container');
    container.innerHTML = '';

    q.options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.classList.add('quiz-option');
        div.dataset.index = idx;
        div.innerHTML = `
            <span>${opt}</span>
            <span class="quiz-option-letter">${letters[idx]}</span>
        `;
        div.addEventListener('click', () => selectOption(div, opt, q));
        container.appendChild(div);
    });

    document.getElementById('quiz-explanation-box').style.display = 'none';
    document.getElementById('quiz-next-btn').disabled = true;
    answered = false;

    if (isBattleMode) {
        startQuestionTimer();
    }
}

function selectOption(element, selected, question) {
    if (answered) return;
    answered = true;

    clearInterval(battleTimerInterval);
    document.getElementById('quiz-next-btn').textContent = 'Next Question';

    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => {
        const optText = opt.querySelector('span:first-child').textContent;
        if (optText === question.correct_option) {
            opt.classList.add('correct');
        }
        if (opt === element && selected !== question.correct_option) {
            opt.classList.add('incorrect');
        }
    });

    element.classList.add('selected');

    if (selected === question.correct_option) {
        score++;
        if (isBattleMode) {
            botHP--;
            updateBattleHUD();
            showToast('💥 Correct! Dealt 1 damage to AI Bot!', 'success');
            if (botHP <= 0) {
                setTimeout(() => {
                    endBattleMode(true);
                }, 1000);
                return;
            }
        }
    } else {
        if (isBattleMode) {
            playerHP--;
            updateBattleHUD();
            showToast('😢 Incorrect! You took 1 damage from AI Bot.', 'error');
            if (playerHP <= 0) {
                setTimeout(() => {
                    endBattleMode(false);
                }, 1000);
                return;
            }
        }
    }

    document.getElementById('quiz-explanation-text').textContent = question.explanation;
    document.getElementById('quiz-explanation-box').style.display = 'block';
    document.getElementById('quiz-next-btn').disabled = false;
}

document.getElementById('quiz-next-btn').addEventListener('click', () => {
    currentQ++;
    if (currentQ < quizData.questions.length) {
        renderQuestion();
    } else {
        if (isBattleMode) {
            endBattleMode(playerHP >= botHP);
        } else {
            showQuizSummary();
        }
    }
});

function showQuizSummary() {
    const total = quizData.questions.length;
    document.getElementById('quiz-active-box').style.display = 'none';
    document.getElementById('quiz-summary-box').style.display = 'block';
    document.getElementById('quiz-summary-score').textContent = `${score} / ${total}`;

    const pct = (score / total) * 100;
    let comment = '';
    if (pct === 100) comment = 'Perfect! You aced the entire quiz!';
    else if (pct >= 80) comment = 'Excellent work! Keep it up!';
    else if (pct >= 60) comment = 'Good effort! Practice more on the topics you missed.';
    else if (pct >= 40) comment = 'Not bad, but there is room for improvement.';
    else comment = 'Keep practicing! Use the AI Study Plan to improve.';

    document.getElementById('quiz-summary-comment').textContent = comment;
    document.getElementById('quiz-summary-subtitle').textContent = `Topic: ${quizData.topic} | Difficulty: ${quizData.difficulty}`;

    const el = document.getElementById('stat-quizzes-count');
    el.textContent = parseInt(el.textContent) + 1;

    // Save quiz attempt details to MongoDB
    fetch(`${API_BASE}/ai/quiz/save-score`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
            topic: quizData.topic,
            difficulty: quizData.difficulty,
            score: score,
            total_questions: total
        })
    })
        .then(res => res.json())
        .then(data => {
            console.log('Quiz score saved:', data);
            if (typeof loadConceptMastery === 'function') {
                loadConceptMastery();
            }
        })
        .catch(err => console.error('Failed to save quiz score:', err));

    addXP(score * 20, 'quiz');
}

function endBattleMode(playerWon) {
    clearInterval(battleTimerInterval);
    document.getElementById('quiz-active-box').style.display = 'none';
    document.getElementById('quiz-summary-box').style.display = 'block';

    const summaryScore = document.getElementById('quiz-summary-score');
    const summaryComment = document.getElementById('quiz-summary-comment');

    if (playerWon) {
        summaryScore.textContent = '🏆 VICTORY!';
        summaryScore.style.color = '#2ecc71';
        summaryComment.textContent = `You defeated the AI Bot in battle! XP awarded.`;
        addXP(150, 'quiz');
    } else {
        summaryScore.textContent = '💀 DEFEAT!';
        summaryScore.style.color = '#e74c3c';
        summaryComment.textContent = `The AI Bot defeated you in battle! Keep studying and try again.`;
        addXP(15, 'quiz');
    }

    document.getElementById('quiz-summary-subtitle').textContent = `AI Bot Battle Mode`;

    const el = document.getElementById('stat-quizzes-count');
    el.textContent = parseInt(el.textContent) + 1;
}

document.getElementById('quiz-quit-btn').addEventListener('click', () => {
    clearInterval(battleTimerInterval);
    document.getElementById('quiz-active-box').style.display = 'none';
    document.getElementById('quiz-setup-box').style.display = 'block';
});

document.getElementById('quiz-restart-btn').addEventListener('click', () => {
    document.getElementById('quiz-summary-box').style.display = 'none';
    document.getElementById('quiz-setup-box').style.display = 'block';
});

/* ========================================
   3D ACTIVE RECALL FLASHCARDS ENGINE
   ======================================== */
let flashcardsDeck = [];
let currentCardIdx = 0;
let masteredCount = 0;

function initFlashcards() {
    const setupForm = document.getElementById('fc-setup-form');
    const setupBox = document.getElementById('fc-setup-box');
    const loader = document.getElementById('fc-loader');
    const activeBox = document.getElementById('fc-active-box');
    const summaryBox = document.getElementById('fc-summary-box');
    const innerCard = document.getElementById('flashcard-inner');
    const frontText = document.getElementById('fc-front-text');
    const backText = document.getElementById('fc-back-text');
    const expText = document.getElementById('fc-exp-text');
    const stillLearningBtn = document.getElementById('fc-still-learning-btn');
    const masteredBtn = document.getElementById('fc-mastered-btn');
    const restartBtn = document.getElementById('fc-restart-btn');

    if (innerCard) {
        innerCard.parentElement.addEventListener('click', () => {
            innerCard.classList.toggle('is-flipped');
        });
    }

    if (setupForm) {
        // Toggle fields based on mode
        const modeSelect = document.getElementById('fc-mode');
        const ncertGroup = document.getElementById('fc-ncert-group');
        const customGroup = document.getElementById('fc-custom-group');
        
        if (modeSelect) {
            modeSelect.addEventListener('change', () => {
                if (modeSelect.value === 'ncert') {
                    ncertGroup.style.display = 'block';
                    customGroup.style.display = 'none';
                    document.getElementById('fc-grade').required = true;
                    document.getElementById('fc-subject').required = true;
                    document.getElementById('fc-chapter').required = true;
                    document.getElementById('fc-topic').required = false;
                } else {
                    ncertGroup.style.display = 'none';
                    customGroup.style.display = 'block';
                    document.getElementById('fc-grade').required = false;
                    document.getElementById('fc-subject').required = false;
                    document.getElementById('fc-chapter').required = false;
                    document.getElementById('fc-topic').required = true;
                }
            });
        }

        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const mode = document.getElementById('fc-mode').value;
            let topic = '';
            let grade = '';
            
            if (mode === 'ncert') {
                topic = document.getElementById('fc-chapter').value;
                grade = document.getElementById('fc-grade').value;
            } else {
                topic = document.getElementById('fc-topic').value.trim();
                grade = 'Custom Study Notes';
            }
            
            if (!topic) {
                showToast('Please specify a chapter or paste study notes.', 'warning');
                return;
            }
            const count = parseInt(document.getElementById('fc-count').value);

            setupBox.style.display = 'none';
            loader.style.display = 'flex';
            activeBox.style.display = 'none';
            summaryBox.style.display = 'none';

            try {
                const res = await fetch(`${API_BASE}/ai/generate-flashcards`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ topic, grade, num_cards: count })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Failed to generate flashcards');

                flashcardsDeck = data.flashcards;
                currentCardIdx = 0;
                masteredCount = 0;

                renderFlashcard();
                activeBox.style.display = 'block';
                showToast('Flashcard deck generated! Click the card to flip.', 'success');
            } catch (err) {
                let errMsg = err.message || 'Error occurred';
                if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
                    errMsg = '🔌 Server is offline! Please start the backend server.';
                }
                showToast(errMsg, 'error');
                setupBox.style.display = 'block';
                console.error(err);
            } finally {
                loader.style.display = 'none';
            }
        });
    }

    function renderFlashcard() {
        const card = flashcardsDeck[currentCardIdx];
        const total = flashcardsDeck.length;

        document.getElementById('fc-counter').textContent = `Card ${currentCardIdx + 1} of ${total}`;
        innerCard.classList.remove('is-flipped');

        setTimeout(() => {
            frontText.textContent = card.front;
            backText.textContent = card.back;
            expText.textContent = card.explanation || '';
        }, 150);
    }

    if (stillLearningBtn) {
        stillLearningBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            nextFlashcard();
        });
    }

    if (masteredBtn) {
        masteredBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            masteredCount++;
            nextFlashcard();
        });
    }

    function nextFlashcard() {
        currentCardIdx++;
        if (currentCardIdx < flashcardsDeck.length) {
            renderFlashcard();
        } else {
            showFlashcardSummary();
        }
    }

    function showFlashcardSummary() {
        activeBox.style.display = 'none';
        summaryBox.style.display = 'block';
        document.getElementById('fc-summary-score').textContent = `${masteredCount} / ${flashcardsDeck.length}`;

        const xpEarned = masteredCount * 20;
        addXP(xpEarned, 'general');
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            summaryBox.style.display = 'none';
            setupBox.style.display = 'block';
            document.getElementById('fc-topic').value = '';
        });
    }
}

/* ========================================
   FOCUS COMPANION (POMODORO & LOFI PLAYER)
   ======================================== */
let pomoInterval = null;
let pomoSeconds = 25 * 60;
let pomoIsRunning = false;
let pomoMode = 'focus';

function initPomodoro() {
    const pomoToggle = document.getElementById('pomodoro-toggle');
    const pomoBody = document.getElementById('pomodoro-body');
    const pomoIcon = document.getElementById('pomo-toggle-icon');
    const startBtn = document.getElementById('pomo-start-btn');
    const resetBtn = document.getElementById('pomo-reset-btn');
    const timeDisplay = document.getElementById('pomo-time-display');
    const modeDisplay = document.getElementById('pomo-mode-display');

    if (pomoToggle && pomoBody) {
        pomoToggle.addEventListener('click', () => {
            if (pomoBody.style.display === 'none') {
                pomoBody.style.display = 'flex';
                pomoIcon.className = 'bx bx-chevron-up';
            } else {
                pomoBody.style.display = 'none';
                pomoIcon.className = 'bx bx-chevron-down';
            }
        });
    }

    function updateTimerDisplay() {
        if (!timeDisplay) return;
        const mins = Math.floor(pomoSeconds / 60).toString().padStart(2, '0');
        const secs = (pomoSeconds % 60).toString().padStart(2, '0');
        timeDisplay.textContent = `${mins}:${secs}`;
    }

    function startTimer() {
        if (pomoIsRunning) {
            clearInterval(pomoInterval);
            pomoIsRunning = false;
            startBtn.innerHTML = "<i class='bx bx-play'></i> Resume";
            showToast('Pomodoro paused.', 'info');
        } else {
            pomoIsRunning = true;
            startBtn.innerHTML = "<i class='bx bx-pause'></i> Pause";
            showToast(`Pomodoro started: ${pomoMode === 'focus' ? 'Focus time!' : 'Break time!'}`, 'success');

            pomoInterval = setInterval(() => {
                pomoSeconds--;
                if (pomoSeconds < 0) {
                    clearInterval(pomoInterval);
                    pomoIsRunning = false;
                    if (pomoMode === 'focus') {
                        pomoMode = 'break';
                        pomoSeconds = 5 * 60;
                        modeDisplay.textContent = 'Break Time';
                        modeDisplay.style.color = '#2ec4b6';
                        showToast("⏰ Time's up! Take a short break.", 'success');
                        addXP(20, 'general');
                    } else {
                        pomoMode = 'focus';
                        pomoSeconds = 25 * 60;
                        modeDisplay.textContent = 'Focus Time';
                        modeDisplay.style.color = '';
                        showToast('⏰ Break over! Back to focus.', 'success');
                    }
                    startBtn.innerHTML = "<i class='bx bx-play'></i> Start";
                    updateTimerDisplay();
                } else {
                    updateTimerDisplay();
                }
            }, 1000);
        }
    }

    if (startBtn) startBtn.addEventListener('click', startTimer);

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearInterval(pomoInterval);
            pomoIsRunning = false;
            pomoMode = 'focus';
            pomoSeconds = 25 * 60;
            if (modeDisplay) {
                modeDisplay.textContent = 'Focus Time';
                modeDisplay.style.color = '';
            }
            if (startBtn) startBtn.innerHTML = "<i class='bx bx-play'></i> Start";
            updateTimerDisplay();
            showToast('Pomodoro reset.', 'info');
        });
    }

    const lofiSelect = document.getElementById('lofi-select');
    const audioEl = document.getElementById('lofi-audio');

    const audioStreams = {
        none: '',
        beats: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        rain: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        nature: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
    };

    if (lofiSelect && audioEl) {
        lofiSelect.addEventListener('change', () => {
            const stream = lofiSelect.value;
            if (stream === 'none' || !audioStreams[stream]) {
                audioEl.pause();
                audioEl.src = '';
                showToast('Lofi radio stopped.', 'info');
            } else {
                audioEl.src = audioStreams[stream];
                audioEl.load();
                audioEl.play()
                    .then(() => {
                        showToast(`Playing ${lofiSelect.options[lofiSelect.selectedIndex].text}...`, 'success');
                    })
                    .catch(err => {
                        console.error(err);
                        showToast('Failed to play stream. Try again.', 'warning');
                    });
            }
        });
    }
}

/* ========================================
   AI CONCEPT MASTERY GRAPH
   ======================================== */
async function loadConceptMastery() {
    const container = document.getElementById('mastery-container');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/ai/quiz/history`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch quiz history');
        const history = await res.json();

        if (!history || history.length === 0) {
            container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; font-style: italic;">No quiz history available yet. Complete a quiz to analyze mastery levels!</p>`;
            return;
        }

        const topicMap = {};
        history.forEach(q => {
            const topicKey = q.topic.trim().toLowerCase();
            if (!topicMap[topicKey]) {
                topicMap[topicKey] = {
                    displayName: q.topic.trim(),
                    totalScore: 0,
                    totalQuestions: 0
                };
            }
            if (typeof q.score === 'number' && typeof q.total_questions === 'number' && q.total_questions > 0) {
                topicMap[topicKey].totalScore += q.score;
                topicMap[topicKey].totalQuestions += q.total_questions;
            }
        });

        const topics = Object.values(topicMap).filter(t => t.totalQuestions > 0);

        if (topics.length === 0) {
            container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; font-style: italic;">No quiz history available yet. Complete a quiz to analyze mastery levels!</p>`;
            return;
        }

        // Sort by mastery percentage descending
        topics.forEach(t => {
            t.percent = Math.round((t.totalScore / t.totalQuestions) * 100);
        });
        topics.sort((a, b) => b.percent - a.percent);

        container.innerHTML = topics.map(t => {
            let barColor = 'var(--secondary)'; // Green
            let badgeBg = 'rgba(42, 157, 143, 0.1)';
            let badgeColor = 'var(--secondary)';

            if (t.percent >= 80) {
                barColor = 'var(--secondary)';
                badgeBg = 'rgba(42, 157, 143, 0.1)';
                badgeColor = 'var(--secondary)';
            } else if (t.percent >= 60) {
                barColor = '#e9c46a'; // Yellow
                badgeBg = 'rgba(233, 196, 106, 0.1)';
                badgeColor = '#d4ac0d';
            } else {
                barColor = 'var(--parent)'; // Red
                badgeBg = 'rgba(231, 111, 81, 0.1)';
                badgeColor = 'var(--parent)';
            }

            return `
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${t.displayName}</span>
                        <span class="status-badge" style="font-size: 0.72rem; padding: 2px 6px; background-color: ${badgeBg}; color: ${badgeColor}; font-weight: 700;">
                            ${t.percent}% Mastery
                        </span>
                    </div>
                    <div class="progress-bar-container" style="background-color: rgba(0, 0, 0, 0.05); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div class="progress-bar-fill" style="width: ${t.percent}%; height: 100%; background-color: ${barColor}; border-radius: 4px;"></div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Failed to load concept mastery:', err);
        container.innerHTML = `<p style="font-size: 0.85rem; color: var(--parent); text-align: center;">Error loading concept mastery graph.</p>`;
    }
}

window.loadConceptMastery = loadConceptMastery;

/* ========================================
   CLASSROOMS & PARENT DETAILS
   ======================================== */
async function loadClassroomsAndParent() {
    // 1. Fetch classrooms
    const classroomsList = document.getElementById('joined-classrooms-list');
    if (classroomsList) {
        try {
            const res = await fetch(`${API_BASE}/auth/student/classrooms`, {
                method: 'GET',
                headers: authHeaders()
            });
            if (res.ok) {
                const classrooms = await res.json();
                if (classrooms.length === 0) {
                    classroomsList.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-secondary);">No classrooms joined yet.</p>`;
                } else {
                    classroomsList.innerHTML = classrooms.map(c => `
                        <div class="classroom-item" style="background: var(--bg-light); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem;">${c.class_name}</span>
                                <span style="font-size: 0.72rem; color: var(--text-secondary); display: block;">Teacher: ${c.teacher_name}</span>
                            </div>
                            <span class="status-badge" style="font-size: 0.7rem; background: var(--secondary); color: #fff; padding: 2px 6px; border-radius: 4px;">${c.class_code}</span>
                        </div>
                    `).join('');
                }
            }
            // 2. Populate Assignments Selector List
            const asgSelector = document.getElementById('student-assignments-classroom-selector');
            if (asgSelector) {
                try {
                    const res = await fetch(`${API_BASE}/auth/student/classrooms`, {
                        method: 'GET',
                        headers: authHeaders()
                    });
                    if (res.ok) {
                        const classrooms = await res.json();
                        if (classrooms.length === 0) {
                            asgSelector.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">Join a classroom first.</p>`;
                        } else {
                            asgSelector.innerHTML = classrooms.map(c => `
                            <div class="selector-item-student-asg" data-code="${c.class_code}" style="padding: 10px 12px; border-radius: 6px; background: var(--bg-light); border: 1px solid rgba(0,0,0,0.04); cursor: pointer; transition: all 0.2s; margin-bottom: 8px;" onclick="selectClassroomForStudentAssignments('${c.class_code}', '${c.class_name.replace(/'/g, "\\'")}')">
                                <span style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary); display: block;">${c.class_name}</span>
                                <span style="font-size: 0.72rem; color: var(--text-secondary);">Teacher: ${c.teacher_name} | Code: ${c.class_code}</span>
                            </div>
                        `).join('');
                        }
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        } catch (err) {
            console.error('Failed to load student classrooms:', err);
        }

        // 2. Render linked parent info
        const parentInfo = document.getElementById('linked-parent-info');
        if (parentInfo) {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (storedUser.parent_email) {
                parentInfo.innerHTML = `
                <div style="background: var(--bg-light); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); display: flex; align-items: center; gap: 8px;">
                    <i class='bx bx-user-check' style="color: var(--secondary); font-size: 1.2rem;"></i>
                    <div>
                        <span style="font-weight: 600; color: var(--text-primary); font-size: 0.85rem;">Linked Parent</span>
                        <span style="font-size: 0.72rem; color: var(--text-secondary); display: block;">${storedUser.parent_email}</span>
                    </div>
                </div>
            `;
            } else {
                parentInfo.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-secondary);">No parent linked yet. Share your student email with your parent to link.</p>`;
            }
        }
    }

    const joinClassForm = document.getElementById('join-classroom-form');
    if (joinClassForm) {
        joinClassForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const codeInput = document.getElementById('join-class-code');
            const code = codeInput.value.trim().toUpperCase();
            if (!code) return;

            try {
                const res = await fetch(`${API_BASE}/auth/student/join-classroom`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({ class_code: code })
                });
                const data = await res.json();
                if (res.ok) {
                    showToast(`🎉 Joined classroom '${data.class_name}'!`, 'success');
                    codeInput.value = '';
                    await loadClassroomsAndParent();
                    await syncUserStats();
                } else {
                    showToast(data.detail || 'Failed to join classroom.', 'error');
                }
            } catch (err) {
                console.error('Error joining classroom:', err);
                showToast('Failed to join classroom.', 'error');
            }
        });
    }

    let chatPollInterval = null;
    let activeContactId = null;

    function stopChatPolling() {
        if (chatPollInterval) {
            clearInterval(chatPollInterval);
            chatPollInterval = null;
        }
    }

    async function loadChatContacts() {
        const list = document.getElementById('chat-contacts-list');
        if (!list) return;

        list.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; margin-top: 1rem;"><i class='bx bx-loader-alt bx-spin'></i> Loading...</p>`;

        try {
            const res = await fetch(`${API_BASE}/communication/contacts`, {
                method: 'GET',
                headers: authHeaders()
            });
            if (!res.ok) throw new Error();
            const contacts = await res.json();

            if (contacts.length === 0) {
                list.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-secondary); text-align: center; margin-top: 1rem;">No contacts available.</p>`;
                return;
            }

            list.innerHTML = contacts.map(c => `
            <div class="chat-contact-item" id="chat-contact-${c.id}" onclick="selectChatContact('${c.id}', '${c.name}', '${c.role}')">
                <div class="chat-contact-avatar">${c.name.charAt(0).toUpperCase()}</div>
                <div class="chat-contact-info">
                    <span class="chat-contact-name">${c.name}</span>
                    <span class="chat-contact-role">${c.role}</span>
                </div>
            </div>
        `).join('');

            if (activeContactId) {
                const activeEl = document.getElementById(`chat-contact-${activeContactId}`);
                if (activeEl) activeEl.classList.add('active');
            }
        } catch (err) {
            console.error('Failed to load chat contacts:', err);
            list.innerHTML = `<p style="font-size: 0.82rem; color: var(--parent); text-align: center; margin-top: 1rem;">Error loading contacts.</p>`;
        }
    }

    async function selectChatContact(contactId, contactName, contactRole) {
        activeContactId = contactId;

        document.querySelectorAll('.chat-contact-item').forEach(item => {
            item.classList.remove('active');
        });
        const selectedEl = document.getElementById(`chat-contact-${contactId}`);
        if (selectedEl) selectedEl.classList.add('active');

        document.getElementById('chat-empty-state').style.display = 'none';
        const feed = document.getElementById('chat-active-feed');
        feed.style.display = 'flex';

        document.getElementById('active-chat-name').textContent = contactName;
        document.getElementById('active-chat-role').textContent = contactRole;
        document.getElementById('active-chat-avatar').textContent = contactName.charAt(0).toUpperCase();

        await loadChatMessages(contactId);

        stopChatPolling();
        chatPollInterval = setInterval(() => {
            loadChatMessages(contactId);
        }, 4000);
    }

    async function loadChatMessages(contactId) {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        try {
            const res = await fetch(`${API_BASE}/communication/messages/${contactId}`, {
                method: 'GET',
                headers: authHeaders()
            });
            if (!res.ok) throw new Error();
            const messages = await res.json();

            const shouldScroll = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

            if (messages.length === 0) {
                container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; margin-top: 2rem;">No messages yet. Send a message to start conversation!</div>`;
                return;
            }

            const myUserId = user.id;
            container.innerHTML = messages.map(msg => {
                const isOutgoing = msg.sender_id === myUserId;
                const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit'
                }) : '';
                return `
                <div class="chat-message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}">
                    <span>${msg.content}</span>
                    <span class="chat-message-meta">${time}</span>
                </div>
            `;
            }).join('');

            if (shouldScroll) {
                container.scrollTop = container.scrollHeight;
            }
        } catch (err) {
            console.error('Failed to load chat messages:', err);
        }
    }

    async function sendChatMessage(e) {
        e.preventDefault();
        if (!activeContactId) return;

        const input = document.getElementById('chat-message-input');
        const content = input.value.trim();
        if (!content) return;

        input.value = '';

        try {
            const res = await fetch(`${API_BASE}/communication/send`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ recipient_id: activeContactId, content: content })
            });
            const data = await res.json();
            if (res.ok) {
                await loadChatMessages(activeContactId);
            } else {
                showToast(data.detail || 'Failed to send message.', 'error');
            }
        } catch (err) {
            console.error('Error sending message:', err);
            showToast('Error sending message.', 'error');
        }
    }

    /* ========================================
       STUDENT ASSIGNMENTS HUB LOGIC
       ======================================== */
    let selectedStudentAssignmentClassCode = null;
    let currentAssignmentSolvingData = null;

    async function selectClassroomForStudentAssignments(classCode, className) {
        selectedStudentAssignmentClassCode = classCode;

        // Style active selector item
        const items = document.querySelectorAll('#student-assignments-classroom-selector .selector-item-student-asg');
        items.forEach(item => {
            if (item.getAttribute('data-code') === classCode) {
                item.style.backgroundColor = 'var(--secondary)';
                item.style.color = '#fff';
                const spans = item.querySelectorAll('span');
                if (spans[0]) spans[0].style.color = '#fff';
                if (spans[1]) spans[1].style.color = 'rgba(255,255,255,0.8)';
            } else {
                item.style.backgroundColor = 'var(--bg-light)';
                item.style.color = 'var(--text-primary)';
                const spans = item.querySelectorAll('span');
                if (spans[0]) spans[0].style.color = 'var(--text-primary)';
                if (spans[1]) spans[1].style.color = 'var(--text-secondary)';
            }
        });

        document.getElementById('student-assignments-class-title').innerHTML = `<i class='bx bx-task'></i> Assignments in ${className}`;
        document.getElementById('student-assignments-view-card').style.display = 'block';
        document.getElementById('solve-assignment-card').style.display = 'none';
        document.getElementById('student-graded-details-card').style.display = 'none';

        await loadStudentClassroomAssignments(classCode);
        switchStudentClassroomTab('assignments');
    }

    async function loadStudentClassroomAssignments(classCode) {
        const list = document.getElementById('student-assignments-list');
        list.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);"><i class='bx bx-loader-alt bx-spin'></i> Loading assignments...</p>`;

        try {
            const res = await fetch(`${API_BASE}/assignments/classroom/${classCode}`, {
                method: 'GET',
                headers: authHeaders()
            });
            if (!res.ok) throw new Error();
            const assignments = await res.json();

            if (assignments.length === 0) {
                list.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">No assignments published in this classroom yet.</p>`;
            } else {
                list.innerHTML = assignments.map(a => {
                    const dueDate = new Date(a.due_date).toLocaleDateString('en-IN', {
                        weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    });

                    let iconClass = 'bx-file';
                    let iconBg = 'var(--secondary)';
                    if (a.assignment_type === 'ai') {
                        iconClass = 'bx-brain';
                        iconBg = 'var(--ai-accent)';
                    } else if (a.assignment_type === 'link') {
                        iconClass = 'bx-link-external';
                        iconBg = 'var(--parent)';
                    }

                    let actionBtnHtml = '';
                    let statusBadgeHtml = '';

                    if (a.submission) {
                        if (a.submission.status === 'graded') {
                            statusBadgeHtml = `<span class="status-badge status-good">Graded (${a.submission.grade}/${a.max_marks})</span>`;
                            actionBtnHtml = `
                            <button class="btn btn-secondary btn-sm" style="padding: 6px 12px; font-size: 0.78rem;" onclick="viewGradedFeedback('${a.submission.grade}', '${a.max_marks}', '${(a.submission.teacher_remarks || '').replace(/'/g, "\\'")}')">
                                <i class='bx bx-award'></i> Feedback
                            </button>
                        `;
                        } else {
                            statusBadgeHtml = `<span class="status-badge" style="background: rgba(108,52,131,0.1); color: var(--ai-accent);">Submitted</span>`;
                            actionBtnHtml = `<span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Awaiting Grading</span>`;
                        }
                    } else {
                        const isOverdue = new Date() > new Date(a.due_date);
                        if (isOverdue) {
                            statusBadgeHtml = `<span class="status-badge status-struggling">Overdue</span>`;
                            actionBtnHtml = `
                            <button class="btn btn-primary btn-sm" style="padding: 6px 12px; font-size: 0.78rem;" onclick="showSolveForm('${a.id}', '${a.title.replace(/'/g, "\\'")}', '${a.description.replace(/'/g, "\\'").replace(/\n/g, "\\n")}', '${a.assignment_type}', ${JSON.stringify(a.ai_questions || [])})">
                                <i class='bx bx-edit'></i> Submit Late
                            </button>
                        `;
                        } else {
                            statusBadgeHtml = `<span class="status-badge" style="background: rgba(42, 157, 143, 0.1); color: var(--secondary);">Assigned</span>`;
                            actionBtnHtml = `
                            <button class="btn btn-primary btn-sm" style="padding: 6px 12px; font-size: 0.78rem;" onclick="showSolveForm('${a.id}', '${a.title.replace(/'/g, "\\'")}', '${a.description.replace(/'/g, "\\'").replace(/\n/g, "\\n")}', '${a.assignment_type}', ${JSON.stringify(a.ai_questions || [])})">
                                <i class='bx bx-edit'></i> Complete
                            </button>
                        `;
                        }
                    }

                    return `
                    <div style="background: var(--bg-white); padding: 1.2rem; border-radius: 8px; border: 1px solid rgba(0,0,0,0.04); display: flex; align-items: start; gap: 1rem; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; gap: 1rem; align-items: start;">
                            <div style="background: ${iconBg}; color: #fff; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
                                <i class='bx ${iconClass}'></i>
                            </div>
                            <div>
                                <h4 style="font-weight: 700; color: var(--text-primary); font-size: 1rem; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                                    ${a.title} ${statusBadgeHtml}
                                </h4>
                                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; line-height: 1.5;">${a.description}</p>
                                <span style="font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); display: block;">
                                    <i class='bx bx-time' style="vertical-align: middle;"></i> Due: <strong>${dueDate}</strong> | Max Marks: <strong>${a.max_marks}</strong>
                                </span>
                                ${a.gdrive_link ? `
                                    <a href="${a.gdrive_link}" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 0.72rem; margin-top: 8px; background: rgba(231,111,81,0.08); color: var(--parent); border: 1px solid rgba(231,111,81,0.15); text-decoration: none;">
                                        <i class='bx bx-link'></i> Open Resource Link
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; flex-shrink: 0;">
                            ${actionBtnHtml}
                        </div>
                    </div>
                `;
                }).join('');
            }
        } catch (err) {
            console.error(err);
            list.innerHTML = `<p style="font-size: 0.85rem; color: var(--parent);">Failed to load assignments.</p>`;
        }
    }

    function showSolveForm(assignmentId, title, description, type, aiQuestions) {
        document.getElementById('student-assignments-view-card').style.display = 'none';
        document.getElementById('solve-assignment-card').style.display = 'block';
        document.getElementById('solve-assignment-card').scrollIntoView({ behavior: 'smooth' });
        document.getElementById('student-graded-details-card').style.display = 'none';

        document.getElementById('solve-assignment-title').innerHTML = `<i class='bx bx-edit'></i> Complete: ${title}`;
        document.getElementById('solve-assignment-id').value = assignmentId;
        document.getElementById('solve-assignment-description').textContent = description;
        document.getElementById('solve-text-answers').value = '';

        const mcqBox = document.getElementById('solve-mcq-solver-box');
        const mcqContainer = document.getElementById('solve-mcq-questions-container');
        mcqContainer.innerHTML = '';

        if (type === 'ai' && aiQuestions && aiQuestions.length > 0) {
            mcqBox.style.display = 'block';
            currentAssignmentSolvingData = aiQuestions;

            aiQuestions.forEach((q, idx) => {
                mcqContainer.innerHTML += `
                <div style="background: #fff; padding: 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.04); margin-bottom: 8px;">
                    <p style="font-weight: 600; margin-bottom: 8px;">Q${idx + 1}. ${q.question_text}</p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        ${q.options.map((opt, i) => `
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.88rem; cursor: pointer; padding: 6px; border: 1px solid rgba(0,0,0,0.05); border-radius: 4px; background: var(--bg-light);">
                                <input type="radio" name="solve-mcq-q-${idx}" value="${opt}" required style="accent-color: var(--secondary);">
                                <span>${['A', 'B', 'C', 'D'][i]}. ${opt}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
            });
        } else {
            mcqBox.style.display = 'none';
            currentAssignmentSolvingData = null;
        }
    }

    function hideSolveAssignmentForm() {
        document.getElementById('solve-assignment-card').style.display = 'none';
        document.getElementById('student-assignments-view-card').style.display = 'block';
    }

    function viewGradedFeedback(grade, maxMarks, remarks) {
        const card = document.getElementById('student-graded-details-card');
        card.style.display = 'block';
        card.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('graded-details-score').textContent = `${grade} / ${maxMarks}`;
        document.getElementById('graded-details-remarks').textContent = remarks || "(No comment written by teacher)";
    }

    async function handleStudentAssignmentSubmissionSubmit(e) {
        e.preventDefault();

        const assignmentId = document.getElementById('solve-assignment-id').value;
        const submission_text = document.getElementById('solve-text-answers').value.trim();

        const answers = [];
        if (currentAssignmentSolvingData) {
            currentAssignmentSolvingData.forEach((q, idx) => {
                const selected = document.querySelector(`input[name="solve-mcq-q-${idx}"]:checked`);
                if (selected) {
                    answers.push(selected.value);
                }
            });
        }

        try {
            const res = await fetch(`${API_BASE}/assignments/${assignmentId}/submit`, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify({ submission_text, answers })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to submit assignment');

            showToast('🎉 Submission saved! +50 XP Gained!', 'success');
            hideSolveAssignmentForm();
            await loadStudentClassroomAssignments(selectedStudentAssignmentClassCode);
            await syncUserStats();

        } catch (err) {
            console.error(err);
            showToast(err.message || 'Failed to submit assignment', 'error');
        }
    }

    /* ========================================
       INITIALIZE ON PAGE LOAD
       ======================================== */
    window.addEventListener('DOMContentLoaded', async () => {
        await syncUserStats();
        await loadKanbanPlans();
        await loadDoubtHistory();
        await loadClassroomsAndParent();
        await loadStudentNotifications();
        try {
            await loadConceptMastery();
        } catch (err) {
            console.error('Failed to load concept mastery:', err);
        }
        initSpeechRecognition();
        initFlashcards();
        initPomodoro();

        // Setup syllabus selectors for AI Study Plan
        const studyGrade = document.getElementById('study-grade');
        const studySubject = document.getElementById('study-subject');
        if (studyGrade) {
            studyGrade.addEventListener('change', () => {
                loadSyllabusSubjects('study-grade', 'study-subject', 'study-chapters-checklist', true);
            });
        }
        if (studySubject) {
            studySubject.addEventListener('change', () => {
                loadSyllabusChapters('study-grade', 'study-subject', 'study-chapters-checklist', true);
            });
        }

        // Setup syllabus selectors for Practice Quizzes
        const quizGrade = document.getElementById('quiz-grade');
        const quizSubject = document.getElementById('quiz-subject');
        if (quizGrade) {
            quizGrade.addEventListener('change', () => {
                loadSyllabusSubjects('quiz-grade', 'quiz-subject', 'quiz-chapter', false);
            });
        }
        if (quizSubject) {
            quizSubject.addEventListener('change', () => {
                loadSyllabusChapters('quiz-grade', 'quiz-subject', 'quiz-chapter', false);
            });
        }

        // Setup syllabus selectors for Flashcards
        const fcGrade = document.getElementById('fc-grade');
        const fcSubject = document.getElementById('fc-subject');
        if (fcGrade) {
            fcGrade.addEventListener('change', () => {
                loadSyllabusSubjects('fc-grade', 'fc-subject', 'fc-chapter', false);
            });
        }
        if (fcSubject) {
            fcSubject.addEventListener('change', () => {
                loadSyllabusChapters('fc-grade', 'fc-subject', 'fc-chapter', false);
            });
        }

        const asgSubmitForm = document.getElementById('submit-assignment-answers-form');
        if (asgSubmitForm) {
            asgSubmitForm.addEventListener('submit', handleStudentAssignmentSubmissionSubmit);
        }

        const chatForm = document.getElementById('chat-send-form');
        if (chatForm) {
            chatForm.addEventListener('submit', sendChatMessage);
        }
    });

    // Make functions globally accessible for inline onclick handlers
    window.selectChatContact = selectChatContact;
    window.selectClassroomForStudentAssignments = selectClassroomForStudentAssignments;
    window.loadStudentClassroomAssignments = loadStudentClassroomAssignments;
    window.showSolveForm = showSolveForm;
    window.hideSolveAssignmentForm = hideSolveAssignmentForm;
    window.viewGradedFeedback = viewGradedFeedback;

    /* ========================================
       CLASSROOM BULLETIN, LEADERBOARD & ALERTS
       ======================================== */
    function switchStudentClassroomTab(tabName) {
        document.getElementById('student-class-tab-assignments').style.display = tabName === 'assignments' ? 'block' : 'none';
        document.getElementById('student-class-tab-stream').style.display = tabName === 'stream' ? 'block' : 'none';
        document.getElementById('student-class-tab-leaderboard').style.display = tabName === 'leaderboard' ? 'block' : 'none';

        document.getElementById('tab-btn-student-assignments').classList.toggle('active', tabName === 'assignments');
        document.getElementById('tab-btn-student-stream').classList.toggle('active', tabName === 'stream');
        document.getElementById('tab-btn-student-leaderboard').classList.toggle('active', tabName === 'leaderboard');

        if (tabName === 'stream' && selectedStudentAssignmentClassCode) {
            loadStudentClassroomAnnouncements(selectedStudentAssignmentClassCode);
        } else if (tabName === 'leaderboard' && selectedStudentAssignmentClassCode) {
            loadStudentClassroomLeaderboard(selectedStudentAssignmentClassCode);
        }
    }

    async function loadStudentClassroomAnnouncements(classCode) {
        const feed = document.getElementById('student-announcements-feed');
        if (!feed) return;
        feed.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);"><i class='bx bx-loader-alt bx-spin'></i> Loading notices...</p>`;

        try {
            const res = await fetch(`${API_BASE}/classrooms/${classCode}/announcements`, {
                method: 'GET',
                headers: authHeaders()
            });
            if (!res.ok) throw new Error();
            const announcements = await res.json();

            if (announcements.length === 0) {
                feed.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">No announcements posted yet by the teacher.</p>`;
                return;
            }

            feed.innerHTML = announcements.map(ann => {
                const date = new Date(ann.created_at).toLocaleDateString('en-IN', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                const isLiked = ann.likes.includes(user.id);

                return `
                    <div style="background: var(--bg-light); border: 1px solid rgba(0,0,0,0.04); padding: 1.2rem; border-radius: 8px; margin-bottom: 10px; text-align: left;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="font-weight: 700; color: var(--primary); font-size: 0.95rem;">${ann.author_name}</span>
                            <span style="font-size: 0.72rem; color: var(--text-secondary);">${date}</span>
                        </div>
                        <p style="font-size: 0.92rem; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; margin-bottom: 12px;">${ann.content}</p>
                        
                        <div style="display: flex; gap: 1rem; align-items: center; border-top: 1px solid rgba(0,0,0,0.03); padding-top: 8px; margin-top: 8px;">
                            <button class="btn btn-secondary btn-sm" onclick="likeStudentAnnouncement('${classCode}', '${ann.id}')" style="padding: 4px 8px; font-size: 0.75rem; background: ${isLiked ? 'rgba(42,157,143,0.1)' : 'transparent'}; color: ${isLiked ? 'var(--secondary)' : 'var(--text-secondary)'}; border: none;">
                                <i class='bx ${isLiked ? 'bxs-heart' : 'bx-heart'}'></i> Like (${ann.likes.length})
                            </button>
                        </div>
                        
                        <!-- Comments Section -->
                        <div style="margin-top: 12px; background: rgba(0,0,0,0.01); padding: 10px; border-radius: 6px;">
                            <div id="student-comments-list-${ann.id}" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
                                ${ann.comments.length === 0 ? `<p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">No comments yet.</p>` : ann.comments.map(c => `
                                    <div style="font-size: 0.8rem; line-height: 1.4; border-bottom: 1px dashed rgba(0,0,0,0.02); padding-bottom: 4px; margin-bottom: 4px;">
                                        <strong style="color: var(--primary);">${c.user_name} (${c.user_role}):</strong>
                                        <span style="color: var(--text-primary);">${c.content}</span>
                                    </div>
                                `).join('')}
                            </div>
                            <form onsubmit="postStudentAnnouncementComment(event, '${classCode}', '${ann.id}')" style="display: flex; gap: 6px;">
                                <input type="text" placeholder="Add a comment..." class="form-input-db btn-sm" required style="font-size: 0.75rem; padding: 4px 8px; flex-grow: 1;">
                                <button type="submit" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;">Reply</button>
                            </form>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error(err);
            feed.innerHTML = `<p style="font-size: 0.85rem; color: var(--parent);">Failed to load notices.</p>`;
        }
    }

    async function likeStudentAnnouncement(classCode, announcementId) {
        try {
            const res = await fetch(`${API_BASE}/classrooms/${classCode}/announcements/${announcementId}/like`, {
                method: 'POST',
                headers: authHeaders()
            });
            if (res.ok) {
                await loadStudentClassroomAnnouncements(classCode);
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function postStudentAnnouncementComment(e, classCode, announcementId) {
        e.preventDefault();
        const input = e.target.querySelector('input');
        const content = input.value.trim();
        if (!content) return;

        try {
            const res = await fetch(`${API_BASE}/classrooms/${classCode}/announcements/${announcementId}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ content })
            });
            if (res.ok) {
                input.value = '';
                await loadStudentClassroomAnnouncements(classCode);
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function loadStudentClassroomLeaderboard(classCode) {
        const tbody = document.getElementById('student-class-leaderboard-body');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);"><i class='bx bx-loader-alt bx-spin'></i> Loading leaderboard...</td></tr>`;

        try {
            const res = await fetch(`${API_BASE}/classrooms/${classCode}/leaderboard`, {
                method: 'GET',
                headers: authHeaders()
            });
            if (!res.ok) throw new Error();
            const leaderboard = await res.json();

            tbody.innerHTML = leaderboard.map(student => {
                const isMe = student.id === user.id;
                return `
                    <tr style="background: ${isMe ? 'rgba(42,157,143,0.05)' : 'transparent'}; font-weight: ${isMe ? '700' : '400'}; border-left: 3px solid ${isMe ? 'var(--secondary)' : 'transparent'};">
                        <td style="color: var(--secondary); font-size: 0.95rem; font-weight: 700;">
                            ${student.rank === 1 ? '🥇 1' : student.rank === 2 ? '🥈 2' : student.rank === 3 ? '🥉 3' : student.rank}
                        </td>
                        <td style="color: var(--text-primary);">${student.name} ${isMe ? '<strong>(You)</strong>' : ''}</td>
                        <td><span class="status-badge" style="background: var(--primary); color: #fff; font-size: 0.72rem; padding: 2px 6px;">Lvl ${student.level}</span></td>
                        <td style="color: var(--secondary); font-weight: 700;">${student.xp} XP</td>
                    </tr>
                `;
            }).join('');
        } catch (err) {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--parent);">Failed to load leaderboard.</td></tr>`;
        }
    }

    async function loadStudentNotifications() {
        const container = document.getElementById('student-alerts-container');
        if (!container) return;

        try {
            const res = await fetch(`${API_BASE}/classrooms/notifications`, {
                method: 'GET',
                headers: authHeaders()
            });
            if (!res.ok) throw new Error();
            const notifications = await res.json();

            if (notifications.length === 0) {
                container.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; margin-top: 1rem;">No recent notifications.</p>`;
                return;
            }

            container.innerHTML = notifications.map(notif => {
                const date = new Date(notif.created_at).toLocaleDateString('en-IN', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                });
                const isUnread = !notif.read;

                let iconClass = 'bx-bell';
                let iconColor = 'var(--text-secondary)';
                if (notif.type === 'assignment_created') {
                    iconClass = 'bx-task';
                    iconColor = 'var(--secondary)';
                } else if (notif.type === 'assignment_graded') {
                    iconClass = 'bx-badge-check';
                    iconColor = 'var(--secondary)';
                } else if (notif.type === 'announcement_created') {
                    iconClass = 'bx-news';
                    iconColor = 'var(--ai-accent)';
                }

                return `
                    <div style="background: var(--bg-light); border-radius: 6px; padding: 8px 10px; border: 1px solid rgba(0,0,0,0.03); display: flex; align-items: flex-start; gap: 8px; position: relative; cursor: pointer; border-left: 3px solid ${isUnread ? 'var(--secondary)' : 'transparent'}; text-align: left; margin-bottom: 6px;" onclick="markStudentNotificationRead('${notif.id}')">
                        <i class='bx ${iconClass}' style="font-size: 1.1rem; color: ${iconColor}; margin-top: 2px;"></i>
                        <div style="flex-grow: 1;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; margin-bottom: 2px; align-items: center;">
                                <span style="color: var(--text-primary); font-weight: ${isUnread ? '700' : '600'};">${notif.title}</span>
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span style="font-size: 0.68rem; color: var(--text-secondary);">${date}</span>
                                    <button onclick="deleteStudentNotificationItem(event, '${notif.id}')" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0 4px;" title="Delete Alert">&times;</button>
                                </div>
                            </div>
                            <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0; line-height: 1.3;">${notif.content}</p>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Failed to load student notifications:', err);
            container.innerHTML = `<p style="font-size: 0.8rem; color: var(--parent); text-align: center; margin-top: 1rem;">Failed to load alerts.</p>`;
        }
    }

    async function markStudentNotificationRead(notificationId) {
        try {
            const res = await fetch(`${API_BASE}/classrooms/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: authHeaders()
            });
            if (res.ok) {
                await loadStudentNotifications();
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function clearStudentNotifications() {
        if (!confirm('Are you sure you want to clear all notifications?')) return;
        try {
            const res = await fetch(`${API_BASE}/classrooms/notifications`, {
                method: 'DELETE',
                headers: authHeaders()
            });
            if (res.ok) {
                showToast('Notifications cleared.', 'success');
                await loadStudentNotifications();
            } else {
                const data = await res.json();
                showToast(data.detail || 'Failed to clear notifications.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error clearing notifications.', 'error');
        }
    }

    async function deleteStudentNotificationItem(e, notificationId) {
        e.stopPropagation();
        try {
            const res = await fetch(`${API_BASE}/classrooms/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: authHeaders()
            });
            if (res.ok) {
                showToast('Notification deleted.', 'success');
                await loadStudentNotifications();
            } else {
                const data = await res.json();
                showToast(data.detail || 'Failed to delete notification.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error deleting notification.', 'error');
        }
    }

    async function initProfilePanel() {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Fill form fields
        document.getElementById('profile-input-name').value = storedUser.name || '';
        document.getElementById('profile-input-email').value = storedUser.email || '';
        document.getElementById('profile-input-phone').value = storedUser.phone || '';
        document.getElementById('profile-input-bio').value = storedUser.bio || '';
        document.getElementById('profile-input-grade').value = storedUser.grade || '';
        document.getElementById('profile-input-school').value = storedUser.school || '';
        document.getElementById('profile-input-persona').value = storedUser.tutor_persona || 'analogy';

        // Render profile picture
        const placeholderEl = document.getElementById('profile-pic-placeholder');
        const imgEl = document.getElementById('profile-pic-preview-img');
        
        if (storedUser.profile_pic) {
            imgEl.src = storedUser.profile_pic.startsWith('http') ? storedUser.profile_pic : BACKEND_URL + storedUser.profile_pic;
            imgEl.style.display = 'block';
            placeholderEl.style.display = 'none';
        } else {
            placeholderEl.textContent = (storedUser.name || 'S').charAt(0).toUpperCase();
            placeholderEl.style.display = 'flex';
            imgEl.style.display = 'none';
        }

        // Setup photo upload event triggers (only once)
        const clickTrigger = document.getElementById('profile-pic-click-trigger');
        const fileInput = document.getElementById('profile-pic-file-input');
        
        if (clickTrigger && fileInput && !clickTrigger.dataset.listenerAdded) {
            clickTrigger.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', async () => {
                if (fileInput.files.length === 0) return;
                const file = fileInput.files[0];
                
                const formData = new FormData();
                formData.append('file', file);
                
                try {
                    showToast('Uploading profile picture...', 'info');
                    const res = await fetch(`${API_BASE}/auth/profile/avatar`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        },
                        body: formData
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showToast('🎉 Profile picture updated successfully!', 'success');
                        storedUser.profile_pic = data.profile_pic;
                        localStorage.setItem('user', JSON.stringify(storedUser));
                        
                        // Update preview
                        imgEl.src = data.profile_pic.startsWith('http') ? data.profile_pic : BACKEND_URL + data.profile_pic;
                        imgEl.style.display = 'block';
                        placeholderEl.style.display = 'none';
                        
                        // Sync stats (sidebar avatar)
                        await syncUserStats();
                    } else {
                        showToast(data.detail || 'Failed to upload image.', 'error');
                    }
                } catch (err) {
                    console.error('Error uploading avatar:', err);
                    showToast('Error uploading profile picture.', 'error');
                }
            });
            clickTrigger.dataset.listenerAdded = 'true';
        }

        // Setup profile details form submit (only once)
        const updateForm = document.getElementById('profile-update-form');
        if (updateForm && !updateForm.dataset.listenerAdded) {
            updateForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const name = document.getElementById('profile-input-name').value.trim();
                const phone = document.getElementById('profile-input-phone').value.trim();
                const bio = document.getElementById('profile-input-bio').value.trim();
                const grade = document.getElementById('profile-input-grade').value;
                const school = document.getElementById('profile-input-school').value.trim();
                const tutor_persona = document.getElementById('profile-input-persona').value;
                
                try {
                    const res = await fetch(`${API_BASE}/auth/profile`, {
                        method: 'PUT',
                        headers: authHeaders(),
                        body: JSON.stringify({ name, phone, bio, grade, school, tutor_persona })
                    });
                    const updatedUser = await res.json();
                    if (res.ok) {
                        showToast('🎉 Profile details saved successfully!', 'success');
                        localStorage.setItem('user', JSON.stringify(updatedUser));
                        await syncUserStats();
                    } else {
                        showToast(updatedUser.detail || 'Failed to update profile.', 'error');
                    }
                } catch (err) {
                    console.error('Error updating profile:', err);
                    showToast('Error saving profile details.', 'error');
                }
            });
            updateForm.dataset.listenerAdded = 'true';
        }

        // Load connections
        await loadConnections();
    }

    async function loadConnections() {
        const parentsList = document.getElementById('profile-parents-list');
        const teachersList = document.getElementById('profile-teachers-list');
        
        if (!parentsList || !teachersList) return;
        
        parentsList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;"><i class='bx bx-loader-alt bx-spin'></i> Loading connections...</p>`;
        teachersList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;"><i class='bx bx-loader-alt bx-spin'></i> Loading connections...</p>`;
        
        try {
            const res = await fetch(`${API_BASE}/auth/profile/connections`, {
                method: 'GET',
                headers: authHeaders()
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            
            // Render Parents
            if (!data.parents || data.parents.length === 0) {
                parentsList.innerHTML = `<div style="font-size: 0.88rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;">No parents linked. Share your email with your parent to link accounts.</div>`;
            } else {
                parentsList.innerHTML = data.parents.map(p => {
                    const initial = p.name.charAt(0).toUpperCase();
                    const avatarHtml = p.profile_pic 
                        ? `<img src="${p.profile_pic.startsWith('http') ? p.profile_pic : BACKEND_URL + p.profile_pic}" alt="Avatar">`
                        : initial;
                    const relation = p.relationship || 'Parent';
                    return `
                        <div class="connection-card">
                            <div class="connection-avatar">${avatarHtml}</div>
                            <div class="connection-info">
                                <span class="connection-name">${p.name}</span>
                                <span class="connection-detail"><i class='bx bx-envelope'></i> ${p.email}</span>
                                ${p.phone ? `<span class="connection-detail"><i class='bx bx-phone'></i> ${p.phone}</span>` : ''}
                            </div>
                            <span class="connection-badge parent">${relation}</span>
                        </div>
                    `;
                }).join('');
            }
            
            // Render Teachers
            if (!data.teachers || data.teachers.length === 0) {
                teachersList.innerHTML = `<div style="font-size: 0.88rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;">No classrooms joined yet. Join a classroom from Overview to link with teachers.</div>`;
            } else {
                teachersList.innerHTML = data.teachers.map(t => {
                    const initial = t.name.charAt(0).toUpperCase();
                    const avatarHtml = t.profile_pic 
                        ? `<img src="${t.profile_pic.startsWith('http') ? t.profile_pic : BACKEND_URL + t.profile_pic}" alt="Avatar">`
                        : initial;
                    const subject = t.subject || 'Teacher';
                    return `
                        <div class="connection-card">
                            <div class="connection-avatar">${avatarHtml}</div>
                            <div class="connection-info">
                                <span class="connection-name">${t.name}</span>
                                <span class="connection-detail"><i class='bx bx-book-bookmark'></i> Classroom: ${t.classroom_name}</span>
                                <span class="connection-detail"><i class='bx bx-envelope'></i> ${t.email}</span>
                                ${t.phone ? `<span class="connection-detail"><i class='bx bx-phone'></i> ${t.phone}</span>` : ''}
                            </div>
                            <span class="connection-badge teacher">${subject}</span>
                        </div>
                    `;
                }).join('');
            }
        } catch (err) {
            console.error('Failed to load connections:', err);
            parentsList.innerHTML = `<div style="font-size: 0.85rem; color: var(--parent); text-align: center; padding: 1rem 0;">Error loading parents list.</div>`;
            teachersList.innerHTML = `<div style="font-size: 0.85rem; color: var(--parent); text-align: center; padding: 1rem 0;">Error loading teachers list.</div>`;
        }
    }

    window.switchStudentClassroomTab = switchStudentClassroomTab;
    window.loadStudentClassroomAnnouncements = loadStudentClassroomAnnouncements;
    window.likeStudentAnnouncement = likeStudentAnnouncement;
    window.postStudentAnnouncementComment = postStudentAnnouncementComment;
    window.loadStudentClassroomLeaderboard = loadStudentClassroomLeaderboard;
    window.loadStudentNotifications = loadStudentNotifications;
    window.markStudentNotificationRead = markStudentNotificationRead;
    window.clearStudentNotifications = clearStudentNotifications;
    window.deleteStudentNotificationItem = deleteStudentNotificationItem;
    window.initProfilePanel = initProfilePanel;
}
