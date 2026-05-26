/* ========================================
   EduFlow AI — Teacher Dashboard Logic
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
    toast.className = `toast toast-${type}`;
    
    let icon = 'bx-info-circle';
    if (type === 'success') icon = 'bx-check-circle';
    else if (type === 'error') icon = 'bx-error-circle';
    else if (type === 'warning') icon = 'bx-error';
    
    toast.innerHTML = `
        <i class='bx ${icon} toast-icon'></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close">&times;</button>
    `;
    
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    });
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
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
   AUTH GUARD
   ======================================== */
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'teacher') {
    alert('Please login as a Teacher to access this dashboard.');
    window.location.href = 'login.html';
}

/* ========================================
   PROFILE RENDERING
   ======================================== */
document.getElementById('profile-name').textContent = user.name || 'Teacher';
document.getElementById('profile-avatar').textContent = (user.name || 'T').charAt(0).toUpperCase();

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
    'overview-panel': { title: 'Teacher Dashboard', sub: 'Manage your classes and track student progress.' },
    'quiz-gen-panel': { title: 'Create AI Quiz', sub: 'Generate MCQ tests for your students using AI.' },
    'students-panel': { title: 'Student Performance', sub: 'View detailed performance reports of each student.' },
    'alerts-panel': { title: 'Smart Alerts', sub: 'AI-generated alerts about students who need attention.' }
};

function switchPanel(panelId) {
    panels.forEach(p => p.classList.remove('active'));
    menuItems.forEach(m => m.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
    const targetMenu = document.querySelector(`[data-panel="${panelId}"]`);
    if (targetMenu) targetMenu.classList.add('active');
    const info = panelTitles[panelId];
    if (info) {
        document.getElementById('panel-title').textContent = info.title;
        document.getElementById('panel-subtitle').textContent = info.sub;
    }
}

menuItems.forEach(item => {
    item.addEventListener('click', () => switchPanel(item.getAttribute('data-panel')));
});

window.switchPanel = switchPanel;

/* ========================================
   HELPER — Auth headers
   ======================================== */
function authHeaders() {
    return { 'Authorization': `Bearer ${token}` };
}

/* ========================================
   TEACHER QUIZ GENERATOR
   ======================================== */
let generatedQuiz = null;

document.getElementById('teacher-quiz-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const topic = document.getElementById('tq-topic').value.trim();
    const grade = document.getElementById('tq-grade').value;
    const difficulty = document.getElementById('tq-difficulty').value;
    const numQ = parseInt(document.getElementById('tq-count').value);

    document.getElementById('teacher-quiz-setup').style.display = 'none';
    document.getElementById('tq-loader').style.display = 'flex';
    document.getElementById('tq-preview-box').style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/ai/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ topic, grade, num_questions: numQ, difficulty })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate quiz');

        generatedQuiz = data;
        renderTeacherQuizPreview(data);
        document.getElementById('tq-preview-box').style.display = 'block';

        // Increment stat
        const el = document.getElementById('stat-quizzes-created');
        el.textContent = parseInt(el.textContent) + 1;
    } catch (err) {
        let errMsg = err.message || 'Error occurred';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
            errMsg = '🔌 Server is offline! Please start the backend server.';
        }
        showToast(errMsg, 'error');
        document.getElementById('teacher-quiz-setup').style.display = 'block';
    } finally {
        document.getElementById('tq-loader').style.display = 'none';
    }
});

function renderTeacherQuizPreview(data) {
    const container = document.getElementById('tq-quiz-list');
    container.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    data.questions.forEach((q, idx) => {
        const div = document.createElement('div');
        div.style.cssText = 'margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid rgba(0,0,0,0.05);';
        div.innerHTML = `
            <p style="font-size: 0.8rem; color: var(--secondary); font-weight: 600; text-transform: uppercase; margin-bottom: 0.3rem;">Question ${idx + 1}</p>
            <p style="font-weight: 600; margin-bottom: 0.8rem; font-size: 1.05rem; color: var(--primary);">${q.question_text}</p>
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                ${q.options.map((opt, i) => `
                    <div style="padding: 0.6rem 1rem; border-radius: 6px; font-size: 0.95rem;
                        background-color: ${opt === q.correct_option ? 'rgba(42,157,143,0.08)' : 'var(--bg-light)'};
                        border-left: 3px solid ${opt === q.correct_option ? 'var(--secondary)' : 'transparent'};
                        font-weight: ${opt === q.correct_option ? '600' : '400'};">
                        <strong>${letters[i]}.</strong> ${opt}
                    </div>
                `).join('')}
            </div>
            <p style="margin-top: 0.6rem; font-size: 0.85rem; color: var(--ai-accent); font-style: italic;">
                <i class='bx bx-bulb'></i> ${q.explanation}
            </p>
        `;
        container.appendChild(div);
    });
}

function printTeacherQuiz() {
    if (!generatedQuiz) return;
    const letters = ['A', 'B', 'C', 'D'];
    let html = `<h1>Quiz: ${generatedQuiz.topic}</h1><p>Grade: ${generatedQuiz.grade} | Difficulty: ${generatedQuiz.difficulty}</p><hr>`;
    generatedQuiz.questions.forEach((q, idx) => {
        html += `<h3>Q${idx + 1}. ${q.question_text}</h3><ol type="A">`;
        q.options.forEach(opt => { html += `<li>${opt}</li>`; });
        html += `</ol><p><strong>Answer:</strong> ${q.correct_option}</p><hr>`;
    });
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>EduFlow Quiz</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body{font-family:'Inter',sans-serif;padding:2rem;line-height:1.7;color:#2D3436}h1,h2,h3{color:#1B2A4A}hr{border:none;border-top:1px solid #eee;margin:1.5rem 0}</style>
    </head><body>${html}</body></html>`);
    w.document.close();
    w.print();
}
window.printTeacherQuiz = printTeacherQuiz;
