/* ========================================
   EduFlow AI — Parent Dashboard Logic
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

if (!token || !user || user.role !== 'parent') {
    alert('Please login as a Parent to access this dashboard.');
    window.location.href = 'login.html';
}

/* ========================================
   PROFILE RENDERING
   ======================================== */
document.getElementById('profile-name').textContent = user.name || 'Parent';
document.getElementById('profile-avatar').textContent = (user.name || 'P').charAt(0).toUpperCase();

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
    'overview-panel': { title: 'Parent Dashboard', sub: "Monitor your child's academic journey in real time." },
    'progress-panel': { title: 'Child Progress', sub: 'Detailed attendance, activity logs, and recent test scores.' },
    'alerts-panel': { title: 'Notifications', sub: 'Alerts from teachers and AI about your child.' },
    'tips-panel': { title: 'AI Parenting Tips', sub: 'Get personalized advice to support your child at home.' }
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
   AI PARENTING TIPS
   Uses the study-plan endpoint creatively
   with a parent-oriented prompt
   ======================================== */
document.getElementById('tips-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const concern = document.getElementById('parent-concern').value.trim();

    document.getElementById('tips-loader').style.display = 'flex';
    document.getElementById('tips-output-box').style.display = 'none';

    // Build a study plan request that the AI will interpret as parenting advice
    const childWeakAreas = ['Quadratic Equations', 'Indian Freedom Movement'];
    const parentGoal = concern
        ? `Parent's concern: ${concern}. Provide actionable parenting tips to support the child.`
        : "Provide actionable tips for parents to help their child improve in weak areas at home.";

    try {
        const res = await fetch(`${API_BASE}/ai/study-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
                subject: "Parenting & Home Support",
                grade: "Class 10",
                weak_topics: childWeakAreas,
                target_goals: parentGoal
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to get parenting tips');

        const html = marked.parse(data.study_plan);
        document.getElementById('tips-markdown-content').innerHTML = html;
        document.getElementById('tips-output-box').style.display = 'block';
    } catch (err) {
        let errMsg = err.message || 'Error occurred';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
            errMsg = '🔌 Server is offline! Please start the backend server.';
        }
        showToast(errMsg, 'error');
        console.error(err);
    } finally {
        document.getElementById('tips-loader').style.display = 'none';
    }
});
