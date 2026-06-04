# 🌊 RoutineFlow

**RoutineFlow** is a minimalist, modern, and mobile-first habit tracker and task management web application. Built entirely with vanilla web technologies (HTML, CSS, JavaScript), it prioritizes user privacy by storing 100% of your data locally in your browser. No registration, no back-end servers, and no data tracking.

🌐 **Live Demo**: [https://jackycongs.github.io/routineFlow/](https://jackyCongs.github.io/routineFlow/)

---

## ✨ Key Features

- 🎨 **Modern Minimalist UI**: Features a clean glassmorphism-inspired aesthetic, fluid CSS transitions, and smart color-coded states to help you focus on active tasks instantly.
- 📅 **Advanced Recurrence Engine**: Supports both one-off tasks and complex recurring habits. You can precisely schedule tasks:
  - Weekly on specific days (e.g., Every Wednesday)
  - Monthly on specific dates (e.g., 15th of every month)
  - Bi-annually (e.g., specific dates every 6 months)
- 📁 **Seamless Subtask Management**: Parent tasks automatically transform into foldable directories. When collapsed, the parent intelligently displays a countdown badge for the most urgent hidden subtask.
- ⏳ **Smart Countdowns**: Inactive future tasks are visually subdued and display a subtle countdown badge (e.g., "3 days left"), keeping you aware without causing anxiety.
- 🔔 **Local Notifications**: Set specific reminder times (e.g., 21:00) for your tasks. The app leverages the native Browser Notification API to alert you precisely when it's time.
- 👆 **Drag & Drop Reordering**: Long-press any task to trigger intuitive drag-and-drop reordering, complete with native haptic feedback on supported Android devices.

---

## 📱 How to Use (Best Practice)

RoutineFlow embraces a **Mobile-First** design philosophy. For the optimal experience, install it as a Progressive Web App (PWA) on your mobile device:

1. **Step 1**: Open the [Live Demo](https://jackyCongs.github.io/routineFlow/) in your mobile browser (Safari for iOS, Chrome for Android).
2. **Step 2**: Tap the browser's Share/Menu button and select **"Add to Home Screen"**.
3. **Step 3**: Launch RoutineFlow from your home screen for a full-screen, immersive app experience.

### 💡 Note on Data Persistence
- All task data is stored securely in your device's `localStorage`. Clearing your browser cache will remove your tasks.
- Cloud synchronization is intentionally omitted in this version to guarantee absolute data privacy.

---

## 🛠 Tech Stack
- **HTML5**: Semantic markup, Local Storage API, Notification API.
- **Vanilla CSS**: CSS Custom Properties (Variables), Flexbox, modern gradients, and responsive design (zero CSS frameworks used).
- **Vanilla JavaScript**: DOM manipulation, custom recurrence algorithms, and state management (zero JS frameworks used).
- **SortableJS**: Smooth and responsive drag-and-drop interactions.

---

*Enjoy your flow. Stay focused and build your routines.*
