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

const API_BASE = 'http://127.0.0.1:8000/api';

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
                    const testRes = await fetch('http://127.0.0.1:8000/', { method: 'GET' });
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
        document.getElementById('profile-avatar').textContent = (updatedUser.name || 'S').charAt(0).toUpperCase();
        
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
    'chat-panel': { title: 'Direct Messages', sub: 'Communicate with teachers of your classrooms.' }
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
}

menuItems.forEach(item => {
    item.addEventListener('click', () => {
        switchPanel(item.getAttribute('data-panel'));
    });
});

window.switchPanel = switchPanel;

/* ========================================
   TAG INPUT — Weak Topics
   ======================================== */
const weakTopics = [];
const topicsInput = document.getElementById('study-topics-input');
const topicsContainer = document.getElementById('study-topics-container');

if (topicsInput) {
    topicsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = topicsInput.value.trim();
            if (val && !weakTopics.includes(val)) {
                weakTopics.push(val);
                renderTopicTags();
            }
            topicsInput.value = '';
        }
    });
}

function renderTopicTags() {
    topicsContainer.querySelectorAll('.tag-pill').forEach(t => t.remove());
    weakTopics.forEach((topic, idx) => {
        const pill = document.createElement('div');
        pill.classList.add('tag-pill');
        pill.innerHTML = `${topic} <i class='bx bx-x' data-idx="${idx}"></i>`;
        topicsContainer.insertBefore(pill, topicsInput);
    });
    topicsContainer.querySelectorAll('.tag-pill i').forEach(icon => {
        icon.addEventListener('click', () => {
            weakTopics.splice(parseInt(icon.dataset.idx), 1);
            renderTopicTags();
        });
    });
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

    const subject = document.getElementById('study-subject').value.trim();
    const grade = document.getElementById('study-grade').value;
    const goals = document.getElementById('study-goals').value.trim();

    if (weakTopics.length === 0) {
        showToast('Please add at least one weak topic.', 'warning');
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
                weak_topics: weakTopics,
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
        
        document.getElementById('study-subject').value = '';
        document.getElementById('study-goals').value = '';
        weakTopics.length = 0;
        renderTopicTags();
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

    const topic = document.getElementById('quiz-topic').value.trim();
    const grade = document.getElementById('quiz-grade').value;
    const difficulty = document.getElementById('quiz-difficulty').value;
    const numQ = parseInt(document.getElementById('quiz-count').value);
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
            body: JSON.stringify({ topic, grade, num_questions: numQ, difficulty })
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

    document.getElementById('quiz-q-num').textContent = `Question ${currentQ + 1} of ${total}`;
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
        setupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const topic = document.getElementById('fc-topic').value.trim();
            const grade = document.getElementById('fc-grade').value;
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
        } catch (err) {
            console.error('Failed to load student classrooms:', err);
        }
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

// Make functions globally accessible for inline onclick handlers
window.selectChatContact = selectChatContact;

/* ========================================
   INITIALIZE ON PAGE LOAD
   ======================================== */
window.addEventListener('DOMContentLoaded', async () => {
    await syncUserStats();
    await loadKanbanPlans();
    await loadDoubtHistory();
    await loadClassroomsAndParent();
    initSpeechRecognition();
    initFlashcards();
    initPomodoro();
    
    const chatForm = document.getElementById('chat-send-form');
    if (chatForm) {
        chatForm.addEventListener('submit', sendChatMessage);
    }
});
