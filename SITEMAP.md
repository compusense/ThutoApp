# Thuto - Application Sitemap

This document outlines the hierarchical structure and available routes in the Thuto School Management System.

## 🔑 Public Routes
- `/login` - User authentication portal.

## 👤 Super Admin Portal (`/super-admin`)
- `/super-admin/dashboard` - Global system statistics.
- `/super-admin/users` - User account management (Create/Edit/Deactivate).
- `/super-admin/regions` - Geographical region management.
- `/super-admin/sub-regions` - Sub-region management.
- `/super-admin/schools` - School registry and Headteacher assignment.
- `/super-admin/subjects` - Master curriculum subject list.
- `/super-admin/syllabus` - Hierarchical syllabus builder (Modules/Topics/Objectives).
- `/super-admin/games/review` - Third-party game approval workflow.
- `/super-admin/billing-explanation` - Detailed Firebase/GCP cost breakdown.
- `/super-admin/billing/[service]` - Detailed usage analytics for specific cloud services.

## 🗺️ Sub-Region Admin Portal (`/sub-region-admin`)
- `/sub-region-admin/dashboard` - Regional overview.
- `/sub-region-admin/staff` - Regional staff directory with performance tracking.
- `/sub-region-admin/results` - Comparative school performance analytics.
- `/sub-region-admin/exam-management` - Timetable creation and material distribution.
- `/sub-region-admin/details` - Personal profile management.

## 🏫 School Head Portal (`/school-head`)
- `/school-head/dashboard` - School-wide real-time analytics.
- `/school-head/action-plans` - Termly school calendar and events.
- `/school-head/teachers` - Staff registry for the specific school.
- `/school-head/students` - Student registry with bulk CSV import/export.
- `/school-head/students/[studentId]/marks` - Record-level removal of student assessment marks.
- `/school-head/classes` - Class creation, subject allocation, and teacher assignment.
- `/school-head/results` - Detailed class-level results snapshots.
- `/school-head/results-summary` - Aggregated school performance summaries.
- `/school-head/results-metrics` - Subject-specific performance comparisons.
- `/school-head/results-tracking` - Individual student progress over multiple years.
- `/school-head/invigilation` - External exam invigilation assignments.
- `/school-head/promotions` - Automated end-of-year student movements.
- `/school-head/exam-management` - Access to regional timetables and papers.

## 👩‍🏫 Teacher Portal (`/teacher`)
- `/teacher/dashboard` - Personalized classroom overview and calendar.
- `/teacher/my-classes` - View class rolls and students.
- `/teacher/syllabus` - Explorer for grade-specific curriculum.
- `/teacher/notes` - Lesson note management and classroom activities.
- `/teacher/scanner` - AI-powered multiple-choice mark sheet scanner.
- `/teacher/reports` - Termly progress report generation.
- `/teacher/class-reports` - Narrative-based comprehensive class reporting.
- `/teacher/invigilation` - Data entry for invigilated exams.
- `/teacher/results` - Performance analytics for assigned classes.
- `/teacher/students/[studentId]/marks` - Detailed academic history for an individual student.
- `/teacher/results-metrics` - Compare subject performance across your classes.
- `/teacher/results-tracking` - Trace student progress over time.
- `/teacher/past-exam-papers` - Repository for revision materials.
- `/teacher/details` - Professional profile and photo management.

## 🎓 Student Portal (`/student`)
- `/student/dashboard` - Personal academic overview.
- `/student/my-classes` - Access to assigned notes, classmates, and subjects.
- `/student/results` - Personal termly progress reports.
- `/student/games` - Educational game center.
- `/student/games/tug-of-war` - Real-time multiplayer math battle.
- `/student/details` - Account settings and password management.

## 💻 Developer Portal (`/developer`)
- `/developer/dashboard` - Game submission tracking and analytics.
- `/developer/games/upload` - HTML5 game upload and sandbox testing.
- `/developer/games/[gameId]/edit` - Modify metadata or upload a new version of an existing game.

## 📋 Universal Features
- `/forms` - Dynamic data collection forms for administrative surveys.
