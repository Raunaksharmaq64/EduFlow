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
    'tips-panel': { title: 'AI Parenting Tips', sub: 'Get personalized advice to support your child at home.' },
    'chat-panel': { title: 'Direct Messages', sub: "Communicate with your child's teachers." }
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
    } catch (err) {
        console.error('Failed to sync child history:', err);
    }
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

            perfBody.innerHTML = Object.values(topicGroups).map(group => {
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

    const concern = document.getElementById('parent-concern').value.trim();

    document.getElementById('tips-loader').style.display = 'flex';
    document.getElementById('tips-output-box').style.display = 'none';

    // Extrapolate weak areas from quiz history (any topic with avg score < 70%)
    const childWeakAreas = [];
    if (selectedChildQuizHistory.length > 0) {
        const topicScores = {};
        selectedChildQuizHistory.forEach(h => {
            if (!topicScores[h.topic]) topicScores[h.topic] = [];
            topicScores[h.topic].push(h.score / h.total_questions);
        });
        for (const [topic, scores] of Object.entries(topicScores)) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            if (avg < 0.7) {
                childWeakAreas.push(topic);
            }
        }
    }
    
    // Default fallback weak areas if none found or no child linked
    if (childWeakAreas.length === 0) {
        childWeakAreas.push('Quadratic Equations');
        childWeakAreas.push('General Subject Revision');
    }

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

// Load everything on DOM load & hook listeners
window.addEventListener('DOMContentLoaded', async () => {
    await loadLinkedChildren();
    
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

