# 🎓 EduFlow AI — AI-Powered Education Platform

> Ek smart education platform jo Teachers, Students aur Parents ko connect karta hai AI ke through.

---

## 📖 Kya Hai Ye Project?

EduFlow AI ek **EdTech platform** hai jisme:
- **Teacher** test assign karte hain, evaluate karte hain
- **Student** quiz attempt karte hain, practice karte hain
- **Parent** apne bacche ki progress track karte hain
- **AI Mentor** automatically weak topics detect karke personalized study plan banata hai
- **Smart Alerts** sabko real-time notifications milte hain

---

## 📁 Folder Structure

```
Hackthon/
│
├── index.html              # Homepage (main landing page)
├── css/
│   ├── style.css           # Global landing page styling
│   ├── auth.css            # Split-screen login/signup styles
│   └── dashboard.css       # Unified sidebar dashboard panels styling
├── js/
│   ├── main.js             # Landing page GSAP animations
│   ├── auth.js             # Auth workflows (signup, login API, toast system)
│   ├── student_dashboard.js# Student features (AI Study Plan, Doubt Solver, Quiz engine)
│   ├── teacher_dashboard.js# Teacher analytics & Quiz generator preview/print
│   └── parent_dashboard.js # Parent child progress tracking & AI Parenting tips
├── assets/                 # Custom images and SVG assets
├── pages/                  # Views (login.html, signup.html, dashboards)
├── backend/                # Backend API Server (Python + FastAPI)
│   ├── routes/             # API Endpoints (auth.py, ai.py routers)
│   ├── controllers/        # Auth database logic & Gemini API integrations
│   ├── models/             # Pydantic schemas (validations)
│   └── config/             # lifespans event handlers and MongoDB driver config
├── README.md               # Ye file — documentation
└── .gitignore              # Git ignore configuration
```

---

## 🛠️ Tech Stack & Technologies

### 💻 Frontend (Client Side)
- **HTML5 & CSS3**: Responsive CSS Variables-based grid layouts.
- **Vanilla JavaScript**: Fetch API, dynamic DOM manipulation, and interactive state management.
- **GSAP (GreenSock)**: Premium stagger fade-up and scroll animations.
- **Boxicons**: Rich vector UI elements library.
- **Marked.js**: CDN parser for rendering rich markdown outputs from Gemini API.

### ⚙️ Backend (Server Side - Python)
- **Python 3.13 & FastAPI**: High-performance, asynchronous REST framework.
- **Uvicorn**: Lightweight ASGI web server for running local backend services.

### 🔒 Authentication & Security
- **JSON Web Tokens (JWT)**: Secure cryptographically signed session tokens (Bearer tokens) using `PyJWT`.
- **Bcrypt**: Salt-hashed storage of passwords to prevent plain-text breaches.
- **CORS Protection**: Asynchronous middleware configuration supporting client browser requests.

### 🗄️ Database
- **MongoDB**: Document-based flexible NoSQL database storing user profiles.
- **Motor**: Native asynchronous MongoDB driver for high-throughput Python database operations.

### 🤖 Artificial Intelligence
- **Google Gemini API (`gemini-1.5-flash`)**: Multi-modal queries, structured JSON generation modes, and interactive conversational engines.

---


## 🚀 Kaise Chalayein (How to Run)

### Step 1: MongoDB Start Karo
- Agar local MongoDB use kar rahe ho toh pehle usse start karo.
- Agar **MongoDB Atlas** (cloud) use kar rahe ho toh `backend/.env` mein apna connection string daalo:
  ```
  MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net
  ```

### Step 2: Backend Server Start Karo
VS Code ka terminal kholo aur ye commands chalao (**project root folder se**):

```powershell
# Virtual environment activate karo
backend\.venv\Scripts\Activate.ps1

# Server start karo
python -m uvicorn backend.main:app --reload --port 8000
```

> ✅ Jab terminal mein `Application startup complete` dikhe, toh server ready hai!
> 🌐 API Docs dekhne ke liye browser mein kholo: **http://127.0.0.1:8000/docs**

### Step 3: Frontend Open Karo
- VS Code mein **Live Server** extension install karo
- `index.html` pe right-click → **Open with Live Server**
- Ya phir directly browser mein `index.html` file open karo

### ⚡ Quick Start (Ek Line Mein Server Start)
```powershell
backend\.venv\Scripts\python -m uvicorn backend.main:app --reload --port 8000
```

> ⚠️ **Important:** Jab bhi VS Code ya system restart ho, backend server dobara start karna padega upar wali command se.

> 💡 **Gemini AI Features ke liye:** `backend/.env` mein `GEMINI_API_KEY` set karo. Free key yahan se lo: [Google AI Studio](https://aistudio.google.com/)


---

## 📄 Pages Ka Plan

| Page | Status | Description |
|---|---|---|
| Homepage | ✅ Done | Hero, Roles, Workflow, AI Features, Alerts, Stats |
| Login/Signup | ✅ Done | Role-wise dynamic login (Teacher/Student/Parent) with smooth GSAP animations and dynamic validation toast feedback |
| Student Dashboard | ✅ Done | AI Study Plan, Multimodal Doubt Solver (Text + Image), and Interactive MCQ Quiz engine |
| Teacher Dashboard | ✅ Done | Class metrics, Student Tracker, AI quiz builder preview, printable tests, and performance alerts |
| Parent Dashboard | ✅ Done | Child academic progress trendlines, Achievement badges, notification logs, and AI parenting advisor tips |

---

## 🎨 Color Palette

| Color | Hex Code | Kahan Use Hota Hai |
|---|---|---|
| Deep Navy | `#1B2A4A` | Navbar, Hero background |
| Warm Teal | `#2A9D8F` | Buttons, highlights, Student |
| Dark Teal | `#264653` | Teacher related sections |
| Warm Coral | `#E76F51` | Parent related sections |
| Deep Purple | `#6C3483` | AI features section |
| Off White | `#F8F9FA` | Page background |
| Charcoal | `#1A1A2E` | Dark sections (AI, Footer) |

---

## 🔮 Implemented Features Checklist

- [x] Login / Signup pages (role-wise authentication routing)
- [x] Backend setup (Asynchronous Python + FastAPI API engine)
- [x] Database integration (MongoDB database cluster using Motor)
- [x] AI Mentor API integration (Gemini Multimodal AI and structured JSON mode models)
- [x] Unified Toast Notification engine (Sleek glassmorphism style offline indicators)
- [x] Teacher, Student, Parent dashboards (Completed responsive HTML/CSS/JS panels)

---

## 👨‍💻 Developer Notes

- Code **clean aur readable** hai — har section mein comments hain
- CSS mein **CSS Variables** use kiye hain — color change karna easy hai
- JS mein **har function alag** hai — samajhna aur debug karna easy hai
- **Mobile-first responsive** — phone, tablet, desktop sab pe kaam karta hai

---

## 📝 License

Ye project educational purposes ke liye hai.

---

server ko start krne ke liye in backend folder .. $env:PYTHONPATH=".."
.venv\Scripts\python -m uvicorn main:app --reload --port 8000


*Made with ❤️ for Education*
