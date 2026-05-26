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
   AUTH GUARD — Redirect if not logged in
   ======================================== */
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

if (!token || !user || user.role !== 'student') {
    alert('Please login as a Student to access this dashboard.');
    window.location.href = 'login.html';
}

/* ========================================
   PROFILE RENDERING
   ======================================== */
document.getElementById('profile-name').textContent = user.name || 'Student';
document.getElementById('profile-avatar').textContent = (user.name || 'S').charAt(0).toUpperCase();

// Set current date string
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
    'quiz-panel': { title: 'Practice Quizzes', sub: 'Take AI-generated MCQ tests and sharpen your skills.' }
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
    item.addEventListener('click', () => {
        switchPanel(item.getAttribute('data-panel'));
    });
});

// Make switchPanel available globally for onclick in HTML
window.switchPanel = switchPanel;

/* ========================================
   TAG INPUT — Weak Topics
   ======================================== */
const weakTopics = [];
const topicsInput = document.getElementById('study-topics-input');
const topicsContainer = document.getElementById('study-topics-container');

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

function renderTopicTags() {
    // Remove existing tags
    topicsContainer.querySelectorAll('.tag-pill').forEach(t => t.remove());
    weakTopics.forEach((topic, idx) => {
        const pill = document.createElement('div');
        pill.classList.add('tag-pill');
        pill.innerHTML = `${topic} <i class='bx bx-x' data-idx="${idx}"></i>`;
        topicsContainer.insertBefore(pill, topicsInput);
    });
    // Add delete handler
    topicsContainer.querySelectorAll('.tag-pill i').forEach(icon => {
        icon.addEventListener('click', () => {
            weakTopics.splice(parseInt(icon.dataset.idx), 1);
            renderTopicTags();
        });
    });
}

/* ========================================
   HELPER — Auth headers
   ======================================== */
function authHeaders() {
    return { 'Authorization': `Bearer ${token}` };
}

/* ========================================
   AI STUDY PLAN GENERATOR
   ======================================== */
document.getElementById('study-plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const subject = document.getElementById('study-subject').value.trim();
    const grade = document.getElementById('study-grade').value;
    const goals = document.getElementById('study-goals').value.trim();

    if (weakTopics.length === 0) {
        showToast('Please add at least one weak topic.', 'warning');
        return;
    }

    // Show loader, hide output
    document.getElementById('study-loader').style.display = 'flex';
    document.getElementById('study-output-box').style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/ai/study-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({
                subject,
                grade,
                weak_topics: weakTopics,
                target_goals: goals || null
            })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate study plan');

        // Parse and render markdown
        const html = marked.parse(data.study_plan);
        document.getElementById('study-markdown-content').innerHTML = html;
        document.getElementById('study-output-box').style.display = 'block';

        // Increment stat
        const el = document.getElementById('stat-plans-count');
        el.textContent = parseInt(el.textContent) + 1;
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

function printPlan() {
    const content = document.getElementById('study-markdown-content').innerHTML;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>EduFlow AI Study Plan</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body{font-family:'Inter',sans-serif;padding:2rem;line-height:1.7;color:#2D3436}h1,h2,h3{color:#1B2A4A}</style>
    </head><body>${content}</body></html>`);
    w.document.close();
    w.print();
}
window.printPlan = printPlan;

/* ========================================
   AI DOUBT SOLVER (MULTIMODAL)
   ======================================== */
const dropzone = document.getElementById('image-dropzone');
const imageFileInput = document.getElementById('doubt-image-file');
const imagePreview = document.getElementById('image-upload-preview');
let selectedImageFile = null;

// Click to select
dropzone.addEventListener('click', () => imageFileInput.click());

// File select handler
imageFileInput.addEventListener('change', () => {
    if (imageFileInput.files.length > 0) {
        selectedImageFile = imageFileInput.files[0];
        showImagePreview(selectedImageFile);
    }
});

// Drag and drop
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

function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
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
            headers: { ...authHeaders() },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to solve doubt');

        const html = marked.parse(data.explanation);
        document.getElementById('doubt-markdown-content').innerHTML = html;
        document.getElementById('doubt-output-box').style.display = 'block';

        // Increment stat
        const el = document.getElementById('stat-doubts-count');
        el.textContent = parseInt(el.textContent) + 1;
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
   INTERACTIVE QUIZ ENGINE
   ======================================== */
let quizData = null;
let currentQ = 0;
let score = 0;
let answered = false;

document.getElementById('quiz-setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const topic = document.getElementById('quiz-topic').value.trim();
    const grade = document.getElementById('quiz-grade').value;
    const difficulty = document.getElementById('quiz-difficulty').value;
    const numQ = parseInt(document.getElementById('quiz-count').value);

    document.getElementById('quiz-setup-box').style.display = 'none';
    document.getElementById('quiz-loader').style.display = 'flex';
    document.getElementById('quiz-active-box').style.display = 'none';
    document.getElementById('quiz-summary-box').style.display = 'none';

    try {
        const res = await fetch(`${API_BASE}/ai/generate-quiz`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ topic, grade, num_questions: numQ, difficulty })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to generate quiz');

        quizData = data;
        currentQ = 0;
        score = 0;
        answered = false;

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

    // Reset UI
    document.getElementById('quiz-explanation-box').style.display = 'none';
    document.getElementById('quiz-next-btn').disabled = true;
    answered = false;
}

function selectOption(element, selected, question) {
    if (answered) return;
    answered = true;

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
    }

    // Show explanation
    document.getElementById('quiz-explanation-text').textContent = question.explanation;
    document.getElementById('quiz-explanation-box').style.display = 'block';

    // Enable next button
    document.getElementById('quiz-next-btn').disabled = false;
}

document.getElementById('quiz-next-btn').addEventListener('click', () => {
    currentQ++;
    if (currentQ < quizData.questions.length) {
        renderQuestion();
    } else {
        showQuizSummary();
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

    // Increment stat
    const el = document.getElementById('stat-quizzes-count');
    el.textContent = parseInt(el.textContent) + 1;
}

document.getElementById('quiz-quit-btn').addEventListener('click', () => {
    document.getElementById('quiz-active-box').style.display = 'none';
    document.getElementById('quiz-setup-box').style.display = 'block';
});

document.getElementById('quiz-restart-btn').addEventListener('click', () => {
    document.getElementById('quiz-summary-box').style.display = 'none';
    document.getElementById('quiz-setup-box').style.display = 'block';
});
