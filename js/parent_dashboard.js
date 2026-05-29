/* ========================================
   EduFlow AI — Parent Dashboard Logic
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
async function syncUserStats() {
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const updatedUser = await res.json();
        
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        document.getElementById('profile-name').textContent = updatedUser.name || 'Parent';
        const avatarEl = document.getElementById('profile-avatar');
        if (updatedUser.profile_pic) {
            avatarEl.innerHTML = `<img src="${updatedUser.profile_pic.startsWith('http') ? updatedUser.profile_pic : BACKEND_URL + updatedUser.profile_pic}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            avatarEl.textContent = (updatedUser.name || 'P').charAt(0).toUpperCase();
        }
    } catch (err) {
        console.error('Failed to sync user stats:', err);
    }
}
syncUserStats();

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
    'assignments-panel': { title: 'Assignments Tracker', sub: "Monitor your child's published homework, worksheets, and grades." },
    'alerts-panel': { title: 'Notifications', sub: 'Alerts from teachers and AI about your child.' },
    'tips-panel': { title: 'AI Parenting Tips', sub: 'Get personalized advice to support your child at home.' },
    'chat-panel': { title: 'Direct Messages', sub: "Communicate with your child's teachers." },
    'profile-panel': { title: 'My Profile', sub: 'Manage your settings, update details, and view linked connections.' }
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
   DYNAMIC NCERT SYLLABUS LOADER HELPERS
   ======================================== */
async function loadSyllabusSubjects(gradeSelectId, subjectSelectId, targetId) {
    const gradeSelect = document.getElementById(gradeSelectId);
    const subjectSelect = document.getElementById(subjectSelectId);
    const target = document.getElementById(targetId);
    
    if (!gradeSelect || !subjectSelect) return;
    
    const selectedGrade = gradeSelect.value;
    if (!selectedGrade) {
        subjectSelect.innerHTML = '<option value="" disabled selected>Select class first</option>';
        if (target) {
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
            
        if (target) {
            target.innerHTML = '<option value="" disabled selected>Select subject first</option>';
        }
    } catch (err) {
        console.error('Failed to load syllabus subjects:', err);
        showToast('Error loading subjects.', 'error');
    }
}

async function loadSyllabusChapters(gradeSelectId, subjectSelectId, targetId) {
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
        
        target.innerHTML = '<option value="" disabled selected>Select chapter/topic</option>' + 
            chapters.map(ch => `<option value="${ch.chapter_name}">Ch ${ch.chapter_number}. ${ch.chapter_name}</option>`).join('');
    } catch (err) {
        console.error('Failed to load syllabus chapters:', err);
        showToast('Error loading chapters.', 'error');
    }
}

/* ========================================
   AI PARENTING TIPS
   Uses the study-plan endpoint creatively
   with a parent-oriented prompt
   ======================================== */
/* ========================================
   AI PARENTING TIPS & CHILD LINKING LOGIC
   ======================================== */
let linkedStudents = [];
let selectedChildEmail = '';
let selectedChildQuizHistory = [];

