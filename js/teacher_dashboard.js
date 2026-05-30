/* ========================================
   EduFlow AI — Teacher Dashboard Logic
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

if (!token || !user || user.role !== 'teacher') {
    alert('Please login as a Teacher to access this dashboard.');
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
        
        document.getElementById('profile-name').textContent = updatedUser.name || 'Teacher';
        const avatarEl = document.getElementById('profile-avatar');
        if (updatedUser.profile_pic) {
            avatarEl.innerHTML = `<img src="${updatedUser.profile_pic.startsWith('http') ? updatedUser.profile_pic : BACKEND_URL + updatedUser.profile_pic}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            avatarEl.textContent = (updatedUser.name || 'T').charAt(0).toUpperCase();
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
    'overview-panel': { title: 'Teacher Dashboard', sub: 'Manage your classes and track student progress.' },
    'quiz-gen-panel': { title: 'Create AI Quiz', sub: 'Generate MCQ tests for your students using AI.' },
    'students-panel': { title: 'Student Performance', sub: 'View detailed performance reports of each student.' },
    'assignments-panel': { title: 'Assignments Hub', sub: 'Create, distribute, and grade assignments (Manual, AI, or Links).' },
    'alerts-panel': { title: 'Smart Alerts', sub: 'AI-generated alerts about students who need attention.' },
    'chat-panel': { title: 'Direct Messages', sub: 'Communicate with students and parents.' },
    'profile-panel': { title: 'My Profile', sub: 'Manage your settings, update professional details, and view linked connections.' }
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
   TEACHER QUIZ GENERATOR
   ======================================== */
let generatedQuiz = null;

