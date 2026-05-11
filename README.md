# Thuto - School Management System

**Thuto** (meaning "Education" in Setswana) is a modern, centralized, and role-based web application designed to digitize and streamline school administration in Botswana. It provides a single source of truth for educational data, from student registries to regional performance metrics, while leveraging Generative AI to empower educators and real-time multiplayer games to engage learners.

---

## 1. Core Functionalities by Role

### 👤 Super Admin (System Architect)
*   **Organizational Hierarchy:** Define and manage the geographical structure (Regions and Sub-Regions).
*   **School Management:** Create schools and link them to specific sub-regions.
*   **User Lifecycle:** Manage accounts for all staff levels, including deactivation and password resets.
*   **Curriculum Foundation:** Maintain the master list of academic subjects and detailed hierarchical syllabi.
*   **Content Governance:** Review and approve educational games submitted by third-party developers.

### 区域 Sub-Region Admin (Regional Oversight)
*   **Staff Directory:** Search and view detailed profiles and academic "track records" of all teachers in the sub-region.
*   **Results Analysis:** Compare performance across all schools with drill-down capabilities to class-level summaries.
*   **Exam Logistics:** Design digital timetables and distribute exam papers to all schools instantly.
*   **Dynamic Surveys:** Create custom tabular forms to collect specific data (e.g., textbook inventories) from School Heads.

### 🏫 School Head (School Command Center)
*   **Dashboard Analytics:** Real-time stats on School Roll, Staff counts, and upcoming action plan events.
*   **Registry Management:** Lifecycle management for students (Active, Transferred, Dropped Out) with bulk CSV import/export.
*   **Academic Operations:** Create classes per year, assign class teachers, and allocate subjects.
*   **Performance Tracking:** Trace individual student performance trends over multiple years and terms.

### 👩‍🏫 Teacher (Classroom Empowerment)
*   **AI Mark Sheet Scanner:** Batch-grade multiple-choice answer sheets using Gemini Vision. Includes automatic name-matching with the school registry.
*   **AI-Powered Planning:** Generate classroom-ready lesson notes and interactive quizzes from syllabus topics using Genkit.
*   **High-Speed Marking:** Spreadsheet-style mark entry with **Auto-save** and keyboard navigation.
*   **Reporting:** Generate official printable progress reports with personalized, AI-generated teacher remarks.

### 🎓 Student (Learner Portal)
*   **My Class:** Access lesson notes published by teachers and take interactive quizzes to test knowledge.
*   **My Results:** View and print termly progress reports directly from the portal.
*   **Game Center:** Play approved educational games or battle classmates in the **Real-Time Math Tug of War**.

### 💻 Developer (Third-Party Integration)
*   **Game Sandbox:** Upload and manage HTML5/JavaScript educational games.
*   **Student View:** Test games in the exact sandboxed environment used by students before submission.
*   **Performance Tracking:** Monitor play counts and session analytics for published games.

---

## 2. Advanced Features

### 🤖 Generative AI (Genkit & Gemini)
*   **Vision-Based Marking:** Analyzes photos of hand-written answer sheets to extract scores.
*   **Content Generation:** Transforms dry syllabus objectives into engaging, locally-relevant lesson notes.
*   **Personalized Remarks:** Analyzes performance data to write constructive student feedback.

### ⚔️ Real-Time Multiplayer (Math Tug of War)
*   **Smart Matchmaking:** Automatically pairs students into math battles.
*   **Live Sync:** Uses Firestore real-time listeners to synchronize rope-pulling animations and scores.
*   **Competitive Ranking:** A global leaderboard tracks "Global Points" earned through speed and accuracy.

---

## 3. Technical Stack

*   **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), [React 18](https://reactjs.org/), [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components:** [ShadCN/UI](https://ui.shadcn.com/), [Lucide React](https://lucide.dev/), [Recharts](https://recharts.org/)
*   **Backend:** [Firebase Authentication](https://firebase.google.com/docs/auth), [Cloud Firestore](https://firebase.google.com/docs/firestore), [Cloud Storage](https://firebase.google.com/docs/storage)
*   **AI Framework:** [Genkit v1.x](https://firebase.google.com/docs/genkit) using **Gemini 2.5 Flash**

---

## 4. Setup & Environment

Ensure the following environment variables are configured:
```env
GOOGLE_GENAI_API_KEY=your_key_here
```

### Deployment Configuration
The app uses **Firebase App Hosting** for the frontend and **Cloud Run** for server-side logic. Security is enforced via **Firestore Security Rules** with custom claims-based Role-Based Access Control (RBAC).

---

## 5. Botswana Educational Alignment
*   **Botswana Grading Scale:** A (80%+), B (65-79%), C (50-64%), D (30-49%), E (<30%).
*   **Hierarchy:** Aligned with Regional and Sub-Regional office structures.
*   **Localization:** AI generation is tuned to use local examples (Pula/Thebe, local landmarks, and curriculum terms).