async function loadLinkedChildren() {
    try {
        const res = await fetch(`${API_BASE}/auth/parent/linked-students`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        linkedStudents = await res.json();

        const select = document.getElementById('parent-child-select');
        if (select) {
            if (linkedStudents.length === 0) {
                select.innerHTML = `<option value="">No children linked</option>`;
                clearChildDashboard();
            } else {
                select.innerHTML = linkedStudents.map(s => `
                    <option value="${s.email}">${s.name} (${s.email})</option>
                `).join('');
                
                // Select first child by default if none selected
                if (!selectedChildEmail || !linkedStudents.some(s => s.email === selectedChildEmail)) {
                    selectedChildEmail = linkedStudents[0].email;
                }
                select.value = selectedChildEmail;
                await syncSelectedChildData();
            }
        }
    } catch (err) {
        console.error('Failed to load linked students:', err);
    }
}

function clearChildDashboard() {
    document.getElementById('child-xp-display').textContent = '0 XP';
    document.getElementById('child-level-display').textContent = 'Level 1';
    document.getElementById('child-badges-display').textContent = '0';
    document.getElementById('parent-subject-performance-body').innerHTML = `
        <tr><td colspan="5" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No children linked. Use the form below to link a child.</td></tr>
    `;
    document.getElementById('parent-recent-tests-body').innerHTML = `
        <tr><td colspan="5" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No children linked. Use the form below to link a child.</td></tr>
    `;
    document.getElementById('child-achievements-list').innerHTML = `
        <p style="font-size: 0.85rem; color: var(--text-secondary);">No achievements yet.</p>
    `;
}

async function syncSelectedChildData() {
    if (!selectedChildEmail) return;
    const child = linkedStudents.find(s => s.email === selectedChildEmail);
    if (!child) return;

    // Update basic stats
    document.getElementById('child-xp-display').textContent = `${child.xp || 0} XP`;
    document.getElementById('child-level-display').textContent = `Level ${child.level || 1}`;
    document.getElementById('child-badges-display').textContent = child.badges ? child.badges.length : 0;

    // Badges in achievements card
    const achievementsContainer = document.getElementById('child-achievements-list');
    if (achievementsContainer) {
        if (!child.badges || child.badges.length === 0) {
            achievementsContainer.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">No badges unlocked yet.</p>`;
        } else {
            achievementsContainer.innerHTML = child.badges.map(b => `
                <div class="feed-item" style="border: none; padding: 0;">
                    <div class="feed-item-icon" style="background-color: rgba(255, 176, 32, 0.15); color: #B37D00;">
                        <i class='bx bx-award'></i>
                    </div>
                    <div class="feed-item-details">
                        <span class="feed-item-title">${b}</span>
                        <span class="feed-item-body">Unlocked via student milestones</span>
                    </div>
                </div>
            `).join('');
        }
    }

    // Fetch child's real quiz score timeline
    try {
        const res = await fetch(`${API_BASE}/ai/quiz/student-history/${selectedChildEmail}`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (res.ok) {
            selectedChildQuizHistory = await res.json();
            renderChildAnalytics();
        } else {
            showToast('Failed to load child history.', 'error');
        }
        await loadChildClassroomsForAssignments();
    } catch (err) {
        console.error('Failed to sync child history:', err);
    }
}

window.parentChildRadarChartInstance = null;
window.parentChildBarChartInstance = null;
window.parentChildDoughnutChartInstance = null;

async function downloadParentChildPDFReport() {
    const parentSelect = document.getElementById('parent-child-select');
    const childName = parentSelect ? parentSelect.options[parentSelect.selectedIndex]?.text : 'Child';
    const childEmail = parentSelect ? parentSelect.value : '';
    
    const history = selectedChildQuizHistory || [];
    
    if (history.length === 0) {
        showToast('No progress history found to export.', 'warning');
        return;
    }
    
    showToast('Compiling child progress scorecard...', 'info');
    
    const pdfContainer = document.createElement('div');
    pdfContainer.style.padding = '35px';
    pdfContainer.style.fontFamily = "'Inter', sans-serif";
    pdfContainer.style.color = '#333';
    pdfContainer.style.backgroundColor = '#fff';
    pdfContainer.style.width = '750px';
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.top = '-9999px';
    
    const averageScore = document.getElementById('insights-child-average')?.innerText || '--%';
    const weakTopic = document.getElementById('insights-child-weak-topic')?.innerText || '--';
    
    let content = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #e76f51; padding-bottom: 15px; margin-bottom: 25px;">
            <div>
                <h1 style="margin: 0; color: #e76f51; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">EduFlow AI</h1>
                <p style="margin: 3px 0 0 0; font-size: 13px; color: #666; font-weight: 500;">Child Learning Progress Report (Parent Panel)</p>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 10px; color: #999; font-weight: 600; text-transform: uppercase;">Generated On</span>
                <p style="margin: 3px 0 0 0; font-size: 13px; color: #333; font-weight: 600;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; display: flex; flex-direction: column; justify-content: center;">
                <h3 style="margin: 0 0 5px 0; font-size: 11px; color: #e76f51; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Linked Child</h3>
                <p style="margin: 0; font-size: 14px; color: #333; font-weight: 700;">${childName}</p>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #666;">${childEmail}</p>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; text-align: center; display: flex; flex-direction: column; justify-content: center;">
                <span style="font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase;">Overall Average</span>
                <p style="margin: 4px 0 0 0; font-size: 18px; font-weight: 800; color: #2a9d8f;">${averageScore}</p>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; text-align: center; display: flex; flex-direction: column; justify-content: center;">
                <span style="font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase;">Focus Topic</span>
                <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: #e76f51; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${weakTopic}</p>
            </div>
        </div>
        
        <div style="margin-bottom: 25px;">
            <h3 style="margin: 0 0 12px 0; font-size: 13px; color: #e76f51; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Recent Assessment Performance</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #dee2e6;">
                <thead>
                    <tr style="background-color: #f1f3f5; border-bottom: 2px solid #dee2e6;">
                        <th style="padding: 10px; text-align: left; font-weight: 700; color: #495057;">Topic / Concept</th>
                        <th style="padding: 10px; text-align: center; font-weight: 700; color: #495057; width: 100px;">Difficulty</th>
                        <th style="padding: 10px; text-align: center; font-weight: 700; color: #495057; width: 150px;">Attempt Date</th>
                        <th style="padding: 10px; text-align: center; font-weight: 700; color: #495057; width: 120px;">Score Received</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    history.slice(0, 8).forEach(h => {
        const date = h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN', {
            month: 'short', day: 'numeric', year: 'numeric'
        }) : '';
        const pct = Math.round((h.score / h.total_questions) * 100);
        const scoreColor = pct >= 70 ? '#2a9d8f' : '#e76f51';
        
        content += `
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 10px; color: #212529; font-weight: 600;">${h.topic}</td>
                <td style="padding: 10px; text-align: center; text-transform: capitalize; color: #495057;">${h.difficulty}</td>
                <td style="padding: 10px; text-align: center; color: #6c757d;">${date}</td>
                <td style="padding: 10px; text-align: center; font-weight: 700; color: ${scoreColor};">
                    ${h.score} / ${h.total_questions} (${pct}%)
                </td>
            </tr>
        `;
    });
    
    content += `
                </tbody>
            </table>
        </div>
        
        <!-- Add charts to PDF -->
        <div style="margin-bottom: 25px; page-break-inside: avoid;">
            <h3 style="margin: 0 0 15px 0; font-size: 13px; color: #e76f51; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Subject Mastery Insights</h3>
            <div style="display: flex; gap: 20px; justify-content: center; align-items: center;">
                <div style="width: 320px; height: 260px; position: relative;">
                    <h4 style="font-size: 11px; text-align: center; margin: 0 0 8px 0; color: #666; font-weight: 600;">Child Mastery Radar Map</h4>
                    <canvas id="pdf-parent-radar-chart" style="width: 100%; height: 100%;"></canvas>
                </div>
                <div style="width: 320px; height: 260px; position: relative;">
                    <h4 style="font-size: 11px; text-align: center; margin: 0 0 8px 0; color: #666; font-weight: 600;">Average Score by Topic</h4>
                    <canvas id="pdf-parent-bar-chart" style="width: 100%; height: 100%;"></canvas>
                </div>
            </div>
        </div>
        
        <div style="border-top: 1px dashed #ced4da; padding-top: 15px; text-align: center; font-size: 11px; color: #6c757d; margin-top: 35px;">
            <p style="margin: 0;">This report is automatically compiled and provided for parents by the EduFlow AI Platform.</p>
        </div>
    `;
    
    pdfContainer.innerHTML = content;
    document.body.appendChild(pdfContainer);
    
    const pdfRadarCtx = document.getElementById('pdf-parent-radar-chart').getContext('2d');
    const pdfBarCtx = document.getElementById('pdf-parent-bar-chart').getContext('2d');
    
    const topicStats = {};
    history.forEach(h => {
        const topicKey = h.topic.trim();
        if (!topicStats[topicKey]) {
            topicStats[topicKey] = { totalPct: 0, count: 0 };
        }
        topicStats[topicKey].totalPct += (h.score / h.total_questions) * 100;
        topicStats[topicKey].count++;
    });
    const labels = Object.keys(topicStats);
    const dataValues = labels.map(topic => Math.round(topicStats[topic].totalPct / topicStats[topic].count));

    new Chart(pdfRadarCtx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: 'rgba(231, 111, 81, 0.2)',
                borderColor: 'rgba(231, 111, 81, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(231, 111, 81, 1)'
            }]
        },
        options: {
            responsive: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false },
                    pointLabels: { font: { size: 8, family: 'Inter' } }
                }
            }
        }
    });

    new Chart(pdfBarCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: 'rgba(42, 157, 143, 0.8)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100, ticks: { font: { size: 8, family: 'Inter' } } },
                x: { ticks: { font: { size: 8, family: 'Inter' } } }
            }
        }
    });

    setTimeout(() => {
        const opt = {
            margin: 10,
            filename: `${childName.replace(/\s+/g, '_')}_Progress_Report.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(pdfContainer).save().then(() => {
            document.body.removeChild(pdfContainer);
            showToast('PDF report downloaded successfully!', 'success');
        }).catch(err => {
            console.error(err);
            if (pdfContainer.parentNode) {
                document.body.removeChild(pdfContainer);
            }
            showToast('Failed to generate PDF.', 'error');
        });
    }, 450);
}

function renderParentCharts(topics) {
    if (!topics || topics.length === 0) return;

    const labels = topics.map(t => t.topic);
    const dataValues = topics.map(t => t.average);

    const colors = [
        'rgba(231, 111, 81, 0.8)',
        'rgba(42, 157, 143, 0.8)',
        'rgba(244, 162, 97, 0.8)',
        'rgba(38, 70, 83, 0.8)',
        'rgba(233, 196, 106, 0.8)',
        'rgba(131, 56, 236, 0.8)',
        'rgba(255, 0, 110, 0.8)',
        'rgba(58, 125, 68, 0.8)'
    ];
    const borderColors = colors.map(c => c.replace('0.8', '1'));

    // 1. Radar
    const radarCtx = document.getElementById('parent-child-radar-chart').getContext('2d');
    if (window.parentChildRadarChartInstance) {
        window.parentChildRadarChartInstance.destroy();
    }
    window.parentChildRadarChartInstance = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Topic Average Score (%)',
                data: dataValues,
                backgroundColor: 'rgba(231, 111, 81, 0.2)',
                borderColor: 'rgba(231, 111, 81, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(231, 111, 81, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                r: {
                    angleLines: { color: 'rgba(0,0,0,0.05)' },
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: { display: false },
                    pointLabels: {
                        color: '#6c757d',
                        font: { family: 'Inter', size: 9, weight: '600' }
                    }
                }
            }
        }
    });

    // 2. Bar
    const barCtx = document.getElementById('parent-child-bar-chart').getContext('2d');
    if (window.parentChildBarChartInstance) {
        window.parentChildBarChartInstance.destroy();
    }
    window.parentChildBarChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Topic Average Score (%)',
                data: dataValues,
                backgroundColor: colors.slice(0, topics.length),
                borderColor: borderColors.slice(0, topics.length),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: { color: '#6c757d', font: { family: 'Inter', size: 9 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#6c757d', font: { family: 'Inter', size: 9 } }
                }
            }
        }
    });

    // 3. Doughnut
    const doughnutCtx = document.getElementById('parent-child-doughnut-chart').getContext('2d');
    if (window.parentChildDoughnutChartInstance) {
        window.parentChildDoughnutChartInstance.destroy();
    }
    window.parentChildDoughnutChartInstance = new Chart(doughnutCtx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: colors.slice(0, topics.length),
                borderColor: borderColors.slice(0, topics.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#495057', font: { family: 'Inter', size: 9, weight: '500' } }
                }
            }
        }
    });
}

function renderChildAnalytics() {
    // 1. Render recent attempts table
    const recentBody = document.getElementById('parent-recent-tests-body');
    if (recentBody) {
        if (selectedChildQuizHistory.length === 0) {
            recentBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No quiz attempts recorded yet.</td></tr>`;
        } else {
            recentBody.innerHTML = selectedChildQuizHistory.slice(0, 5).map(h => {
                const date = h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN', {
                    month: 'short', day: 'numeric', year: 'numeric'
                }) : 'N/A';
                const scorePct = Math.round((h.score / h.total_questions) * 100);
                const scoreColor = scorePct >= 70 ? 'var(--secondary)' : 'var(--parent)';
                return `
                    <tr>
                        <td>${date}</td>
                        <td style="font-weight: 600; color: var(--text-primary);">${h.topic}</td>
                        <td><span class="status-badge" style="background: var(--bg-light); color: var(--text-primary); border: 1px solid rgba(0,0,0,0.08); text-transform: capitalize;">${h.difficulty}</span></td>
                        <td><strong style="color: ${scoreColor};">${h.score} / ${h.total_questions} (${scorePct}%)</strong></td>
                        <td>${h.total_questions} Qs</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 2. Render topic-wise averages table
    const perfBody = document.getElementById('parent-subject-performance-body');
    let topicsList = [];

    if (perfBody) {
        if (selectedChildQuizHistory.length === 0) {
            perfBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No performance data available.</td></tr>`;
        } else {
            // Group and compute statistics by topic
            const topicGroups = {};
            selectedChildQuizHistory.forEach(h => {
                if (!topicGroups[h.topic]) {
                    topicGroups[h.topic] = {
                        topic: h.topic,
                        difficulty: h.difficulty,
                        scores: [],
                        highest: 0,
                        last: 0,
                        lastDate: null
                    };
                }
                const scorePct = Math.round((h.score / h.total_questions) * 100);
                topicGroups[h.topic].scores.push(scorePct);
                if (scorePct > topicGroups[h.topic].highest) {
                    topicGroups[h.topic].highest = scorePct;
                }
                
                const attemptDate = h.created_at ? new Date(h.created_at) : new Date(0);
                if (!topicGroups[h.topic].lastDate || attemptDate > topicGroups[h.topic].lastDate) {
                    topicGroups[h.topic].lastDate = attemptDate;
                    topicGroups[h.topic].last = scorePct;
                }
            });

            const computedGroups = Object.values(topicGroups);
            topicsList = computedGroups.map(g => {
                const total = g.scores.reduce((a, b) => a + b, 0);
                return {
                    topic: g.topic,
                    average: Math.round(total / g.scores.length)
                };
            });

            perfBody.innerHTML = computedGroups.map(group => {
                const lastDateStr = group.lastDate && group.lastDate.getTime() > 0 ? group.lastDate.toLocaleDateString('en-IN', {
                    month: 'short', day: 'numeric'
                }) : 'N/A';
                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-primary);">${group.topic}</td>
                        <td style="text-transform: capitalize;">${group.difficulty}</td>
                        <td style="font-weight: 700; color: var(--secondary);">${group.highest}%</td>
                        <td style="font-weight: 700; color: ${group.last >= 70 ? 'var(--secondary)' : 'var(--parent)'};">${group.last}%</td>
                        <td style="font-size: 0.8rem; color: var(--text-secondary);">${lastDateStr}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Toggle child performance card visibility and draw Chart.js
    const perfCard = document.getElementById('parent-child-performance-card');
    if (perfCard) {
        if (selectedChildQuizHistory.length === 0) {
            perfCard.style.display = 'none';
        } else {
            perfCard.style.display = 'block';
            renderParentCharts(topicsList);

            // Hook up switcher buttons
            const btnRadar = document.getElementById('btn-parent-radar');
            const btnBar = document.getElementById('btn-parent-bar');
            const btnDoughnut = document.getElementById('btn-parent-doughnut');

            const wrapperRadar = document.getElementById('parent-child-radar-wrapper');
            const wrapperBar = document.getElementById('parent-child-bar-wrapper');
            const wrapperDoughnut = document.getElementById('parent-child-doughnut-wrapper');

            const tabs = [btnRadar, btnBar, btnDoughnut];
            const wrappers = [wrapperRadar, wrapperBar, wrapperDoughnut];

            function selectParentTab(activeBtn, activeWrapper) {
                tabs.forEach(btn => {
                    if (btn) {
                        btn.style.color = 'var(--text-secondary)';
                        btn.style.borderBottomColor = 'transparent';
                        btn.classList.remove('active');
                    }
                });
                wrappers.forEach(w => { if (w) w.style.display = 'none'; });

                if (activeBtn) {
                    activeBtn.style.color = 'var(--parent)';
                    activeBtn.style.borderBottomColor = 'var(--parent)';
                    activeBtn.classList.add('active');
                }
                if (activeWrapper) {
                    activeWrapper.style.display = 'block';
                }

                if (activeBtn === btnRadar && window.parentChildRadarChartInstance) {
                    window.parentChildRadarChartInstance.resize();
                    window.parentChildRadarChartInstance.update();
                }
                if (activeBtn === btnBar && window.parentChildBarChartInstance) {
                    window.parentChildBarChartInstance.resize();
                    window.parentChildBarChartInstance.update();
                }
                if (activeBtn === btnDoughnut && window.parentChildDoughnutChartInstance) {
                    window.parentChildDoughnutChartInstance.resize();
                    window.parentChildDoughnutChartInstance.update();
                }
            }

            if (btnRadar) btnRadar.onclick = () => selectParentTab(btnRadar, wrapperRadar);
            if (btnBar) btnBar.onclick = () => selectParentTab(btnBar, wrapperBar);
            if (btnDoughnut) btnDoughnut.onclick = () => selectParentTab(btnDoughnut, wrapperDoughnut);

            // Bind PDF download
            const btnDownload = document.getElementById('btn-download-parent-child-report');
            if (btnDownload) {
                btnDownload.onclick = downloadParentChildPDFReport;
            }
        }
    }

    // Update parent insights card headers
    const insightsCard = document.getElementById('child-ai-insights-card');
    if (insightsCard) {
        if (selectedChildQuizHistory.length === 0) {
            insightsCard.style.display = 'none';
        } else {
            insightsCard.style.display = 'block';
            
            // Calculate child overall average
            const totalScorePct = selectedChildQuizHistory.reduce((acc, q) => acc + (q.score / q.total_questions) * 100, 0);
            const overallAvg = Math.round(totalScorePct / selectedChildQuizHistory.length);
            document.getElementById('insights-child-average').textContent = `${overallAvg}%`;
            
            // Group by topic and find weakest topic
            const topicScores = {};
            selectedChildQuizHistory.forEach(q => {
                if (!topicScores[q.topic]) topicScores[q.topic] = [];
                topicScores[q.topic].push((q.score / q.total_questions) * 100);
            });
            
            let weakestTopic = '--';
            let lowestAvg = 101;
            for (const [topic, scores] of Object.entries(topicScores)) {
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                if (avg < lowestAvg) {
                    lowestAvg = avg;
                    weakestTopic = topic;
                }
            }
            
            document.getElementById('insights-child-weak-topic').textContent = weakestTopic;
            document.getElementById('parent-guide-output-box').style.display = 'none';
            document.getElementById('parent-guide-loader').style.display = 'none';
            currentParentGuide = null;
        }
    }
}

// Child switching listener
const selectChildEl = document.getElementById('parent-child-select');
if (selectChildEl) {
    selectChildEl.addEventListener('change', async (e) => {
        selectedChildEmail = e.target.value;
        await syncSelectedChildData();
    });
}

// Link Child Form Listener
const linkChildForm = document.getElementById('link-child-form');
if (linkChildForm) {
    linkChildForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('link-student-email');
        const email = emailInput.value.trim().toLowerCase();
        if (!email) return;

        try {
            const res = await fetch(`${API_BASE}/auth/parent/link-student`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ student_email: email })
            });
            const data = await res.json();
            if (res.ok) {
                showToast(`🎉 Linked child ${data.student.name}!`, 'success');
                emailInput.value = '';
                selectedChildEmail = email;
                await loadLinkedChildren();
            } else {
                showToast(data.detail || 'Failed to link child.', 'error');
            }
        } catch (err) {
            console.error('Error linking student:', err);
            showToast('Failed to link child.', 'error');
        }
    });
}