document.getElementById('teacher-quiz-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const topicSelect = document.getElementById('tq-chapter');
    const topic = topicSelect ? topicSelect.value : '';
    if (!topic) {
        showToast('Please select a quiz chapter.', 'warning');
        return;
    }
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

/* ========================================
   CLASSROOM PLANNER & STUDENT TRACKER
   ======================================== */
let selectedClassCode = null;
let currentStudentsList = [];

async function loadTeacherClassrooms() {
    try {
        const res = await fetch(`${API_BASE}/auth/teacher/classrooms`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const classrooms = await res.json();

        // 1. Render in Overview My Classrooms list
        const overviewList = document.getElementById('teacher-classrooms-list');
        if (overviewList) {
            if (classrooms.length === 0) {
                overviewList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">No classrooms created yet.</p>`;
            } else {
                overviewList.innerHTML = classrooms.map(c => `
                    <div style="background: var(--bg-light); padding: 1rem; border-radius: 8px; border: 1px solid rgba(0,0,0,0.05); position: relative;">
                        <h4 style="font-weight: 700; color: var(--text-primary); font-size: 0.95rem; margin-bottom: 4px;">${c.class_name}</h4>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                            <span style="font-size: 0.72rem; color: var(--text-secondary);">${c.students_count} students</span>
                            <span class="status-badge" style="font-size: 0.7rem; background: var(--secondary); color: #fff; padding: 2px 8px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;" onclick="navigator.clipboard.writeText('${c.class_code}').then(() => showToast('Class code copied!', 'success'))" title="Click to copy">
                                ${c.class_code} <i class='bx bx-copy' style="font-size: 0.8rem;"></i>
                            </span>
                        </div>
                    </div>
                `).join('');
            }
        }

        // 2. Render in Students Tab Classroom Selector
        const selector = document.getElementById('students-classroom-selector');
        if (selector) {
            if (classrooms.length === 0) {
                selector.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">Create a classroom first.</p>`;
            } else {
                selector.innerHTML = classrooms.map(c => `
                    <div class="selector-item" data-code="${c.class_code}" style="padding: 10px 12px; border-radius: 6px; background: var(--bg-light); border: 1px solid rgba(0,0,0,0.04); cursor: pointer; transition: all 0.2s;" onclick="selectClassroomForStudents('${c.class_code}', '${c.class_name}')">
                        <span style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary); display: block;">${c.class_name}</span>
                        <span style="font-size: 0.72rem; color: var(--text-secondary);">${c.students_count} students | Code: ${c.class_code}</span>
                    </div>
                `).join('');
            }
        }

        // 3. Render in Assignments Tab Classroom Selector
        const asgSelector = document.getElementById('assignments-classroom-selector');
        if (asgSelector) {
            if (classrooms.length === 0) {
                asgSelector.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">Create a classroom first.</p>`;
            } else {
                asgSelector.innerHTML = classrooms.map(c => `
                    <div class="selector-item-asg" data-code="${c.class_code}" style="padding: 10px 12px; border-radius: 6px; background: var(--bg-light); border: 1px solid rgba(0,0,0,0.04); cursor: pointer; transition: all 0.2s; margin-bottom: 8px;" onclick="selectClassroomForAssignments('${c.class_code}', '${c.class_name}')">
                        <span style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary); display: block;">${c.class_name}</span>
                        <span style="font-size: 0.72rem; color: var(--text-secondary);">${c.students_count} students | Code: ${c.class_code}</span>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load teacher classrooms:', err);
    }
}

function renderFilteredAndSortedStudents() {
    const tableBody = document.getElementById('classroom-students-table-body');
    if (!tableBody) return;
    
    if (!currentStudentsList || currentStudentsList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No students have joined this classroom yet. Share the code <strong>${selectedClassCode}</strong> with them!</td></tr>`;
        const insightsCard = document.getElementById('classroom-ai-insights-card');
        if (insightsCard) insightsCard.style.display = 'none';
        return;
    }
    
    const searchVal = (document.getElementById('student-search-input')?.value || '').toLowerCase().trim();
    const sortVal = document.getElementById('student-sort-select')?.value || 'xp-desc';
    
    // Filter
    let filtered = [...currentStudentsList];
    if (searchVal) {
        const normalizedSearchVal = searchVal.replace(/[^\d+]/g, '');
        filtered = filtered.filter(s => {
            const matchesNameOrEmail = (s.name || '').toLowerCase().includes(searchVal) ||
                                       (s.email || '').toLowerCase().includes(searchVal);
            
            const sPhoneClean = (s.phone || '').replace(/[^\d+]/g, '');
            const matchesPhone = sPhoneClean && normalizedSearchVal && sPhoneClean.includes(normalizedSearchVal);
            
            return matchesNameOrEmail || matchesPhone;
        });
    }
    
    // Sort
    filtered.sort((a, b) => {
        if (sortVal === 'xp-desc') {
            return (b.xp || 0) - (a.xp || 0);
        } else if (sortVal === 'xp-asc') {
            return (a.xp || 0) - (b.xp || 0);
        } else if (sortVal === 'name-asc') {
            return (a.name || '').localeCompare(b.name || '');
        } else if (sortVal === 'name-desc') {
            return (b.name || '').localeCompare(a.name || '');
        }
        return 0;
    });
    
    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No students match search criteria.</td></tr>`;
        return;
    }
    
    tableBody.innerHTML = filtered.map(s => `
        <tr>
            <td style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${s.name}</td>
            <td style="font-size: 0.85rem; color: var(--text-secondary);">${s.email}</td>
            <td style="font-size: 0.85rem; color: var(--text-secondary);">${s.phone || 'N/A'}</td>
            <td style="font-weight: 700; color: var(--secondary); font-size: 0.9rem;">${s.xp} XP</td>
            <td><span class="status-badge" style="background: var(--primary); color: #fff; font-size: 0.72rem; padding: 2px 8px;">Lvl ${s.level}</span></td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.78rem;" onclick="viewStudentDetails('${s.email}')">
                        <i class='bx bx-bar-chart-alt-2'></i> Stats
                    </button>
                    ${s.parent ? `
                        <button class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.78rem; background: rgba(231,111,81,0.08); color: var(--parent); border: 1px solid rgba(231,111,81,0.15); display: inline-flex; align-items: center; gap: 4px;" onclick="messageParent('${s.parent.id}', '${s.parent.name.replace(/'/g, "\\'")}')">
                            <i class='bx bx-message-rounded-detail'></i> Message Parent
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function messageParent(parentId, parentName) {
    const chatMenuItem = document.querySelector('.menu-item[data-panel="chat-panel"]');
    if (chatMenuItem) {
        chatMenuItem.click();
    }
    
    setTimeout(() => {
        const contactEl = document.getElementById(`chat-contact-${parentId}`);
        if (contactEl) {
            contactEl.click();
        } else {
            if (typeof selectChatContact === 'function') {
                selectChatContact(parentId, parentName, 'parent');
            }
        }
    }, 300);
}

async function selectClassroomForStudents(classCode, className) {
    selectedClassCode = classCode;
    
    // Style active selector item
    const items = document.querySelectorAll('#students-classroom-selector .selector-item');
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

    document.getElementById('selected-class-title').innerHTML = `<i class='bx bx-group'></i> Students in ${className}`;
    document.getElementById('classroom-students-card').style.display = 'block';
    document.getElementById('student-detail-card').style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/auth/teacher/classroom/${classCode}/students`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const students = await res.json();
        currentStudentsList = students;

        // Reset search/sort UI inputs
        const searchInput = document.getElementById('student-search-input');
        if (searchInput) searchInput.value = '';
        const sortSelect = document.getElementById('student-sort-select');
        if (sortSelect) sortSelect.value = 'xp-desc';

        // Render filtered/sorted table body
        renderFilteredAndSortedStudents();

        if (students.length > 0) {
            // Show AI Insights and reset its state
            document.getElementById('classroom-ai-insights-card').style.display = 'block';
            document.getElementById('insights-class-average').textContent = '--';
            document.getElementById('insights-weak-topic').textContent = '--';
            document.getElementById('struggling-students-box').style.display = 'none';
            document.getElementById('lesson-plan-output-box').style.display = 'none';
            document.getElementById('lesson-plan-loader').style.display = 'none';
            currentLessonPlan = null;
        }
    } catch (err) {
        console.error('Failed to fetch classroom students:', err);
        showToast('Failed to load students list.', 'error');
    }
}

window.teacherProgressLineChartInstance = null;
window.teacherTopicBarChartInstance = null;
window.teacherActiveStudentInfo = null;
window.teacherActiveStudentHistory = [];

async function downloadTeacherStudentPDFReport() {
    if (!window.teacherActiveStudentInfo) {
        showToast('No student details selected.', 'warning');
        return;
    }
    
    const info = window.teacherActiveStudentInfo;
    const history = window.teacherActiveStudentHistory || [];
    
    if (history.length === 0) {
        showToast('No quiz history found for this student to generate PDF report.', 'warning');
        return;
    }
    
    showToast('Compiling student report card...', 'info');
    
    const pdfContainer = document.createElement('div');
    pdfContainer.style.padding = '35px';
    pdfContainer.style.fontFamily = "'Inter', sans-serif";
    pdfContainer.style.color = '#333';
    pdfContainer.style.backgroundColor = '#fff';
    pdfContainer.style.width = '750px';
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.top = '-9999px';
    
    let content = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #6c5ce7; padding-bottom: 15px; margin-bottom: 25px;">
            <div>
                <h1 style="margin: 0; color: #6c5ce7; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">EduFlow AI</h1>
                <p style="margin: 3px 0 0 0; font-size: 13px; color: #666; font-weight: 500;">Academic Progress Report Card (Teacher Panel)</p>
            </div>
            <div style="text-align: right;">
                <span style="font-size: 10px; color: #999; font-weight: 600; text-transform: uppercase;">Generated On</span>
                <p style="margin: 3px 0 0 0; font-size: 13px; color: #333; font-weight: 600;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 25px;">
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef;">
                <h3 style="margin: 0 0 10px 0; font-size: 13px; color: #6c5ce7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Student Information</h3>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 4px 0; color: #666; font-weight: 500; width: 80px;">Name:</td>
                        <td style="padding: 4px 0; color: #333; font-weight: 600;">${info.name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 4px 0; color: #666; font-weight: 500;">Email:</td>
                        <td style="padding: 4px 0; color: #333; font-weight: 600;">${info.email}</td>
                    </tr>
                </table>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                <span style="font-size: 9px; color: #666; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Total XP Points</span>
                <p style="margin: 0; font-size: 20px; font-weight: 800; color: #2a9d8f;">${info.xp}</p>
                <span style="font-size: 11px; font-weight: 700; color: #6c5ce7; margin-top: 4px;">${info.level}</span>
            </div>
        </div>
        
        <div style="margin-bottom: 25px;">
            <h3 style="margin: 0 0 12px 0; font-size: 13px; color: #6c5ce7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Quiz Attempt History Timeline</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #dee2e6;">
                <thead>
                    <tr style="background-color: #f1f3f5; border-bottom: 2px solid #dee2e6;">
                        <th style="padding: 10px; text-align: left; font-weight: 700; color: #495057;">Topic / Chapter</th>
                        <th style="padding: 10px; text-align: center; font-weight: 700; color: #495057; width: 100px;">Difficulty</th>
                        <th style="padding: 10px; text-align: center; font-weight: 700; color: #495057; width: 150px;">Date & Time</th>
                        <th style="padding: 10px; text-align: center; font-weight: 700; color: #495057; width: 100px;">Score</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    history.forEach(h => {
        const date = h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN', {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '';
        const isGood = (h.score / h.total_questions) >= 0.7;
        
        content += `
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 10px; color: #212529; font-weight: 600;">${h.topic}</td>
                <td style="padding: 10px; text-align: center; text-transform: capitalize; color: #495057;">${h.difficulty}</td>
                <td style="padding: 10px; text-align: center; color: #6c757d;">${date}</td>
                <td style="padding: 10px; text-align: center; font-weight: 700; color: ${isGood ? '#2a9d8f' : '#e76f51'};">
                    ${h.score} / ${h.total_questions}
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
            <h3 style="margin: 0 0 15px 0; font-size: 13px; color: #6c5ce7; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Performance Visualizations</h3>
            <div style="display: flex; gap: 20px; justify-content: center; align-items: center;">
                <div style="width: 320px; height: 260px; position: relative;">
                    <h4 style="font-size: 11px; text-align: center; margin: 0 0 8px 0; color: #666; font-weight: 600;">Quiz-by-Quiz Score Progression</h4>
                    <canvas id="pdf-teacher-line-chart" style="width: 100%; height: 100%;"></canvas>
                </div>
                <div style="width: 320px; height: 260px; position: relative;">
                    <h4 style="font-size: 11px; text-align: center; margin: 0 0 8px 0; color: #666; font-weight: 600;">Average Score by Topic</h4>
                    <canvas id="pdf-teacher-bar-chart" style="width: 100%; height: 100%;"></canvas>
                </div>
            </div>
        </div>
        
        <div style="border-top: 1px dashed #ced4da; padding-top: 15px; text-align: center; font-size: 11px; color: #6c757d; margin-top: 35px;">
            <p style="margin: 0;">This report card is generated on behalf of the teaching staff via the EduFlow AI Platform.</p>
        </div>
    `;
    
    pdfContainer.innerHTML = content;
    document.body.appendChild(pdfContainer);
    
    // Draw charts on PDF containers
    const pdfLineCtx = document.getElementById('pdf-teacher-line-chart').getContext('2d');
    const pdfBarCtx = document.getElementById('pdf-teacher-bar-chart').getContext('2d');
    
    const chronologicalHistory = [...history].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const lineLabels = chronologicalHistory.map((h, i) => {
        return h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : `Q${i+1}`;
    });
    const lineData = chronologicalHistory.map(h => Math.round((h.score / h.total_questions) * 100));

    const topicStats = {};
    history.forEach(h => {
        const topicKey = h.topic.trim();
        if (!topicStats[topicKey]) {
            topicStats[topicKey] = { totalPct: 0, count: 0 };
        }
        topicStats[topicKey].totalPct += (h.score / h.total_questions) * 100;
        topicStats[topicKey].count++;
    });
    const barLabels = Object.keys(topicStats);
    const barData = barLabels.map(topic => Math.round(topicStats[topic].totalPct / topicStats[topic].count));

    new Chart(pdfLineCtx, {
        type: 'line',
        data: {
            labels: lineLabels,
            datasets: [{
                data: lineData,
                borderColor: 'rgba(108, 92, 231, 1)',
                backgroundColor: 'rgba(108, 92, 231, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointRadius: 3
            }]
        },
        options: {
            responsive: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100, ticks: { font: { size: 8, family: 'Inter' } } },
                x: { ticks: { font: { size: 7, family: 'Inter' } } }
            }
        }
    });

    new Chart(pdfBarCtx, {
        type: 'bar',
        data: {
            labels: barLabels,
            datasets: [{
                data: barData,
                backgroundColor: 'rgba(235, 77, 75, 0.8)',
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
            filename: `${info.name.replace(/\s+/g, '_')}_Progress_Report.pdf`,
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

function renderTeacherStudentCharts(history) {
    if (!history || history.length === 0) return;

    const chronologicalHistory = [...history].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const lineLabels = chronologicalHistory.map((h, i) => {
        return h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : `Quiz ${i+1}`;
    });
    const lineData = chronologicalHistory.map(h => Math.round((h.score / h.total_questions) * 100));

    const topicStats = {};
    history.forEach(h => {
        const topicKey = h.topic.trim();
        if (!topicStats[topicKey]) {
            topicStats[topicKey] = { totalPct: 0, count: 0 };
        }
        topicStats[topicKey].totalPct += (h.score / h.total_questions) * 100;
        topicStats[topicKey].count++;
    });
    const barLabels = Object.keys(topicStats);
    const barData = barLabels.map(topic => Math.round(topicStats[topic].totalPct / topicStats[topic].count));

    // 1. Line Chart
    const lineCtx = document.getElementById('teacher-student-progress-line-chart').getContext('2d');
    if (window.teacherProgressLineChartInstance) {
        window.teacherProgressLineChartInstance.destroy();
    }
    window.teacherProgressLineChartInstance = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: lineLabels,
            datasets: [{
                label: 'Quiz Score (%)',
                data: lineData,
                borderColor: 'rgba(108, 92, 231, 1)',
                backgroundColor: 'rgba(108, 92, 231, 0.1)',
                borderWidth: 2.5,
                tension: 0.35,
                fill: true,
                pointBackgroundColor: 'rgba(108, 92, 231, 1)',
                pointRadius: 4
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

    // 2. Bar Chart
    const barCtx = document.getElementById('teacher-student-topic-bar-chart').getContext('2d');
    if (window.teacherTopicBarChartInstance) {
        window.teacherTopicBarChartInstance.destroy();
    }
    window.teacherTopicBarChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: barLabels,
            datasets: [{
                label: 'Topic Average (%)',
                data: barData,
                backgroundColor: 'rgba(235, 77, 75, 0.8)',
                borderColor: 'rgba(235, 77, 75, 1)',
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
}

async function viewStudentDetails(studentEmail) {
    const student = currentStudentsList.find(s => s.email === studentEmail);
    if (!student) return;

    window.teacherActiveStudentInfo = student;
    window.teacherActiveStudentHistory = [];

    document.getElementById('detail-student-name').textContent = student.name;
    document.getElementById('detail-student-email').textContent = student.email;
    document.getElementById('detail-student-xp').textContent = `${student.xp} XP`;
    document.getElementById('detail-student-level').textContent = `Lvl ${student.level}`;
    document.getElementById('detail-student-doubts').textContent = student.doubts_count || 0;
    document.getElementById('detail-student-plans').textContent = student.plans_count || 0;

    // Badges
    const badgesContainer = document.getElementById('detail-student-badges');
    if (student.badges && student.badges.length > 0) {
        badgesContainer.innerHTML = student.badges.map(b => `
            <span class="status-badge" style="background: rgba(255, 176, 32, 0.15); color: #B37D00; border: 1px solid rgba(255, 176, 32, 0.3); font-size: 0.72rem; padding: 2px 8px;">
                ${b}
            </span>
        `).join('');
    } else {
        badgesContainer.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-secondary);">No badges earned yet.</span>`;
    }

    // Latest quiz
    const quizContainer = document.getElementById('detail-student-quiz');
    if (student.latest_quiz) {
        quizContainer.innerHTML = `
            <strong>Topic:</strong> ${student.latest_quiz.topic}<br>
            <strong>Score:</strong> ${student.latest_quiz.score} / ${student.latest_quiz.total_questions} (${Math.round((student.latest_quiz.score / student.latest_quiz.total_questions) * 100)}%)
        `;
    } else {
        quizContainer.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-secondary);">No quiz attempts yet.</span>`;
    }

    // Quiz history timeline
    const timeline = document.getElementById('detail-student-history-timeline');
    timeline.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-secondary);"><i class='bx bx-loader-alt bx-spin'></i> Loading quiz timeline...</p>`;
    
    try {
        const res = await fetch(`${API_BASE}/ai/quiz/student-history/${studentEmail}`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (res.ok) {
            const history = await res.json();
            window.teacherActiveStudentHistory = history;

            if (history.length === 0) {
                timeline.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-secondary);">No quiz attempts recorded in database.</p>`;
            } else {
                timeline.innerHTML = history.map(h => {
                    const date = h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '';
                    return `
                        <div style="background: var(--bg-light); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.03); display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-weight: 600; font-size: 0.82rem; color: var(--text-primary);">${h.topic}</span>
                                <span style="font-size: 0.7rem; color: var(--text-secondary); display: block;">${date} | Diff: ${h.difficulty}</span>
                            </div>
                            <span style="font-weight: 700; color: ${h.score / h.total_questions >= 0.7 ? 'var(--secondary)' : 'var(--parent)'}; font-size: 0.88rem;">
                                ${h.score} / ${h.total_questions}
                            </span>
                        </div>
                    `;
                }).join('');

                // Render student charts
                renderTeacherStudentCharts(history);
            }
        } else {
            timeline.innerHTML = `<p style="font-size: 0.8rem; color: var(--parent);">Failed to load history.</p>`;
        }
    } catch (err) {
        console.error('Timeline fetch error:', err);
        timeline.innerHTML = `<p style="font-size: 0.8rem; color: var(--parent);">Error loading history.</p>`;
    }

    // Hook up tab switcher click events for teacher student progress
    const btnTimeline = document.getElementById('btn-teacher-timeline');
    const btnProgressLine = document.getElementById('btn-teacher-progress-line');
    const btnTopicBar = document.getElementById('btn-teacher-topic-bar');

    const wrapperTimeline = document.getElementById('teacher-student-timeline-wrapper');
    const wrapperProgressLine = document.getElementById('teacher-student-progress-line-wrapper');
    const wrapperTopicBar = document.getElementById('teacher-student-topic-bar-wrapper');

    const tabs = [btnTimeline, btnProgressLine, btnTopicBar];
    const wrappers = [wrapperTimeline, wrapperProgressLine, wrapperTopicBar];

    function selectTeacherTab(activeBtn, activeWrapper) {
        tabs.forEach(btn => {
            if (btn) {
                btn.style.color = 'var(--text-secondary)';
                btn.style.borderBottomColor = 'transparent';
                btn.classList.remove('active');
            }
        });
        wrappers.forEach(w => { if (w) w.style.display = 'none'; });

        if (activeBtn) {
            activeBtn.style.color = 'var(--teacher)';
            activeBtn.style.borderBottomColor = 'var(--teacher)';
            activeBtn.classList.add('active');
        }
        if (activeWrapper) {
            activeWrapper.style.display = 'block';
        }

        if (activeBtn === btnProgressLine && window.teacherProgressLineChartInstance) {
            window.teacherProgressLineChartInstance.resize();
            window.teacherProgressLineChartInstance.update();
        }
        if (activeBtn === btnTopicBar && window.teacherTopicBarChartInstance) {
            window.teacherTopicBarChartInstance.resize();
            window.teacherTopicBarChartInstance.update();
        }
    }

    if (btnTimeline) btnTimeline.onclick = () => selectTeacherTab(btnTimeline, wrapperTimeline);
    if (btnProgressLine) btnProgressLine.onclick = () => selectTeacherTab(btnProgressLine, wrapperProgressLine);
    if (btnTopicBar) btnTopicBar.onclick = () => selectTeacherTab(btnTopicBar, wrapperTopicBar);

    // Bind PDF Download Button for teacher
    const btnDownload = document.getElementById('btn-download-teacher-student-report');
    if (btnDownload) {
        btnDownload.onclick = downloadTeacherStudentPDFReport;
    }

    // Default to timeline tab on open
    selectTeacherTab(btnTimeline, wrapperTimeline);

    document.getElementById('student-detail-card').style.display = 'block';
    document.getElementById('student-detail-card').scrollIntoView({ behavior: 'smooth' });
}

function closeStudentDetails() {
    document.getElementById('student-detail-card').style.display = 'none';
}

window.viewStudentDetails = viewStudentDetails;
window.closeStudentDetails = closeStudentDetails;
window.selectClassroomForStudents = selectClassroomForStudents;

// Setup classroom creation form listener
const createClassForm = document.getElementById('create-classroom-form');
if (createClassForm) {
    createClassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const classNameInput = document.getElementById('create-class-name');
        const class_name = classNameInput.value.trim();
        if (!class_name) return;

        try {
            const res = await fetch(`${API_BASE}/auth/teacher/create-classroom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ class_name })
            });
            const data = await res.json();
            if (res.ok) {
                showToast(`🎉 Classroom '${class_name}' created! Code: ${data.class_code}`, 'success');
                classNameInput.value = '';
                await loadTeacherClassrooms();
            } else {
                showToast(data.detail || 'Failed to create classroom.', 'error');
            }
        } catch (err) {
            console.error('Error creating classroom:', err);
            showToast('Failed to create classroom.', 'error');
        }
    });
}

let currentLessonPlan = null;

async function generateClassroomLessonPlan(classCode) {
    if (!classCode) {
        showToast('No classroom selected.', 'warning');
        return;
    }
    
    const generateBtn = document.getElementById('generate-lesson-plan-btn');
    const loader = document.getElementById('lesson-plan-loader');
    const outputBox = document.getElementById('lesson-plan-output-box');
    const strugglingBox = document.getElementById('struggling-students-box');
    
    generateBtn.disabled = true;
    generateBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Generating...";
    loader.style.display = 'flex';
    outputBox.style.display = 'none';
    strugglingBox.style.display = 'none';
    
    try {
        const res = await fetch(`${API_BASE}/ai/teacher/classroom/${classCode}/lesson-plan`, {
            method: 'GET',
            headers: authHeaders()
        });
        
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || 'Failed to generate classroom insights and lesson plan.');
        }
        
        currentLessonPlan = data;
        
        // Dispatch analytics data to header
        document.getElementById('insights-class-average').textContent = `${data.overall_average}%`;
        document.getElementById('insights-weak-topic').textContent = data.target_topic;
        
        // Render struggling students if any
        const strugglingList = document.getElementById('struggling-students-list');
        if (data.struggling_students && data.struggling_students.length > 0) {
            strugglingBox.style.display = 'block';
            strugglingList.innerHTML = data.struggling_students.map(s => `
                <span class="status-badge" style="background: rgba(231, 111, 81, 0.1); color: var(--parent); border: 1px solid rgba(231, 111, 81, 0.2); font-size: 0.75rem; padding: 4px 10px; border-radius: 6px; font-weight: 500;">
                    ${s.name} (${s.average}%)
                </span>
            `).join('');
        } else {
            strugglingBox.style.display = 'none';
        }
        
        // Parse and render markdown lesson plan
        const viewport = document.getElementById('lesson-plan-markdown-viewport');
        if (typeof marked !== 'undefined') {
            viewport.innerHTML = marked.parse(data.lesson_plan);
        } else {
            viewport.textContent = data.lesson_plan;
        }
        
        outputBox.style.display = 'block';
        outputBox.scrollIntoView({ behavior: 'smooth' });
        showToast('🎉 Lesson plan generated successfully!', 'success');
        
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Error generating lesson plan.', 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = "<i class='bx bx-magic-wand'></i> Generate AI Lesson Plan";
        loader.style.display = 'none';
    }
}

function printClassroomLessonPlan() {
    if (!currentLessonPlan) {
        showToast('No lesson plan available to print.', 'warning');
        return;
    }
    
    let html = `<h1>Revision Lesson Plan: ${currentLessonPlan.target_topic}</h1>`;
    html += `<p><strong>Class Overall Average Score:</strong> ${currentLessonPlan.overall_average}%</p>`;
    html += `<p><strong>Revision Topic Class Average Score:</strong> ${currentLessonPlan.target_topic_average}%</p>`;
    if (currentLessonPlan.struggling_students && currentLessonPlan.struggling_students.length > 0) {
        html += `<p><strong>Struggling Students (Below 75%):</strong> ${currentLessonPlan.struggling_students.map(s => `${s.name} (${s.average}%)`).join(', ')}</p>`;
    }
    html += `<hr>`;
    
    if (typeof marked !== 'undefined') {
        html += marked.parse(currentLessonPlan.lesson_plan);
    } else {
        html += `<pre>${currentLessonPlan.lesson_plan}</pre>`;
    }
    
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Lesson Plan - ${currentLessonPlan.target_topic}</title>
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
}

/* ========================================
   TEACHER ASSIGNMENTS HUB LOGIC
   ======================================== */
let selectedAssignmentClassCode = null;
let currentAIGeneratedQuestions = [];

async function selectClassroomForAssignments(classCode, className) {
    selectedAssignmentClassCode = classCode;
    document.getElementById('asg-class-code').value = classCode;
    
    // Style active selector item
    const items = document.querySelectorAll('#assignments-classroom-selector .selector-item-asg');
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

    document.getElementById('assignments-class-title').innerHTML = `<i class='bx bx-task'></i> Assignments in ${className}`;
    document.getElementById('assignments-view-card').style.display = 'block';
    document.getElementById('create-assignment-card').style.display = 'none';
    document.getElementById('submissions-grading-card').style.display = 'none';
    document.getElementById('grade-student-card').style.display = 'none';

    await loadClassroomAssignments(classCode);
    switchTeacherClassroomTab('assignments');
}

async function loadClassroomAssignments(classCode) {
    const list = document.getElementById('teacher-assignments-list');
    list.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);"><i class='bx bx-loader-alt bx-spin'></i> Loading assignments...</p>`;
    
    try {
        const res = await fetch(`${API_BASE}/assignments/classroom/${classCode}`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const assignments = await res.json();

        if (assignments.length === 0) {
            list.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">No assignments published in this classroom yet. Click "New Assignment" to create one!</p>`;
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
                
                return `
                    <div style="background: var(--bg-light); padding: 1.2rem; border-radius: 8px; border: 1px solid rgba(0,0,0,0.04); display: flex; align-items: start; gap: 1rem; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; gap: 1rem; align-items: start; flex-grow: 1;">
                            <div style="background: ${iconBg}; color: #fff; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
                                <i class='bx ${iconClass}'></i>
                            </div>
                            <div style="flex-grow: 1;">
                                <h4 style="font-weight: 700; color: var(--text-primary); font-size: 1rem; margin-bottom: 4px;">${a.title}</h4>
                                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; line-height: 1.5;">${a.description}</p>
                                <span style="font-size: 0.75rem; font-weight: 500; color: var(--text-secondary); display: block; margin-bottom: 8px;">
                                    <i class='bx bx-time' style="vertical-align: middle;"></i> Due: <strong>${dueDate}</strong> | Max Marks: <strong>${a.max_marks}</strong>
                                </span>
                                ${a.gdrive_link ? `
                                    <a href="${a.gdrive_link}" target="_blank" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 0.72rem; margin-top: 2px; margin-bottom: 8px; background: rgba(231,111,81,0.08); color: var(--parent); border: 1px solid rgba(231,111,81,0.15); text-decoration: none;">
                                        <i class='bx bx-link'></i> Attached Link
                                    </a>
                                ` : ''}
                                
                                <!-- Submission Progress Bar -->
                                <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px; max-width: 320px;">
                                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">
                                        <span>Submissions Rate</span>
                                        <span>${a.submissions_count || 0} / ${a.total_students || 0} students (${a.total_students ? Math.round((a.submissions_count || 0) / a.total_students * 100) : 0}%)</span>
                                    </div>
                                    <div style="background: rgba(0,0,0,0.06); height: 6px; border-radius: 3px; overflow: hidden; width: 100%;">
                                        <div style="background: var(--secondary); height: 100%; width: ${a.total_students ? Math.round((a.submissions_count || 0) / a.total_students * 100) : 0}%;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex-shrink: 0;">
                            <button class="btn btn-secondary btn-sm" style="padding: 6px 12px; font-size: 0.8rem; display: flex; align-items: center; gap: 4px; flex-shrink: 0;" onclick="viewAssignmentSubmissions('${a.id}', '${a.title.replace(/'/g, "\\'")}')">
                                <i class='bx bx-check-double'></i> View Submissions
                            </button>
                            <button class="btn btn-sm" style="padding: 4px 10px; font-size: 0.75rem; display: flex; align-items: center; gap: 4px; flex-shrink: 0; background: transparent; border: 1px solid rgba(230,57,70,0.3); color: #e63946;" onclick="deleteTeacherAssignmentItem('${a.id}', '${classCode}')">
                                <i class='bx bx-trash'></i> Delete
                            </button>
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

function showCreateAssignmentForm() {
    document.getElementById('assignments-view-card').style.display = 'none';
    document.getElementById('create-assignment-card').style.display = 'block';
    document.getElementById('submissions-grading-card').style.display = 'none';
    document.getElementById('grade-student-card').style.display = 'none';
    document.getElementById('create-assignment-form').reset();
    
    // Set default due date: tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    const localISO = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('asg-due').value = localISO;
    
    switchAssignmentTab('manual');
}

function hideCreateAssignmentForm() {
    document.getElementById('create-assignment-card').style.display = 'none';
    document.getElementById('assignments-view-card').style.display = 'block';
}

function switchAssignmentTab(type) {
    document.getElementById('asg-type').value = type;
    
    document.querySelectorAll('.assignment-tab').forEach(btn => btn.classList.remove('active'));
    
    if (type === 'manual') {
        document.getElementById('tab-manual-btn').classList.add('active');
        document.getElementById('asg-link-group').style.display = 'none';
        document.getElementById('asg-ai-group').style.display = 'none';
    } else if (type === 'ai') {
        document.getElementById('tab-ai-btn').classList.add('active');
        document.getElementById('asg-link-group').style.display = 'none';
        document.getElementById('asg-ai-group').style.display = 'block';
    } else if (type === 'link') {
        document.getElementById('tab-link-btn').classList.add('active');
        document.getElementById('asg-link-group').style.display = 'block';
        document.getElementById('asg-ai-group').style.display = 'none';
    }
}

async function generateAIAssignmentQuestions() {
    const topicSelect = document.getElementById('asg-ai-chapter');
    const gradeSelect = document.getElementById('asg-ai-grade');
    if (!topicSelect || !topicSelect.value) {
        showToast('Please select a chapter for AI question generation.', 'warning');
        return;
    }
    const topic = topicSelect.value;
    const grade = gradeSelect.value || 'Medium level practice sheet';
    
    const preview = document.getElementById('asg-ai-preview');
    preview.style.display = 'block';
    preview.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> AI is generating questions...`;
    
    const numQ = parseInt(document.getElementById('asg-ai-count').value);
    
    try {
        const res = await fetch(`${API_BASE}/ai/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ topic, grade, num_questions: numQ, difficulty: 'medium' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate questions');
        
        currentAIGeneratedQuestions = data.questions.map(q => ({
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_option
        }));
        
        let previewHtml = `<h5 style="margin-bottom: 10px; color: var(--ai-accent);">Generated Questions Preview:</h5>`;
        currentAIGeneratedQuestions.forEach((q, idx) => {
            previewHtml += `
                <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed rgba(0,0,0,0.05);">
                    <strong>Q${idx + 1}: ${q.question_text}</strong>
                    <ul style="margin: 4px 0 0 15px; padding: 0;">
                        ${q.options.map(o => `<li>${o}</li>`).join('')}
                    </ul>
                </div>
            `;
        });
        
        preview.innerHTML = previewHtml;
        
        let autoDesc = `AI generated worksheet topic: "${topic}". Please solve the questions below:\n\n`;
        currentAIGeneratedQuestions.forEach((q, idx) => {
            autoDesc += `Q${idx + 1}. ${q.question_text}\n`;
            q.options.forEach((o, i) => {
                autoDesc += `   [${['A','B','C','D'][i]}] ${o}\n`;
            });
            autoDesc += `\n`;
        });
        document.getElementById('asg-description').value = autoDesc;
        showToast('🎉 AI drafted questions successfully added to description!', 'success');
        
    } catch (err) {
        console.error(err);
        preview.innerHTML = `<span style="color: var(--parent);">Failed to generate AI questions. Please retry.</span>`;
    }
}

async function handleCreateAssignmentSubmit(e) {
    e.preventDefault();
    
    const class_code = document.getElementById('asg-class-code').value;
    const type = document.getElementById('asg-type').value;
    const title = document.getElementById('asg-title').value.trim();
    const description = document.getElementById('asg-description').value.trim();
    const due_date = new Date(document.getElementById('asg-due').value).toISOString();
    const max_marks = parseInt(document.getElementById('asg-marks').value);
    const gdrive_link = document.getElementById('asg-link').value.trim() || null;
    
    const ai_questions = type === 'ai' ? currentAIGeneratedQuestions : [];
    
    try {
        const res = await fetch(`${API_BASE}/assignments/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
                class_code,
                title,
                description,
                assignment_type: type,
                due_date,
                max_marks,
                gdrive_link,
                ai_questions
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to create assignment');
        
        showToast('🎉 Assignment published successfully!', 'success');
        hideCreateAssignmentForm();
        await loadClassroomAssignments(class_code);
        
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to create assignment', 'error');
    }
}

async function viewAssignmentSubmissions(assignmentId, assignmentTitle) {
    document.getElementById('submissions-grading-card').style.display = 'block';
    document.getElementById('grade-student-card').style.display = 'none';
    document.getElementById('grading-assignment-title').innerHTML = `<i class='bx bx-check-shield'></i> Grading Submissions: ${assignmentTitle}`;
    
    const tableBody = document.getElementById('submissions-table-body');
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);"><i class='bx bx-loader-alt bx-spin'></i> Loading submissions...</td></tr>`;
    
    try {
        const res = await fetch(`${API_BASE}/assignments/${assignmentId}/submissions`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const submissions = await res.json();

        // Fetch classroom students dynamically to cross-reference
        const studentsRes = await fetch(`${API_BASE}/auth/teacher/classroom/${selectedAssignmentClassCode}/students`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!studentsRes.ok) throw new Error();
        const classroomStudents = await studentsRes.json();
        
        if (classroomStudents.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No students enrolled in this classroom.</td></tr>`;
        } else {
            tableBody.innerHTML = classroomStudents.map(student => {
                const sub = submissions.find(s => 
                    (s.student_email && s.student_email.toLowerCase() === student.email.toLowerCase()) || 
                    (s.student_id === student.id)
                );
                
                let statusBadge = '';
                let submittedAtText = '-';
                let scoreText = '-';
                let actionButton = '';
                
                if (sub) {
                    const date = sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('en-IN', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '';
                    submittedAtText = date;
                    
                    if (sub.status === 'graded') {
                        statusBadge = `<span class="status-badge status-good">Graded</span>`;
                        scoreText = `<strong style="color: var(--secondary);">${sub.grade}</strong>`;
                    } else {
                        statusBadge = `<span class="status-badge" style="background-color: rgba(244, 162, 97, 0.15); color: #f4a261;">Pending</span>`;
                        scoreText = `<span style="color: var(--text-secondary);">Not Graded</span>`;
                    }
                    
                    const escName = student.name.replace(/'/g, "\\'");
                    const escText = (sub.submission_text || '').replace(/'/g, "\\'").replace(/\n/g, "\\n");
                    const answersStr = JSON.stringify(sub.answers || []).replace(/"/g, '&quot;');
                    
                    actionButton = `
                        <button class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.78rem;" 
                                onclick="showGradeForm('${sub.id}', '${escName}', '${escText}', ${answersStr})">
                            <i class='bx bx-edit'></i> Grade
                        </button>
                    `;
                } else {
                    statusBadge = `<span class="status-badge status-struggling">Not Submitted</span>`;
                    actionButton = `
                        <button class="btn btn-secondary btn-sm" disabled style="padding: 4px 10px; font-size: 0.78rem; opacity: 0.5; cursor: not-allowed;">
                            <i class='bx bx-edit'></i> Grade
                        </button>
                    `;
                }
                
                return `
                    <tr>
                        <td style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${student.name}</td>
                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${student.email}</td>
                        <td>${statusBadge}</td>
                        <td style="font-size: 0.85rem; color: var(--text-secondary);">${submittedAtText}</td>
                        <td style="font-size: 0.9rem;">${scoreText}</td>
                        <td>${actionButton}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--parent);">Failed to load submissions.</td></tr>`;
    }
}

function closeSubmissionsView() {
    document.getElementById('submissions-grading-card').style.display = 'none';
    document.getElementById('grade-student-card').style.display = 'none';
}

function showGradeForm(submissionId, studentName, submissionText, answers) {
    document.getElementById('grade-student-card').style.display = 'block';
    document.getElementById('grade-student-card').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('grade-student-name').textContent = studentName;
    document.getElementById('grade-submission-id').value = submissionId;
    document.getElementById('grade-submission-text').textContent = submissionText || "(No description submission)";
    
    const ansBox = document.getElementById('grade-submission-answers');
    ansBox.innerHTML = '';
    if (answers && answers.length > 0) {
        let ansHtml = `<h5 style="margin-bottom: 5px; color: var(--secondary);">Worksheet MCQ Answers Submitted:</h5>`;
        answers.forEach((ans, i) => {
            ansHtml += `<div><strong>Q${i + 1} Answer:</strong> ${ans}</div>`;
        });
        ansBox.innerHTML = ansHtml;
    }
    
    document.getElementById('asg-grade-score').value = '';
    document.getElementById('asg-grade-remarks').value = '';
}

async function handleGradingSubmit(e) {
    e.preventDefault();
    
    const submissionId = document.getElementById('grade-submission-id').value;
    const grade = parseInt(document.getElementById('asg-grade-score').value);
    const teacher_remarks = document.getElementById('asg-grade-remarks').value.trim();
    
    try {
        const res = await fetch(`${API_BASE}/assignments/submission/${submissionId}/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ grade, teacher_remarks })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to grade submission');
        
        showToast('🎉 Submission graded successfully!', 'success');
        document.getElementById('grade-student-card').style.display = 'none';
        
        await loadClassroomAssignments(selectedAssignmentClassCode);
        document.getElementById('submissions-grading-card').style.display = 'none';
        
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Failed to grade submission', 'error');
    }
}

// Fetch classrooms on DOM load & set up click listeners
window.addEventListener('DOMContentLoaded', async () => {
    await loadTeacherClassrooms();
    await loadTeacherNotifications();

    // Setup quiz selectors
    const tqGrade = document.getElementById('tq-grade');
    const tqSubject = document.getElementById('tq-subject');
    if (tqGrade) {
        tqGrade.addEventListener('change', () => {
            loadSyllabusSubjects('tq-grade', 'tq-subject', 'tq-chapter');
        });
    }
    if (tqSubject) {
        tqSubject.addEventListener('change', () => {
            loadSyllabusChapters('tq-grade', 'tq-subject', 'tq-chapter');
        });
    }

    // Setup assignment selectors
    const asgAIGrade = document.getElementById('asg-ai-grade');
    const asgAISubject = document.getElementById('asg-ai-subject');
    if (asgAIGrade) {
        asgAIGrade.addEventListener('change', () => {
            loadSyllabusSubjects('asg-ai-grade', 'asg-ai-subject', 'asg-ai-chapter');
        });
    }
    if (asgAISubject) {
        asgAISubject.addEventListener('change', () => {
            loadSyllabusChapters('asg-ai-grade', 'asg-ai-subject', 'asg-ai-chapter');
        });
    }
    
    const genBtn = document.getElementById('generate-lesson-plan-btn');
    if (genBtn) {
        genBtn.addEventListener('click', () => {
            generateClassroomLessonPlan(selectedClassCode);
        });
    }
    
    const prtBtn = document.getElementById('print-lesson-plan-btn');
    if (prtBtn) {
        prtBtn.addEventListener('click', () => {
            printClassroomLessonPlan();
        });
    }

    const asgForm = document.getElementById('create-assignment-form');
    if (asgForm) {
        asgForm.addEventListener('submit', handleCreateAssignmentSubmit);
    }
    
    const gradeForm = document.getElementById('submit-grading-form');
    if (gradeForm) {
        gradeForm.addEventListener('submit', handleGradingSubmit);
    }

    const chatForm = document.getElementById('chat-send-form');
    if (chatForm) {
        chatForm.addEventListener('submit', sendChatMessage);
    }

    const postAnnForm = document.getElementById('teacher-post-announcement-form');
    if (postAnnForm) {
        postAnnForm.addEventListener('submit', handleTeacherPostAnnouncementSubmit);
    }

    // Student search and sort event listeners
    const searchInput = document.getElementById('student-search-input');
    const sortSelect = document.getElementById('student-sort-select');
    if (searchInput) {
        searchInput.addEventListener('input', renderFilteredAndSortedStudents);
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', renderFilteredAndSortedStudents);
    }

    // Setup mobile sidebar toggler and overlay
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.querySelector('.sidebar');
    if (toggleBtn && sidebar) {
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            document.body.appendChild(overlay);
        }
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        };
        overlay.onclick = () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        };
        const menuItems = sidebar.querySelectorAll('.menu-item, .btn-logout');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        });
    }

    // Setup back button for mobile chat
    const chatBackBtn = document.getElementById('chat-mobile-back');
    if (chatBackBtn) {
        chatBackBtn.addEventListener('click', () => {
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                chatContainer.classList.remove('active-chat-open');
            }
        });
    }
});

// Attach helper functions to global window context
window.selectClassroomForAssignments = selectClassroomForAssignments;
window.loadClassroomAssignments = loadClassroomAssignments;
window.showCreateAssignmentForm = showCreateAssignmentForm;
window.hideCreateAssignmentForm = hideCreateAssignmentForm;
window.switchAssignmentTab = switchAssignmentTab;
window.generateAIAssignmentQuestions = generateAIAssignmentQuestions;
window.viewAssignmentSubmissions = viewAssignmentSubmissions;
window.closeSubmissionsView = closeSubmissionsView;
window.showGradeForm = showGradeForm;
window.renderFilteredAndSortedStudents = renderFilteredAndSortedStudents;
window.messageParent = messageParent;

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
                <div class="chat-contact-avatar" style="background-color: ${c.role === 'parent' ? 'var(--parent)' : 'var(--secondary)'};">${c.name.charAt(0).toUpperCase()}</div>
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
    
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
        chatContainer.classList.add('active-chat-open');
    }
    
    document.getElementById('active-chat-name').textContent = contactName;
    document.getElementById('active-chat-role').textContent = contactRole;
    
    // Set custom avatar class or style based on role
    const avatarEl = document.getElementById('active-chat-avatar');
    avatarEl.textContent = contactName.charAt(0).toUpperCase();
    avatarEl.style.backgroundColor = contactRole === 'parent' ? 'var(--parent)' : 'var(--secondary)';
    
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
function switchTeacherClassroomTab(tabName) {
    document.getElementById('teacher-class-tab-assignments').style.display = tabName === 'assignments' ? 'block' : 'none';
    document.getElementById('teacher-class-tab-stream').style.display = tabName === 'stream' ? 'block' : 'none';
    document.getElementById('teacher-class-tab-leaderboard').style.display = tabName === 'leaderboard' ? 'block' : 'none';
    
    document.getElementById('tab-btn-asg-assignments').classList.toggle('active', tabName === 'assignments');
    document.getElementById('tab-btn-asg-stream').classList.toggle('active', tabName === 'stream');
    document.getElementById('tab-btn-asg-leaderboard').classList.toggle('active', tabName === 'leaderboard');
    
    // Hide new assignment button if not on assignments tab
    const newAsgBtn = document.getElementById('btn-new-assignment-trigger');
    if (newAsgBtn) {
        newAsgBtn.style.display = tabName === 'assignments' ? 'block' : 'none';
    }
    
    if (tabName === 'stream' && selectedAssignmentClassCode) {
        loadClassroomAnnouncements(selectedAssignmentClassCode);
    } else if (tabName === 'leaderboard' && selectedAssignmentClassCode) {
        loadClassroomLeaderboard(selectedAssignmentClassCode);
    }
}

async function loadClassroomAnnouncements(classCode) {
    const feed = document.getElementById('teacher-announcements-feed');
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
            feed.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary);">No announcements posted yet. Be the first to share an update!</p>`;
            return;
        }
        
        feed.innerHTML = announcements.map(ann => {
            const date = new Date(ann.created_at).toLocaleDateString('en-IN', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const isLiked = ann.likes.includes(user.id);
            
            return `
                <div style="background: var(--bg-light); border: 1px solid rgba(0,0,0,0.04); padding: 1.2rem; border-radius: 8px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: 700; color: var(--primary); font-size: 0.9rem;">${ann.author_name}</span>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.72rem; color: var(--text-secondary);">${date}</span>
                            <button onclick="deleteTeacherAnnouncement('${classCode}', '${ann.id}')" style="background: transparent; border: none; color: #e63946; cursor: pointer; padding: 2px 4px; display: flex; align-items: center;" title="Delete Announcement">
                                <i class='bx bx-trash' style="font-size: 0.95rem;"></i>
                            </button>
                        </div>
                    </div>
                    <p style="font-size: 0.92rem; color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; margin-bottom: 12px;">${ann.content}</p>
                    
                    <div style="display: flex; gap: 1rem; align-items: center; border-top: 1px solid rgba(0,0,0,0.03); padding-top: 8px; margin-top: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="likeTeacherAnnouncement('${classCode}', '${ann.id}')" style="padding: 4px 8px; font-size: 0.75rem; background: ${isLiked ? 'rgba(42,157,143,0.1)' : 'transparent'}; color: ${isLiked ? 'var(--secondary)' : 'var(--text-secondary)'}; border: none;">
                            <i class='bx ${isLiked ? 'bxs-heart' : 'bx-heart'}'></i> Like (${ann.likes.length})
                        </button>
                    </div>
                    
                    <!-- Comments Section -->
                    <div style="margin-top: 12px; background: rgba(0,0,0,0.01); padding: 10px; border-radius: 6px;">
                        <div id="comments-list-${ann.id}" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
                            ${ann.comments.length === 0 ? `<p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">No comments yet.</p>` : ann.comments.map(c => `
                                <div style="font-size: 0.8rem; line-height: 1.4; border-bottom: 1px dashed rgba(0,0,0,0.02); padding-bottom: 4px; margin-bottom: 4px;">
                                    <strong style="color: var(--primary);">${c.user_name} (${c.user_role}):</strong>
                                    <span style="color: var(--text-primary);">${c.content}</span>
                                </div>
                            `).join('')}
                        </div>
                        <form onsubmit="postTeacherAnnouncementComment(event, '${classCode}', '${ann.id}')" style="display: flex; gap: 6px;">
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

async function handleTeacherPostAnnouncementSubmit(e) {
    e.preventDefault();
    if (!selectedAssignmentClassCode) return;
    const input = document.getElementById('announcement-content');
    const content = input.value.trim();
    if (!content) return;
    
    try {
        const res = await fetch(`${API_BASE}/classrooms/${selectedAssignmentClassCode}/announcements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (res.ok) {
            showToast('🎉 Announcement posted successfully!', 'success');
            input.value = '';
            await loadClassroomAnnouncements(selectedAssignmentClassCode);
        } else {
            showToast(data.detail || 'Failed to post announcement.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error posting announcement.', 'error');
    }
}

async function likeTeacherAnnouncement(classCode, announcementId) {
    try {
        const res = await fetch(`${API_BASE}/classrooms/${classCode}/announcements/${announcementId}/like`, {
            method: 'POST',
            headers: authHeaders()
        });
        if (res.ok) {
            await loadClassroomAnnouncements(classCode);
        }
    } catch (err) {
        console.error(err);
    }
}

async function postTeacherAnnouncementComment(e, classCode, announcementId) {
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
            await loadClassroomAnnouncements(classCode);
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadClassroomLeaderboard(classCode) {
    const tbody = document.getElementById('teacher-class-leaderboard-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);"><i class='bx bx-loader-alt bx-spin'></i> Loading leaderboard...</td></tr>`;
    
    try {
        const res = await fetch(`${API_BASE}/classrooms/${classCode}/leaderboard`, {
            method: 'GET',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error();
        const leaderboard = await res.json();
        
        if (leaderboard.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No students enrolled in this classroom.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = leaderboard.map(student => `
            <tr style="background: ${student.id === user.id ? 'rgba(42,157,143,0.05)' : 'transparent'};">
                <td style="font-weight: 700; color: var(--secondary); font-size: 0.95rem;">
                    ${student.rank === 1 ? '🥇 1' : student.rank === 2 ? '🥈 2' : student.rank === 3 ? '🥉 3' : student.rank}
                </td>
                <td style="font-weight: 600; color: var(--text-primary);">${student.name}</td>
                <td><span class="status-badge" style="background: var(--primary); color: #fff; font-size: 0.72rem; padding: 2px 6px;">Lvl ${student.level}</span></td>
                <td style="font-weight: 700; color: var(--secondary);">${student.xp} XP</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--parent);">Failed to load leaderboard.</td></tr>`;
    }
}

async function loadTeacherNotifications() {
    const feed = document.getElementById('teacher-alerts-feed');
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
                iconBg = 'rgba(108, 52, 131, 0.1)';
                iconColor = 'var(--ai-accent)';
            }
            
            const isUnread = !notif.read;
            
            return `
                <div class="feed-item" style="border-left: 3px solid ${isUnread ? 'var(--secondary)' : 'transparent'}; background: ${isUnread ? 'rgba(42,157,143,0.01)' : 'transparent'}; position: relative; cursor: pointer; display: flex; align-items: flex-start; gap: 10px; padding: 10px 15px; border-bottom: 1px solid rgba(0,0,0,0.02);" onclick="markTeacherNotificationRead('${notif.id}')">
                    <div class="feed-item-icon" style="background-color: ${iconBg}; color: ${iconColor}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
                        <i class='bx ${iconClass}'></i>
                    </div>
                    <div class="feed-item-details" style="flex-grow: 1;">
                        <div class="feed-item-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
                            <span class="feed-item-title" style="font-weight: ${isUnread ? '700' : '600'}; font-size: 0.85rem; color: var(--text-primary);">${notif.title}</span>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span class="feed-item-time" style="font-size: 0.72rem; color: var(--text-secondary);">${date}</span>
                                <button onclick="deleteTeacherNotificationItem(event, '${notif.id}')" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-size: 1.1rem; line-height: 1; padding: 0 4px; margin-left: 2px;" title="Delete Alert">&times;</button>
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

async function markTeacherNotificationRead(notificationId) {
    try {
        const res = await fetch(`${API_BASE}/classrooms/notifications/${notificationId}/read`, {
            method: 'POST',
            headers: authHeaders()
        });
        if (res.ok) {
            await loadTeacherNotifications();
        }
    } catch (err) {
        console.error(err);
    }
}

// Global exports
window.switchTeacherClassroomTab = switchTeacherClassroomTab;
window.likeTeacherAnnouncement = likeTeacherAnnouncement;
window.postTeacherAnnouncementComment = postTeacherAnnouncementComment;
window.loadClassroomAnnouncements = loadClassroomAnnouncements;
window.loadClassroomLeaderboard = loadClassroomLeaderboard;
window.loadTeacherNotifications = loadTeacherNotifications;
window.markTeacherNotificationRead = markTeacherNotificationRead;
window.handleTeacherPostAnnouncementSubmit = handleTeacherPostAnnouncementSubmit;

// Deletion & Auto-clean actions
async function deleteTeacherAnnouncement(classCode, announcementId) {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
        const res = await fetch(`${API_BASE}/classrooms/${classCode}/announcements/${announcementId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (res.ok) {
            showToast('Announcement deleted successfully.', 'success');
            await loadClassroomAnnouncements(classCode);
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to delete announcement.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error deleting announcement.', 'error');
    }
}

async function deleteTeacherAssignmentItem(assignmentId, classCode) {
    if (!confirm('Are you sure you want to delete this assignment and all its student submissions? This cannot be undone.')) return;
    try {
        const res = await fetch(`${API_BASE}/assignments/${assignmentId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (res.ok) {
            showToast('Assignment deleted successfully.', 'success');
            await loadClassroomAssignments(classCode);
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to delete assignment.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error deleting assignment.', 'error');
    }
}

async function deleteTeacherClassroom() {
    if (!selectedClassCode) {
        showToast('No classroom selected.', 'warning');
        return;
    }
    const classCode = selectedClassCode;
    const confirmation = prompt(`Warning: This will delete classroom ${classCode} and all its announcements, assignments, student submissions, and notifications. Type the classroom code to confirm:`);
    if (confirmation !== classCode) {
        if (confirmation !== null) {
            showToast('Confirmation code mismatch. Deletion cancelled.', 'warning');
        }
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/classrooms/${classCode}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (res.ok) {
            showToast(`Classroom ${classCode} deleted successfully.`, 'success');
            selectedClassCode = null;
            selectedAssignmentClassCode = null;
            
            // Hide cards
            document.getElementById('classroom-students-card').style.display = 'none';
            document.getElementById('student-detail-card').style.display = 'none';
            if (document.getElementById('assignments-view-card')) {
                document.getElementById('assignments-view-card').style.display = 'none';
            }
            if (document.getElementById('create-assignment-card')) {
                document.getElementById('create-assignment-card').style.display = 'none';
            }
            
            // Reload classrooms lists
            await loadTeacherClassrooms();
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to delete classroom.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error deleting classroom.', 'error');
    }
}

async function clearTeacherNotifications() {
    if (!confirm('Are you sure you want to clear all notifications?')) return;
    try {
        const res = await fetch(`${API_BASE}/classrooms/notifications`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (res.ok) {
            showToast('Notifications cleared.', 'success');
            await loadTeacherNotifications();
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to clear notifications.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error clearing notifications.', 'error');
    }
}

async function deleteTeacherNotificationItem(e, notificationId) {
    e.stopPropagation();
    try {
        const res = await fetch(`${API_BASE}/classrooms/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (res.ok) {
            showToast('Notification deleted.', 'success');
            await loadTeacherNotifications();
        } else {
            const data = await res.json();
            showToast(data.detail || 'Failed to delete notification.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error deleting notification.', 'error');
    }
}

window.deleteTeacherAnnouncement = deleteTeacherAnnouncement;
window.deleteTeacherAssignmentItem = deleteTeacherAssignmentItem;
window.deleteTeacherClassroom = deleteTeacherClassroom;
window.clearTeacherNotifications = clearTeacherNotifications;
window.deleteTeacherNotificationItem = deleteTeacherNotificationItem;

async function initProfilePanel() {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Fill form fields
    document.getElementById('profile-input-name').value = storedUser.name || '';
    document.getElementById('profile-input-email').value = storedUser.email || '';
    document.getElementById('profile-input-phone').value = storedUser.phone || '';
    document.getElementById('profile-input-bio').value = storedUser.bio || '';
    document.getElementById('profile-input-qualification').value = storedUser.qualification || '';
    document.getElementById('profile-input-subject').value = storedUser.subject || '';

    // Render profile picture
    const placeholderEl = document.getElementById('profile-pic-placeholder');
    const imgEl = document.getElementById('profile-pic-preview-img');
    
    if (storedUser.profile_pic) {
        imgEl.src = storedUser.profile_pic.startsWith('http') ? storedUser.profile_pic : BACKEND_URL + storedUser.profile_pic;
        imgEl.style.display = 'block';
        placeholderEl.style.display = 'none';
    } else {
        placeholderEl.textContent = (storedUser.name || 'T').charAt(0).toUpperCase();
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
            const qualification = document.getElementById('profile-input-qualification').value.trim();
            const subject = document.getElementById('profile-input-subject').value.trim();
            
            try {
                const res = await fetch(`${API_BASE}/auth/profile`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, phone, bio, qualification, subject })
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
    const parentsList = document.getElementById('profile-parents-list');
    
    if (!studentsList || !parentsList) return;
    
    studentsList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;"><i class='bx bx-loader-alt bx-spin'></i> Loading connections...</p>`;
    parentsList.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;"><i class='bx bx-loader-alt bx-spin'></i> Loading connections...</p>`;
    
    try {
        const res = await fetch(`${API_BASE}/auth/profile/connections`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        
        // Render Students
        if (!data.students || data.students.length === 0) {
            studentsList.innerHTML = `<div style="font-size: 0.88rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;">No students joined your classrooms yet. Share classroom code to connect.</div>`;
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
                            <span class="connection-detail"><i class='bx bx-home-alt'></i> Classroom: ${s.classroom_name}</span>
                            ${s.phone ? `<span class="connection-detail"><i class='bx bx-phone'></i> ${s.phone}</span>` : ''}
                        </div>
                        <span class="connection-badge student">${grade}</span>
                    </div>
                `;
            }).join('');
        }
        
        // Render Parents
        if (!data.parents || data.parents.length === 0) {
            parentsList.innerHTML = `<div style="font-size: 0.88rem; color: var(--text-secondary); text-align: center; padding: 1rem 0;">No parents linked to your students yet.</div>`;
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
                            <span class="connection-detail"><i class='bx bx-smile'></i> Child: ${p.student_name}</span>
                            <span class="connection-detail"><i class='bx bx-envelope'></i> ${p.email}</span>
                            ${p.phone ? `<span class="connection-detail"><i class='bx bx-phone'></i> ${p.phone}</span>` : ''}
                        </div>
                        <span class="connection-badge parent">${relation}</span>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Failed to load connections:', err);
        studentsList.innerHTML = `<div style="font-size: 0.85rem; color: var(--parent); text-align: center; padding: 1rem 0;">Error loading students list.</div>`;
        parentsList.innerHTML = `<div style="font-size: 0.85rem; color: var(--parent); text-align: center; padding: 1rem 0;">Error loading parents list.</div>`;
    }
}

window.initProfilePanel = initProfilePanel;
