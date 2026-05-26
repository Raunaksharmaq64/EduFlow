/* ========================================
   EduFlow AI — Main JavaScript
   ========================================
   
   YE FILE KAAM KARTA HAI:
   - GSAP scroll animations (ScrollTrigger)
   - Navbar scroll effect (transparent → solid)
   - Hamburger menu toggle (mobile)
   - Chart bar animations (hero dashboard)
   - Floating badge animations
   - Counter animations (stats section)
   - Smooth scrolling for nav links
   - Active nav link highlight on scroll
   
   DEPENDENCIES:
   - GSAP 3.x (CDN)
   - ScrollTrigger plugin (CDN)
   
   ======================================== */


/* ========================================
   DOM READY — Sab kuch tab start hoga jab page load ho jaye
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
    
    // GSAP ScrollTrigger plugin register karo
    gsap.registerPlugin(ScrollTrigger);
    
    // Sab modules initialize karo
    initNavbar();
    initHeroAnimations();
    initChartBars();
    initFloatingBadges();
    initRoleCards();
    initTimeline();
    initFeatures();
    initAlerts();
    initStats();
    initCTA();
    initSmoothScroll();
    initActiveNavOnScroll();
});


/* ========================================
   NAVBAR — Scroll effect + Hamburger menu
   ========================================
   - Scroll karne pe navbar transparent se white ho jata hai
   - Mobile pe hamburger click se menu slide-in hota hai
   ======================================== */
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // --- Scroll Effect ---
    // 50px scroll ke baad navbar mein 'scrolled' class add hoti hai
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // --- Hamburger Toggle ---
    // Click pe menu open/close hota hai
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
    
    // --- Nav Link Click ---
    // Link click pe menu close ho jata hai (mobile) aur active state update hota hai
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            
            // Active class update karo
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}


/* ========================================
   ACTIVE NAV ON SCROLL — Scroll ke saath nav link highlight
   ========================================
   - Jis section pe user hai, uska nav link highlight hota hai
   ======================================== */
function initActiveNavOnScroll() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY + 200;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + sectionId) {
                        link.classList.add('active');
                    }
                });
            }
        });
    });
}


/* ========================================
   HERO ANIMATIONS — Page load pe play hone wale animations
   ========================================
   - Text left se fade-in
   - Dashboard card bottom se fade-in
   - Floating badges pop-in with stagger
   ======================================== */
function initHeroAnimations() {
    const tl = gsap.timeline({ 
        defaults: { ease: 'power3.out' } 
    });
    
    // Hero text elements ek-ek karke appear hote hain
    tl.from('.hero-badge', {
        y: 30,
        opacity: 0,
        duration: 0.6
    })
    .from('.hero-title', {
        y: 40,
        opacity: 0,
        duration: 0.8
    }, '-=0.3')
    .from('.hero-subtitle', {
        y: 30,
        opacity: 0,
        duration: 0.6
    }, '-=0.4')
    .from('.hero-actions', {
        y: 30,
        opacity: 0,
        duration: 0.6
    }, '-=0.3')
    .from('.hero-stats-mini', {
        y: 20,
        opacity: 0,
        duration: 0.6
    }, '-=0.3')
    // Dashboard card appear hota hai
    .from('.dashboard-card', {
        y: 60,
        opacity: 0,
        scale: 0.9,
        duration: 1,
        ease: 'power2.out'
    }, '-=0.8')
    // Floating badges ek-ek karke pop hote hain
    .from('.float-badge', {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        stagger: 0.15,
        ease: 'back.out(1.7)'
    }, '-=0.4');
}


/* ========================================
   CHART BARS — Dashboard ke andar bar chart animate
   ========================================
   - Hero load hone ke 1.5 second baad bars grow hote hain
   ======================================== */
function initChartBars() {
    const bars = document.querySelectorAll('.chart-bar');
    
    // Thoda delay dete hain taaki hero animation pehle complete ho
    setTimeout(() => {
        bars.forEach((bar, index) => {
            const height = bar.getAttribute('data-height');
            gsap.to(bar, {
                height: height,
                duration: 1,
                ease: 'power2.out',
                delay: index * 0.1 // Har bar thoda delay se animate hota hai
            });
        });
    }, 1500);
}


/* ========================================
   FLOATING BADGES — Continuous float animation
   ========================================
   - Badges upar-neeche float karte rehte hain (infinite loop)
   - Dashboard card bhi subtle se float karta hai
   ======================================== */
function initFloatingBadges() {
    // Badge 1 — +23% This Week
    gsap.to('.float-badge-1', {
        y: -10,
        duration: 2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
    });
    
    // Badge 2 — AI Analyzing
    gsap.to('.float-badge-2', {
        y: 12,
        duration: 2.5,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 0.5
    });
    
    // Badge 3 — 3 New Alerts
    gsap.to('.float-badge-3', {
        y: -8,
        duration: 1.8,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 1
    });
    
    // Dashboard card — subtle float
    gsap.to('.dashboard-card', {
        y: -8,
        duration: 3,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
    });
}


