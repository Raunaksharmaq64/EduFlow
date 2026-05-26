/* ========================================
   EduFlow — Auth Pages JavaScript (Login / Signup)
   ========================================
   
   YE FILE KAAM KARTA HAI:
   - Role tab switching (Teacher/Student/Parent)
   - Password show/hide toggle
   - Basic form validation
   - GSAP animations for form elements
   - Form submission handler with API calls
   
   DEPENDENCIES:
   - GSAP 3.x (CDN)
   
   ======================================== */

const API_BASE_URL = 'http://127.0.0.1:8000/api';


/* ========================================
   DOM READY — Page load hone pe initialize
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
    initRoleTabs();
    initPasswordToggle();
    initFormValidation();
    initAuthAnimations();
});


/* ========================================
   ROLE TABS — Teacher / Student / Parent switch
   ========================================
   - Click pe active role change hota hai
   - Pehle se "student" selected rehta hai by default
   ======================================== */
function initRoleTabs() {
    const tabs = document.querySelectorAll('.role-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active to clicked tab
            tab.classList.add('active');
        });
    });
}


/* ========================================
   PASSWORD TOGGLE — Eye icon se password show/hide
   ========================================
   - Click pe input type toggle hota hai (password ↔ text)
   - Icon bhi change hota hai (eye ↔ eye-slash)
   ======================================== */
function initPasswordToggle() {
    const toggleButtons = document.querySelectorAll('.password-toggle');
    
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            const icon = btn.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('bx-hide');
                icon.classList.add('bx-show');
            } else {
                input.type = 'password';
                icon.classList.remove('bx-show');
                icon.classList.add('bx-hide');
            }
        });
    });
}


/* ========================================
   FORM VALIDATION — Basic client-side validation
   ========================================
   - Email format check
   - Password length check (min 6 characters)
   - Confirm password match (signup only)
   - Name required (signup only)
   - Role selection required
   ======================================== */
function initFormValidation() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    // Login form validation
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email');
            const password = document.getElementById('login-password');
            const activeRole = document.querySelector('.role-tab.active');
            let isValid = true;
            
            // Email validation
            if (!validateEmail(email.value)) {
                showError(email, 'Please enter a valid email address');
                isValid = false;
            } else {
                clearError(email);
            }
            
            // Password validation
            if (password.value.length < 6) {
                showError(password, 'Password must be at least 6 characters');
                isValid = false;
            } else {
                clearError(password);
            }
            
            // Role validation
            if (!activeRole) {
                showToast('Please select your role (Teacher, Student, or Parent)', 'warning');
                isValid = false;
            }
            
            if (isValid) {
                const role = activeRole.getAttribute('data-role');
                const submitBtn = loginForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                
                // Show loading state
                submitBtn.disabled = true;
                submitBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Logging in...";
                
                await loginUser(email.value, password.value, role);
                
                // Reset submit button state
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
    
    // Signup form validation
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('signup-name');
            const email = document.getElementById('signup-email');
            const password = document.getElementById('signup-password');
            const confirmPassword = document.getElementById('signup-confirm-password');
            const activeRole = document.querySelector('.role-tab.active');
            const termsCheckbox = document.getElementById('terms-checkbox');
            let isValid = true;
            
            // Name validation
            if (name.value.trim().length < 2) {
                showError(name, 'Please enter your full name');
                isValid = false;
            } else {
                clearError(name);
            }
            
            // Email validation
            if (!validateEmail(email.value)) {
                showError(email, 'Please enter a valid email address');
                isValid = false;
            } else {
                clearError(email);
            }
            
            // Password validation
            if (password.value.length < 6) {
                showError(password, 'Password must be at least 6 characters');
                isValid = false;
            } else {
                clearError(password);
            }
            
            // Confirm password validation
            if (password.value !== confirmPassword.value) {
                showError(confirmPassword, 'Passwords do not match');
                isValid = false;
            } else {
                clearError(confirmPassword);
            }
            
            // Role validation
            if (!activeRole) {
                showToast('Please select your role (Teacher, Student, or Parent)', 'warning');
                isValid = false;
            }
            
            // Terms validation
            if (!termsCheckbox.checked) {
                showToast('Please accept the Terms & Conditions', 'warning');
                isValid = false;
            }
            
            if (isValid) {
                const role = activeRole.getAttribute('data-role');
                const submitBtn = signupForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                
                // Show loading state
                submitBtn.disabled = true;
                submitBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Creating account...";
                
                await registerUser(name.value, email.value, password.value, role);
                
                // Reset submit button state
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
}


/* ========================================
   HELPER FUNCTIONS — Validation utilities
   ======================================== */

// Email format validator
function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// Error dikhao input ke neeche
function showError(input, message) {
    input.classList.add('error');
    const errorEl = input.closest('.form-group').querySelector('.form-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }
}

// Error hatao
function clearError(input) {
    input.classList.remove('error');
    const errorEl = input.closest('.form-group').querySelector('.form-error');
    if (errorEl) {
        errorEl.classList.remove('visible');
    }
}

// Clear error on input focus
document.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('form-input')) {
        clearError(e.target);
    }
});