// Parenting tips generator
document.getElementById('tips-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedGrade = document.getElementById('tips-grade').value;
    const selectedSubject = document.getElementById('tips-subject').value;
    const selectedChapter = document.getElementById('tips-chapter').value;
    const concern = document.getElementById('parent-concern').value.trim();

    if (!selectedChapter) {
        showToast('Please select a chapter/topic.', 'warning');
        return;
    }

    document.getElementById('tips-loader').style.display = 'flex';
    document.getElementById('tips-output-box').style.display = 'none';

    const parentGoal = concern
        ? `Parent's concern: ${concern}. Provide actionable parenting tips to support the child at home.`
        : "Provide actionable tips for parents to help their child improve in the selected topic at home.";

    try {
        const res = await fetch(`${API_BASE}/ai/study-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
                subject: `Parenting Support: ${selectedSubject}`,
                grade: selectedGrade,
                weak_topics: [selectedChapter],
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

let currentParentGuide = null;

async function generateChildRevisionGuide(studentEmail) {
    if (!studentEmail) {
        showToast('Please select a child first.', 'warning');
        return;
    }
    
    const generateBtn = document.getElementById('generate-parent-guide-btn');
    const loader = document.getElementById('parent-guide-loader');
    const outputBox = document.getElementById('parent-guide-output-box');
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Generating Companion Guide...";
    loader.style.display = 'flex';
    outputBox.style.display = 'none';
    
    try {
        const res = await fetch(`${API_BASE}/ai/parent/child/${studentEmail}/revision-guide`, {
            method: 'GET',
            headers: authHeaders()
        });
        
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || 'Failed to generate revision guide.');
        }
        
        currentParentGuide = data;
        
        // Render Markdown content
        const viewport = document.getElementById('parent-guide-markdown-viewport');
        if (typeof marked !== 'undefined') {
            viewport.innerHTML = marked.parse(data.revision_guide);
        } else {
            viewport.textContent = data.revision_guide;
        }
        
        outputBox.style.display = 'block';
        outputBox.scrollIntoView({ behavior: 'smooth' });
        showToast('🎉 Home revision companion guide generated!', 'success');
        
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Error occurred while generating parent guide.', 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = "<i class='bx bx-magic-wand'></i> Generate Home Revision Guide";
        loader.style.display = 'none';
    }
}

function printParentRevisionGuide() {
    if (!currentParentGuide) {
        showToast('No revision guide available to print.', 'warning');
        return;
    }
    
    let html = `<h1>Home Study Companion & Revision Guide</h1>`;
    html += `<h3>Concept Focus: ${currentParentGuide.target_topic}</h3>`;
    html += `<p><strong>Child's Overall Quiz Average:</strong> ${currentParentGuide.overall_average}%</p>`;
    html += `<p><strong>Child's Revision Topic Average Score:</strong> ${currentParentGuide.target_topic_average}%</p>`;
    html += `<hr>`;
    
    if (typeof marked !== 'undefined') {
        html += marked.parse(currentParentGuide.revision_guide);
    } else {
        html += `<pre>${currentParentGuide.revision_guide}</pre>`;
    }
    
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Home Revision Guide - ${currentParentGuide.target_topic}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body{font-family:'Inter',sans-serif;padding:2.5rem;line-height:1.7;color:#2D3436;max-width:800px;margin:0 auto;}
        h1,h2,h3,h4{color:#1B2A4A}
        hr{border:none;border-top:1px solid #eee;margin:1.5rem 0}
        pre { background: #f8f9fa; padding: 1rem; border-radius: 6px; overflow-x: auto; }
        code { font-family: monospace; }
        ul, ol { padding-left: 1.5rem; }
    </style>
    </head><body>${html}</body></html>`);
    w.document.close();
    w.print();
}

/* ========================================
   PARENT ASSIGNMENTS TRACKER LOGIC
   ======================================== */
let selectedParentAssignmentClassCode = null;

async function loadChildClassroomsForAssignments() {
    const list = document.getElementById('parent-assignments-classroom-list');
    if (!list) return;
    
    if (!selectedChildEmail) {
        list.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-secondary);">Select a child first.</p>`;
        document.getElementById('parent-assignments-list-container').innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">Select a child to view classrooms.</p>`;
        return;
    }
    
    list.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-secondary);"><i class='bx bx-loader-alt bx-spin'></i> Loading classes...</p>`;
    
    try {
        const res = await fetch(`${API_BASE}/auth/parent/child/${selectedChildEmail}/classrooms`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const classrooms = await res.json();
        
        if (classrooms.length === 0) {
            list.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-secondary);">Child has not joined any classes yet.</p>`;
            document.getElementById('parent-assignments-list-container').innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">No classrooms available.</p>`;
        } else {
            list.innerHTML = classrooms.map(c => `
                <div class="selector-item-parent-asg" data-code="${c.class_code}" style="padding: 10px 12px; border-radius: 6px; background: var(--bg-light); border: 1px solid rgba(0,0,0,0.04); cursor: pointer; transition: all 0.2s; margin-bottom: 8px;" onclick="selectClassroomForParentAssignments('${c.class_code}', '${c.class_name.replace(/'/g, "\\'")}')">
                    <span style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary); display: block;">${c.class_name}</span>
                    <span style="font-size: 0.72rem; color: var(--text-secondary);">Teacher: ${c.teacher_name} | Code: ${c.class_code}</span>
                </div>
            `).join('');
            
            if (classrooms.length > 0) {
                selectClassroomForParentAssignments(classrooms[0].class_code, classrooms[0].class_name);
            }
        }
    } catch (err) {
        console.error('Failed to load child classrooms:', err);
        list.innerHTML = `<p style="font-size: 0.82rem; color: var(--parent);">Error loading classes.</p>`;
    }
}

async function selectClassroomForParentAssignments(classCode, className) {
    selectedParentAssignmentClassCode = classCode;
    
    const items = document.querySelectorAll('#parent-assignments-classroom-list .selector-item-parent-asg');
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

    const tabs = document.getElementById('parent-classroom-tabs');
    if (tabs) tabs.style.display = 'flex';

    const header = document.getElementById('parent-assignments-header-title');
    if (header) {
        header.style.display = 'block';
        header.innerHTML = `<i class='bx bx-task'></i> Assignments in ${className}`;
    }
    
    await loadParentClassroomAssignments(classCode);
    switchParentClassroomTab('assignments');
}

async function loadParentClassroomAssignments(classCode) {
    const container = document.getElementById('parent-assignments-list-container');
    container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);"><i class='bx bx-loader-alt bx-spin'></i> Loading assignments feed...</p>`;
    
    try {
        const res = await fetch(`${API_BASE}/assignments/classroom/${classCode}`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const assignments = await res.json();
        
        if (assignments.length === 0) {
            container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">No assignments published in this classroom yet.</p>`;
        } else {
            container.innerHTML = assignments.map(a => {
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
                
                let statusBadgeHtml = '';
                let submissionDetailsHtml = '';
                
                if (a.submission) {
                    if (a.submission.status === 'graded') {
                        statusBadgeHtml = `<span class="status-badge status-good">Graded (${a.submission.grade}/${a.max_marks})</span>`;
                        submissionDetailsHtml = `
                            <div style="margin-top: 10px; background: #fff; padding: 10px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.03); font-size: 0.85rem; line-height: 1.5;">
                                <strong style="color: var(--secondary);"><i class='bx bx-badge-check'></i> Grade: ${a.submission.grade} / ${a.max_marks}</strong>
                                <p style="margin-top: 4px; color: var(--text-secondary); font-style: italic;">Remarks: "${a.submission.teacher_remarks || 'None'}"</p>
                            </div>
                        `;
                    } else {
                        statusBadgeHtml = `<span class="status-badge" style="background: rgba(108,52,131,0.1); color: var(--ai-accent);">Submitted</span>`;
                        submissionDetailsHtml = `<span style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px; display: block;">Waiting for teacher's grade evaluation.</span>`;
                    }
                } else {
                    const isOverdue = new Date() > new Date(a.due_date);
                    if (isOverdue) {
                        statusBadgeHtml = `<span class="status-badge status-struggling">Overdue (Unsubmitted)</span>`;
                    } else {
                        statusBadgeHtml = `<span class="status-badge" style="background: rgba(42, 157, 143, 0.1); color: var(--secondary);">Assigned (Pending)</span>`;
                    }
                }
                
                return `
                    <div style="background: var(--bg-light); padding: 1.2rem; border-radius: 8px; border: 1px solid rgba(0,0,0,0.04); display: flex; flex-direction: column; align-items: stretch; margin-bottom: 12px;">
                        <div style="display: flex; gap: 1rem; align-items: start; justify-content: space-between;">
                            <div style="display: flex; gap: 1rem; align-items: start;">
                                <div style="background: ${iconBg}; color: #fff; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
                                    <i class='bx ${iconClass}'></i>
                                </div>
                                <div>
                                    <h4 style="font-weight: 700; color: var(--text-primary); font-size: 0.98rem; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
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
                        </div>
                        ${submissionDetailsHtml}
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error(err);
        container.innerHTML = `<p style="font-size: 0.85rem; color: var(--parent);">Error loading classroom assignments feed.</p>`;
    }
}

// Make functions globally accessible
window.selectClassroomForParentAssignments = selectClassroomForParentAssignments;
window.loadChildClassroomsForAssignments = loadChildClassroomsForAssignments;

// Load everything on DOM load & hook listeners
window.addEventListener('DOMContentLoaded', async () => {
    await loadLinkedChildren();
    await loadParentNotifications();

    // Setup syllabus selectors for AI Parenting Advice
    const tipsGrade = document.getElementById('tips-grade');
    const tipsSubject = document.getElementById('tips-subject');
    if (tipsGrade) {
        tipsGrade.addEventListener('change', () => {
            loadSyllabusSubjects('tips-grade', 'tips-subject', 'tips-chapter');
        });
    }
    if (tipsSubject) {
        tipsSubject.addEventListener('change', () => {
            loadSyllabusChapters('tips-grade', 'tips-subject', 'tips-chapter');
        });
    }
    
    const genBtn = document.getElementById('generate-parent-guide-btn');
    if (genBtn) {
        genBtn.addEventListener('click', () => {
            generateChildRevisionGuide(selectedChildEmail);
        });
    }
    
    const prtBtn = document.getElementById('print-parent-guide-btn');
    if (prtBtn) {
        prtBtn.addEventListener('click', () => {
            printParentRevisionGuide();
        });
    }

    const chatForm = document.getElementById('chat-send-form');
    if (chatForm) {
        chatForm.addEventListener('submit', sendChatMessage);
    }
});

/* ========================================
   DIRECT MESSAGES (CHAT) SYSTEM
   ======================================== */
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
                <div class="chat-contact-avatar" style="background-color: var(--teacher);">${c.name.charAt(0).toUpperCase()}</div>
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
    
    // Set custom avatar class or style based on role
    const avatarEl = document.getElementById('active-chat-avatar');
    avatarEl.textContent = contactName.charAt(0).toUpperCase();
    avatarEl.style.backgroundColor = 'var(--teacher)';
    
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
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
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

window.selectChatContact = selectChatContact;

/* ========================================
   CLASSROOM STREAM, LEADERBOARD & NOTIFICATIONS
   ======================================== */
function switchParentClassroomTab(tabName) {
    document.getElementById('parent-class-tab-assignments').style.display = tabName === 'assignments' ? 'block' : 'none';
    document.getElementById('parent-class-tab-stream').style.display = tabName === 'stream' ? 'block' : 'none';
    document.getElementById('parent-class-tab-leaderboard').style.display = tabName === 'leaderboard' ? 'block' : 'none';
    
    document.getElementById('tab-btn-parent-assignments').classList.toggle('active', tabName === 'assignments');
    document.getElementById('tab-btn-parent-stream').classList.toggle('active', tabName === 'stream');
    document.getElementById('tab-btn-parent-leaderboard').classList.toggle('active', tabName === 'leaderboard');
    
    if (tabName === 'stream' && selectedParentAssignmentClassCode) {
        loadParentClassroomAnnouncements(selectedParentAssignmentClassCode);
    } else if (tabName === 'leaderboard' && selectedParentAssignmentClassCode) {
        loadParentClassroomLeaderboard(selectedParentAssignmentClassCode);
    }
}

async function loadParentClassroomAnnouncements(classCode) {
    const feed = document.getElementById('parent-announcements-feed');
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
                        <button class="btn btn-secondary btn-sm" onclick="likeParentAnnouncement('${classCode}', '${ann.id}')" style="padding: 4px 8px; font-size: 0.75rem; background: ${isLiked ? 'rgba(42,157,143,0.1)' : 'transparent'}; color: ${isLiked ? 'var(--secondary)' : 'var(--text-secondary)'}; border: none;">
                            <i class='bx ${isLiked ? 'bxs-heart' : 'bx-heart'}'></i> Like (${ann.likes.length})
                        </button>
                    </div>
                    
                    <!-- Comments Section -->
                    <div style="margin-top: 12px; background: rgba(0,0,0,0.01); padding: 10px; border-radius: 6px;">
                        <div id="parent-comments-list-${ann.id}" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
                            ${ann.comments.length === 0 ? `<p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">No comments yet.</p>` : ann.comments.map(c => `
                                <div style="font-size: 0.8rem; line-height: 1.4; border-bottom: 1px dashed rgba(0,0,0,0.02); padding-bottom: 4px; margin-bottom: 4px;">
                                    <strong style="color: var(--primary);">${c.user_name} (${c.user_role}):</strong>
                                    <span style="color: var(--text-primary);">${c.content}</span>
                                </div>
                            `).join('')}
                        </div>
                        <form onsubmit="postParentAnnouncementComment(event, '${classCode}', '${ann.id}')" style="display: flex; gap: 6px;">
                            <input type="text" placeholder="Add a comment..." class="form-input-db btn-sm" required style="font-size: 0.75rem; padding: 4px 8px; flex-grow: 1;">
                            <button type="submit" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.75rem;">Reply</button>
                        </form>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        feed.innerHTML = `<p style="font-size: 0.85rem; color: var(--parent);">Failed to load announcements.</p>`;
    }
}

async function likeParentAnnouncement(classCode, announcementId) {
    try {
        const res = await fetch(`${API_BASE}/classrooms/${classCode}/announcements/${announcementId}/like`, {
            method: 'POST',
            headers: authHeaders()
        });
        if (res.ok) {
            await loadParentClassroomAnnouncements(classCode);
        }
    } catch (err) {
        console.error(err);
    }
}

async function postParentAnnouncementComment(e, classCode, announcementId) {
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
            await loadParentClassroomAnnouncements(classCode);
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadParentClassroomLeaderboard(classCode) {
    const tbody = document.getElementById('parent-class-leaderboard-body');
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
            const isMyChild = student.email === selectedChildEmail;
            return `
                <tr style="background: ${isMyChild ? 'rgba(231,111,81,0.05)' : 'transparent'}; font-weight: ${isMyChild ? '700' : '400'}; border-left: 3px solid ${isMyChild ? 'var(--parent)' : 'transparent'};">
                    <td style="color: var(--secondary); font-size: 0.95rem; font-weight: 700;">
                        ${student.rank === 1 ? '🥇 1' : student.rank === 2 ? '🥈 2' : student.rank === 3 ? '🥉 3' : student.rank}
                    </td>
                    <td style="color: var(--text-primary);">${student.name} ${isMyChild ? '<strong>(Your Child)</strong>' : ''}</td>
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

async function loadParentNotifications() {
    const feed = document.getElementById('parent-alerts-feed');
    if (!feed) return;
    
    try {
        const res = await fetch(`${API_BASE}/classrooms/notifications`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const notifications = await res.json();
        
        if (notifications.length === 0) {
            feed.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-secondary); text-align: center; margin-top: 1rem;">No recent notifications.</p>`;
            return;
        }
        
        feed.innerHTML = notifications.map(notif => {
            const date = new Date(notif.created_at).toLocaleDateString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const isUnread = !notif.read;
            
            let iconClass = 'bx-bell';
            let iconBg = 'rgba(0, 0, 0, 0.05)';
            let iconColor = 'var(--text-secondary)';
            
            if (notif.type === 'assignment_created') {
                iconClass = 'bx-task';
                iconBg = 'rgba(42, 157, 143, 0.1)';
                iconColor = 'var(--secondary)';
            } else if (notif.type === 'assignment_graded') {
                iconClass = 'bx-badge-check';
                iconBg = 'rgba(42, 157, 143, 0.1)';
                iconColor = 'var(--secondary)';
            } else if (notif.type === 'announcement_created') {
                iconClass = 'bx-news';
                iconBg = 'rgba(231, 111, 81, 0.1)';
                iconColor = 'var(--parent)';
            }
            
            return `
                <div class="feed-item" style="border-left: 3px solid ${isUnread ? 'var(--parent)' : 'transparent'}; background: ${isUnread ? 'rgba(231,111,81,0.01)' : 'transparent'}; position: relative; cursor: pointer; display: flex; align-items: flex-start; gap: 10px; padding: 10px 15px; border-bottom: 1px solid rgba(0,0,0,0.02);" onclick="markParentNotificationRead('${notif.id}')">
                    <div class="feed-item-icon" style="background-color: ${iconBg}; color: ${iconColor}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
                        <i class='bx ${iconClass}'></i>
                    </div>
                    <div class="feed-item-details" style="flex-grow: 1;">
                        <div class="feed-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                            <span class="feed-item-title" style="font-weight: ${isUnread ? '700' : '600'}; font-size: 0.85rem; color: var(--text-primary);">${notif.title}</span>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span class="feed-item-time" style="font-size: 0.72rem; color: var(--text-secondary);">${date}</span>
                                <button onclick="deleteParentNotificationItem(event, '${notif.id}')" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0 4px; margin-left: 2px;" title="Delete Alert">&times;</button>
                            </div>
                        </div>
                        <p class="feed-item-body" style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">${notif.content}</p>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        feed.innerHTML = `<p style="font-size: 0.82rem; color: var(--parent); text-align: center; margin-top: 1rem;">Failed to load alerts feed.</p>`;
    }
}

async function markParentNotificationRead(notificationId) {
    try {
        const res = await fetch(`${API_BASE}/classrooms/notifications/${notificationId}/read`, {
            method: 'POST',
            headers: authHeaders()
        });
        if (res.ok) {
            await loadParentNotifications();
        }
    } catch (err) {
        console.error(err);
    }
}

window.switchParentClassroomTab = switchParentClassroomTab;
window.loadParentClassroomAnnouncements = loadParentClassroomAnnouncements;
window.likeParentAnnouncement = likeParentAnnouncement;
window.postParentAnnouncementComment = postParentAnnouncementComment;
window.loadParentClassroomLeaderboard = loadParentClassroomLeaderboard;
async function clearParentNotifications() {
    if (!confirm('Are you sure you want to clear all notifications?')) return;
    try {
        const res = await fetch(`${API_BASE}/classrooms/notifications`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (res.ok) {
            showToast('Notifications cleared.', 'success');
            await loadParentNotifications();
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to clear notifications.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error clearing notifications.', 'error');
    }
}

async function deleteParentNotificationItem(e, notificationId) {
    e.stopPropagation();
    try {
        const res = await fetch(`${API_BASE}/classrooms/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (res.ok) {
            showToast('Notification deleted.', 'success');
            await loadParentNotifications();
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to delete notification.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error deleting notification.', 'error');
    }
}

window.loadParentNotifications = loadParentNotifications;
window.markParentNotificationRead = markParentNotificationRead;
window.clearParentNotifications = clearParentNotifications;
window.deleteParentNotificationItem = deleteParentNotificationItem;

async function initProfilePanel() {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Fill form fields
    document.getElementById('profile-input-name').value = storedUser.name || '';
    document.getElementById('profile-input-email').value = storedUser.email || '';
    document.getElementById('profile-input-phone').value = storedUser.phone || '';
    document.getElementById('profile-input-bio').value = storedUser.bio || '';
    document.getElementById('profile-input-relationship').value = storedUser.relationship || '';

    // Render profile picture
    const placeholderEl = document.getElementById('profile-pic-placeholder');
    const imgEl = document.getElementById('profile-pic-preview-img');
    
    if (storedUser.profile_pic) {
        imgEl.src = storedUser.profile_pic.startsWith('http') ? storedUser.profile_pic : BACKEND_URL + storedUser.profile_pic;
        imgEl.style.display = 'block';
        placeholderEl.style.display = 'none';
    } else {
        placeholderEl.textContent = (storedUser.name || 'P').charAt(0).toUpperCase();
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
            const relationship = document.getElementById('profile-input-relationship').value;
            
            try {
                const res = await fetch(`${API_BASE}/auth/profile`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, phone, bio, relationship })
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
    const studentsList = document.getElementById('profile-students-list');
    const teachersList = document.getElementById('profile-teachers-list');
    
    if (!studentsList || !teachersList) return;
    
    studentsList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;"><i class='bx bx-loader-alt bx-spin'></i> Loading connections...</p>`;
    teachersList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;"><i class='bx bx-loader-alt bx-spin'></i> Loading connections...</p>`;
    
    try {
        const res = await fetch(`${API_BASE}/auth/profile/connections`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        // Render Children
        if (!data.students || data.students.length === 0) {
            studentsList.innerHTML = `<div style="font-size: 0.88rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;">No children linked. Link a child from the Overview to connect.</div>`;
        } else {
            studentsList.innerHTML = data.students.map(s => {
                const initial = s.name.charAt(0).toUpperCase();
                const avatarHtml = s.profile_pic 
                    ? `<img src="${s.profile_pic.startsWith('http') ? s.profile_pic : BACKEND_URL + s.profile_pic}" alt="Avatar">`
                    : initial;
                const grade = s.grade || 'Student';
                return `
                    <div class="connection-card">
                        <div class="connection-avatar">${avatarHtml}</div>
                        <div class="connection-info">
                            <span class="connection-name">${s.name}</span>
                            <span class="connection-detail"><i class='bx bx-envelope'></i> ${s.email}</span>
                            ${s.school ? `<span class="connection-detail"><i class='bx bx-home'></i> School: ${s.school}</span>` : ''}
                            ${s.phone ? `<span class="connection-detail"><i class='bx bx-phone'></i> ${s.phone}</span>` : ''}
                        </div>
                        <span class="connection-badge student">${grade}</span>
                    </div>
                `;
            }).join('');
        }
        
        // Render Teachers
        if (!data.teachers || data.teachers.length === 0) {
            teachersList.innerHTML = `<div style="font-size: 0.88rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;">No classroom teachers found. Connects automatically when your child joins a class.</div>`;
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
                            <span class="connection-detail"><i class='bx bx-smile'></i> Child Linked: ${t.student_name}</span>
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
        studentsList.innerHTML = `<div style="font-size: 0.85rem; color: var(--parent); text-align: center; padding: 1rem 0;">Error loading children list.</div>`;
        teachersList.innerHTML = `<div style="font-size: 0.85rem; color: var(--parent); text-align: center; padding: 1rem 0;">Error loading teachers list.</div>`;
    }
}

window.initProfilePanel = initProfilePanel;

