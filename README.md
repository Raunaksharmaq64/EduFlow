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
├── index.html              # Homepage (main page)
├── css/
│   ├── style.css           # Saare styles yahan hain
│   └── auth.css            # Login/Signup page styling
├── js/
│   ├── main.js             # GSAP animations aur interactions
│   └── auth.js             # Login/Signup animations aur form validation
├── assets/                 # Images aur custom assets
├── pages/                  # Pages (login.html, signup.html, etc.)
├── backend/                # Backend code (Node.js/Express)
│   ├── routes/             # API routes
│   ├── controllers/        # Business logic
│   ├── models/             # Database models
│   ├── middleware/         # Auth middleware etc.
│   └── config/             # DB config, environment setup
├── README.md               # Ye file — documentation
└── .gitignore              # Git ignore rules
```

---

## 🛠️ Tech Stack

| Technology | Kaam Kya Karta Hai |
|---|---|
| **HTML5** | Page ka structure |
| **CSS3** | Styling — colors, layout, responsive design |
| **JavaScript** | Logic aur interactions |
| **GSAP** | Smooth scroll animations (CDN se load hota hai) |
| **Boxicons** | Icons ke liye (CDN se load hota hai) |
| **Google Fonts (Inter)** | Clean, modern font |

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
| Login/Signup | 🔜 Coming | Role-wise login (Teacher/Student/Parent) |
| Teacher Dashboard | 🔜 Coming | Test create, evaluate, class analytics |
| Student Dashboard | 🔜 Coming | Quiz attempt, study plan, doubt solver |
| Parent Dashboard | 🔜 Coming | Child progress, alerts, reports |

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

## 🔮 Future Plans

- [ ] Login / Signup pages (role-wise)
- [ ] Backend setup (Node.js + Express)
- [ ] Database integration (MongoDB)
- [ ] AI Mentor API integration
- [ ] Real-time notifications (Socket.io)
- [ ] Teacher, Student, Parent dashboards

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

*Made with ❤️ for Education*