/* ========================================
   ROLE CARDS — Scroll pe fade-up with stagger
   ========================================
   - Jab user roles section tak scroll karta hai, cards appear hote hain
   ======================================== */
function initRoleCards() {
    gsap.from('.role-card', {
        scrollTrigger: {
            trigger: '.roles-grid',
            start: 'top 80%',
            toggleActions: 'play none none none'
        },
        y: 60,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power3.out',
        immediateRender: false
    });
}


/* ========================================
   TIMELINE — Steps alternate sides se slide-in
   ========================================
   - Left items left se aate hain, right items right se
   - Timeline dots scale-in hote hain
   - Final (center) step neeche se aata hai
   ======================================== */
function initTimeline() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    
    timelineItems.forEach((item) => {
        const isLeft = item.classList.contains('timeline-left');
        const isCenter = item.classList.contains('timeline-center');
        const content = item.querySelector('.timeline-content');
        const dot = item.querySelector('.timeline-dot');
        
        // Content card animation
        if (content) {
            gsap.from(content, {
                scrollTrigger: {
                    trigger: item,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                },
                x: isCenter ? 0 : (isLeft ? -60 : 60),
                y: isCenter ? 40 : 0,
                opacity: 0,
                duration: 0.8,
                ease: 'power3.out',
                immediateRender: false
            });
        }
        
        // Dot scale-in animation
        if (dot) {
            gsap.from(dot, {
                scrollTrigger: {
                    trigger: item,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                },
                scale: 0,
                duration: 0.4,
                ease: 'back.out(1.7)',
                delay: 0.2,
                immediateRender: false
            });
        }
    });
}


/* ========================================
   AI FEATURES — Scale-in animation on scroll
   ========================================
   - Feature cards thoda chhote se bade hote hain with fade
   ======================================== */
function initFeatures() {
    gsap.from('.feature-card', {
        scrollTrigger: {
            trigger: '.features-grid',
            start: 'top 80%',
            toggleActions: 'play none none none'
        },
        y: 60,
        opacity: 0,
        scale: 0.9,
        duration: 0.8,
        stagger: 0.2,
        ease: 'power3.out',
        immediateRender: false
    });
}


/* ========================================
   ALERTS — Slide-up animation on scroll
   ========================================
   - Alert cards neeche se upar aate hain with stagger
   ======================================== */
function initAlerts() {
    gsap.from('.alert-card', {
        scrollTrigger: {
            trigger: '.alerts-grid',
            start: 'top 80%',
            toggleActions: 'play none none none'
        },
        y: 50,
        opacity: 0,
        duration: 0.7,
        stagger: 0.2,
        ease: 'power3.out',
        immediateRender: false
    });
}


/* ========================================
   STATS — Counter animation (numbers count up)
   ========================================
   - Jab stats section visible hota hai, numbers 0 se target tak count hote hain
   - Har stat ka apna target aur suffix hai
   ======================================== */
function initStats() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    statNumbers.forEach(stat => {
        const target = parseInt(stat.getAttribute('data-target'));
        const suffix = stat.getAttribute('data-suffix') || '';
        
        // ScrollTrigger — jab element visible ho tab counter start karo
        ScrollTrigger.create({
            trigger: stat,
            start: 'top 85%',
            onEnter: () => {
                animateCounter(stat, target, suffix);
            },
            once: true // Sirf ek baar run hoga
        });
    });
}


/* ========================================
   COUNTER ANIMATION — Number count-up helper function
   ========================================
   - 0 se target number tak smoothly count karta hai
   - Large numbers mein comma formatting lagta hai
   ======================================== */
function animateCounter(element, target, suffix) {
    let current = 0;
    const totalFrames = 60;
    const increment = target / totalFrames;
    const duration = 2000; // 2 seconds
    const stepTime = duration / totalFrames;
    
    const timer = setInterval(() => {
        current += increment;
        
        // Jab target reach ho jaye, stop karo
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        
        const value = Math.floor(current);
        
        // Format based on target type
        if (target >= 1000) {
            // Large numbers — comma formatting + "+" sign at end
            element.textContent = value.toLocaleString() + (current >= target ? '+' : '') + suffix;
        } else if (target === 24) {
            // "24/7" format
            element.textContent = value + suffix;
        } else if (target === 95) {
            // "95%" format
            element.textContent = value + suffix;
        } else {
            // Default — number + suffix with "+"
            element.textContent = value.toLocaleString() + (current >= target ? '+' : '') + suffix;
        }
    }, stepTime);
}


/* ========================================
   CTA SECTION — Fade-in animation
   ======================================== */
function initCTA() {
    gsap.from('.cta-container', {
        scrollTrigger: {
            trigger: '.cta',
            start: 'top 80%',
            toggleActions: 'play none none none'
        },
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        immediateRender: false
    });
}


/* ========================================
   SMOOTH SCROLL — Nav links pe click se smooth scroll
   ========================================
   - Anchor links (#section) pe click hone pe page smooth scroll karta hai
   - 80px offset diya hai navbar height ke liye
   ======================================== */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            
            // Empty hash ignore karo
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const navbarHeight = 80;
                const targetPosition = targetElement.offsetTop - navbarHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}
