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
    'alerts-panel': { title: 'Smart Alerts', sub: 'AI-generated alerts about students who need attention.' },
    'chat-panel': { title: 'Direct Messages', sub: 'Communicate with students and parents.' }
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
    } catch (err) {
        console.error('Failed to load teacher classrooms:', err);
    }
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

        const tableBody = document.getElementById('classroom-students-table-body');
        if (students.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); font-size: 0.85rem;">No students have joined this classroom yet. Share the code <strong>${classCode}</strong> with them!</td></tr>`;
            document.getElementById('classroom-ai-insights-card').style.display = 'none';
        } else {
            tableBody.innerHTML = students.map(s => `
                <tr>
                    <td style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">${s.name}</td>
                    <td style="font-size: 0.85rem; color: var(--text-secondary);">${s.email}</td>
                    <td style="font-weight: 700; color: var(--secondary); font-size: 0.9rem;">${s.xp} XP</td>
                    <td><span class="status-badge" style="background: var(--primary); color: #fff; font-size: 0.72rem; padding: 2px 8px;">Lvl ${s.level}</span></td>
                    <td>
                        <button class="btn btn-secondary btn-sm" style="padding: 4px 10px; font-size: 0.78rem;" onclick="viewStudentDetails('${s.email}')">
                            <i class='bx bx-bar-chart-alt-2'></i> Stats
                        </button>
                    </td>
                </tr>
            `).join('');
            
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

async function viewStudentDetails(studentEmail) {
    const student = currentStudentsList.find(s => s.email === studentEmail);
    if (!student) return;

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
            }
        } else {
            timeline.innerHTML = `<p style="font-size: 0.8rem; color: var(--parent);">Failed to load history.</p>`;
        }
    } catch (err) {
        console.error('Timeline fetch error:', err);
        timeline.innerHTML = `<p style="font-size: 0.8rem; color: var(--parent);">Error loading history.</p>`;
    }

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
    w.print();
}

// Fetch classrooms on DOM load & set up click listeners
window.addEventListener('DOMContentLoaded', async () => {
    await loadTeacherClassrooms();
    
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
