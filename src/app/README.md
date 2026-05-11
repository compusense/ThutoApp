# Thuto - School Management System

**Thuto** (meaning "Education" in Setswana) is a modern, centralized, and role-based web application designed to digitize and streamline school administration in Botswana. It provides a single source of truth for educational data, from student registries to regional performance metrics, while leveraging Generative AI to empower educators.

## 1. Project Overview

### The Problem
Managing educational institutions often involves heavy administrative overhead, manual record-keeping, and disconnected data. This leads to inefficiencies, potential for human error, and a lack of real-time data for strategic decision-making at the school and regional levels.

### The Solution
Thuto provides a tailored experience for every user in the educational hierarchy. By digitizing manual processes and integrating advanced AI tools, it reduces teacher workload and provides administrators with accurate, actionable insights.

---

## 2. Core Functionalities by Role

### 👤 Super Admin (System Architect)
*   **Organizational Hierarchy:** Define and manage the geographical structure (Regions and Sub-Regions).
*   **School Management:** Create schools and link them to specific sub-regions.
*   **User Lifecycle:** Manage accounts for all staff levels, including deactivation and password resets via email.
*   **Curriculum Foundation:** Maintain the master list of academic subjects for Primary and Secondary levels.
*   **Syllabus Builder:** Construct detailed, hierarchical syllabi containing Modules, Topics, and specific Learning Objectives.
*   **Billing & Usage:** Monitor project costs and usage across Firebase services (Storage, Hosting, Gemini AI).

### 区域 Sub-Region Admin (Regional Oversight)
*   **Staff Directory:** Search and view detailed profiles and academic "track records" of all teachers in the sub-region.
*   **Results Analysis:** 
    *   **Sub-Region Summary:** Compare performance across all schools for any assessment period.
    *   **Drill-Down:** Click into a school to view class-level performance summaries.
*   **Exam Management:** 
    *   **Timetables:** Design structured digital timetables or upload document-based ones for regional exams.
    *   **Material Distribution:** Upload exam papers and mark schemes to be distributed to all schools.
*   **Dynamic Data Collection:** Create custom tabular forms (surveys) for School Heads to submit specific data (e.g., textbook inventories).

### 🏫 School Head (School Command Center)
*   **Dashboard Analytics:** Real-time stats on School Roll, Staff counts, gender distribution, and upcoming action plan events.
*   **Student Registry:** 
    *   **Lifecycle Management:** Add, edit, and manage student status (Active, Transferred, Dropped Out, etc.).
    *   **Student Portability:** Move students between classes or handle transfers while preserving history.
    *   **Bulk Import/Export:** Import student data via CSV and export the entire registry.
*   **Student Accounts:** Generate login credentials and manage password resets for learners.
*   **Class Management:** Create classes per academic year, assign class teachers, and allocate subjects.
*   **Registry Cleaning:** Identify and assign "unassigned" students to classes.
*   **Performance Metrics:** 
    *   **Results Summary:** View school-wide aggregated results with gender breakdowns.
    *   **Results Metrics:** Compare subject performance across different classes.
    *   **Tracking:** Track individual student performance trends over multiple years/terms.
*   **Exam Logistics:** Assign teachers to invigilate exams for classes other than their own.
*   **Action Plans:** Build and maintain the school's termly calendar of events.

### 👩‍🏫 Teacher (Classroom Empowerment)
*   **AI Mark Sheet Scanner:** Batch-grade multiple-choice answer sheets using Gemini Vision. Includes name-matching with the registry and a verification view to compare AI results with original scans.
*   **AI-Powered Planning:** 
    *   **Lesson Notes:** Generate classroom-ready notes from syllabus topics using Genkit.
    *   **Quiz Generation:** Automatically create interactive quizzes based on the content of lesson notes.
*   **Class Activities:** Manage lesson notes, upload supporting images, and assign them (or quizzes) to students.
*   **Mark Entry:** 
    *   **Spreadsheet Interface:** High-speed mark entry with keyboard navigation and **Auto-save**.
    *   **CSV Integration:** Download pre-populated templates and upload completed mark sheets.
*   **Reporting:** 
    *   **Progress Reports:** Generate official printable reports for parents.
    *   **AI Remarks:** Generate personalized, constructive teacher remarks for every student using performance data.
    *   **Continuous Assessment:** Generate a single-page view of every test/exam result for a student throughout the year.
*   **Past Papers:** Access exam materials published by the Sub-Region for revision.

### 🎓 Student (Learner Portal)
*   **Personal Dashboard:** View profile summary and the list of subjects currently being taken.
*   **My Class:** Access lesson notes published by teachers and take interactive quizzes to test knowledge.
*   **My Results:** View and print end-of-term progress reports.
*   **Security:** Manage personal login security by changing passwords.

---

## 3. Technical Pillars

### Frontend
*   **Framework:** [Next.js 15](https://nextjs.org/) (App Router)
*   **UI Components:** [ShadCN/UI](https://ui.shadcn.com/) & [Tailwind CSS](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Charts:** [Recharts](https://recharts.org/)

### Backend & Security
*   **Database:** [Cloud Firestore](https://firebase.google.com/docs/firestore) (NoSQL)
*   **Authentication:** [Firebase Auth](https://firebase.google.com/docs/auth) with Custom Claims for Role-Based Access Control (RBAC).
*   **Storage:** [Firebase Storage](https://firebase.google.com/docs/storage) for exam materials, assets, and scans.
*   **Server Logic:** [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) for secure database mutations.

### Generative AI
*   **Framework:** [Genkit v1.x](https://firebase.google.com/docs/genkit)
*   **Model:** **Gemini 2.5 Flash** for content generation and vision analysis.

---

## 4. Key Implementation Details

### Precision in Performance Metrics
*   **Sitting Roll Logic:** Students who are absent (no marks recorded) are excluded from pass rates and averages to ensure metrics reflect actual classroom performance.
*   **Immutable Snapshots:** When marks are saved, the system generates a result snapshot. This snapshot serves as the "Source of Truth" for all reporting, ensuring historical consistency even if students move classes later.
*   **Cohort Tracing:** The dashboard trend charts trace a specific student cohort's performance back through their promotion history, regardless of class ID changes.

### Uniform Grading Scale
Thuto follows a standardized Botswana-aligned grading boundary:
*   **A (Excellent):** 80% and above
*   **B (Very Good):** 65% - 79%
*   **C (Good):** 50% - 64%
*   **D (Fair):** 30% - 49%
*   **E (Unsatisfactory):** Below 30%

### Global Entity Search
A fast, role-aware search bar in the header allows users to find students, staff members, or schools instantly, providing quick-action links based on their permissions.