// Dynamic Toast Notification system
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

// Success notification helper mapping to showToast
function showSuccess(message) {
    showToast(message, 'success');
}


/* ========================================
   GSAP ANIMATIONS — Form elements animate on page load
   ========================================
   - Left branding panel slide-in from left
   - Form elements stagger fade-up from right
   ======================================== */
function initAuthAnimations() {
    // Check if GSAP is loaded
    if (typeof gsap === 'undefined') return;
    
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    
    // Branding panel — fade in from left
    tl.from('.auth-branding', {
        x: -60,
        opacity: 0,
        duration: 0.8
    });
    
    // Form header
    tl.from('.auth-form-header', {
        y: 30,
        opacity: 0,
        duration: 0.6
    }, '-=0.4');
    
    // Role tabs — stagger pop in
    tl.from('.role-tab', {
        y: 20,
        opacity: 0,
        duration: 0.4,
        stagger: 0.1,
        ease: 'back.out(1.7)'
    }, '-=0.3');
    
    // Form fields — stagger fade up
    tl.from('.form-group', {
        y: 20,
        opacity: 0,
        duration: 0.4,
        stagger: 0.08
    }, '-=0.2');
    
    // Form actions
    tl.from('.form-row, .auth-submit, .auth-divider, .auth-switch', {
        y: 15,
        opacity: 0,
        duration: 0.4,
        stagger: 0.08
    }, '-=0.2');
}

/* ========================================
   API INTEGRATION — Hit FastAPI endpoints
   ======================================== */

// Register a new user
async function registerUser(name, email, password, role) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                email,
                password,
                role
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Registration failed');
        }
        
        showSuccess(`Account created as ${role.charAt(0).toUpperCase() + role.slice(1)}! Redirecting to login...`);
        
        // 2 second baad login page pe redirect
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        
    } catch (error) {
        let errMsg = error.message || 'Server connection error. Please try again.';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
            errMsg = '🔌 Server is offline! Please start the backend server.';
            showToast(errMsg, 'error');
        } else {
            showToast(`❌ Signup Failed: ${errMsg}`, 'error');
        }
        console.error('Registration API Error:', error);
    }
}

// Login a user
async function loginUser(email, password, role) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Login failed');
        }
        
        // Verify if selected role matches database role
        if (data.user.role !== role) {
            throw new Error(`Account role is registered as ${data.user.role.toUpperCase()}. Please select the correct tab above.`);
        }
        
        // Save access token and user information in local storage
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        showSuccess(`Login successful! Welcome back, ${data.user.name}.`);
        
        // Redirect to specific role dashboards
        setTimeout(() => {
            window.location.href = `${role}_dashboard.html`;
        }, 1500);

        
    } catch (error) {
        let errMsg = error.message || 'Server connection error. Please try again.';
        if (errMsg.includes('Failed to fetch') || errMsg.includes('fetch')) {
            errMsg = '🔌 Server is offline! Please start the backend server.';
            showToast(errMsg, 'error');
        } else if (errMsg.includes('Incorrect') || errMsg.includes('Invalid') || errMsg.includes('credentials') || errMsg.includes('password') || errMsg.includes('email') || errMsg.includes('role')) {
            showToast(`❌ Details Mismatch: ${errMsg}`, 'error');
        } else {
            showToast(`❌ Login Failed: ${errMsg}`, 'error');
        }
        console.error('Login API Error:', error);
    }
}
