# VisitSafe Demo Implementation Plan

> Execute in the current session. Track each deliverable below and verify before reporting completion.

**Goal:** Deliver the four-entry, fully interactive WeChat Mini Program described in `VisitSafe-MiniApp-Frontend-SPEC.md` and the 12-screen mockup.

**Architecture:** Native TypeScript + WXML + WXSS pages share a small typed domain module and a local-storage repository. Page code handles navigation and forms; domain code handles validation, training matching, grading and persisted progress. No backend, authentication API or cloud service.

**Tech stack:** WeChat native components, TypeScript, Node test runner through tsx. Local MP4 lessons and vector illustration/icon assets.

## Demo decisions

- Four entry types: training, visitor, logistics, contractor. Training is a standalone multi-person form → general safety video → quiz flow, without a visitor notice, area selection or review step. Existing applications resume from the home pending link or records.
- Visitor/logistics/contractor registration has notice confirmation, editable people/vehicles, multi-select areas, and a final review. Logistics requires driver and vehicle information; contractors require trade information.
- Each application receives one task per chosen area plan and applicable logistics/construction safety plan. People and vehicles on that application share its completion.
- Each plan has short local demonstration videos and 5 single-choice questions (20 points each). Video playback or a six-second fallback countdown after loading failure must finish before an exam starts; pass mark is 80, time limit is 15 minutes.
- Retakes retain completed videos but reset answers and the timer. Back navigation, reload and expired exams retain consistent state.
- Records start empty; an explicit fill-demo-data button supplies fictitious registration fields. No real personal data or remote media is needed.

## Tasks

### 1. Domain and persistence

Files: `miniprogram/models/visit.ts`, `miniprogram/data/catalog.ts`, `miniprogram/services/visit-store.ts`, `tests/visit.test.ts`.

Interfaces: `matchPlans(type, areaIds)`, `validateRegistration(draft)`, `gradeExam(questions, answers)`, `createVisitStore(storage)`; the store exposes draft, registrations, task progress, exam attempts and deletion operations.

- [ ] Write and run failing behavior tests for four entry types, required fields, duplicate people/vehicles, area matching, video gating, grading, failed retakes, persistence and deletion.
- [ ] Implement the tested domain and storage boundary; run `npm test` and `npm run typecheck`.

### 2. Registration and records

Files: app shell, `pages/index`, `pages/registration`, existing `pages/logs`, `pages/record-detail`, shared styles/assets.

- [ ] Implement the mockup's four entry colors, notice modal, three-step registration, editable lists, area selection and review.
- [ ] Add record search/tabs, detail, resume, status and confirmed deletion.
- [ ] Verify add/edit/delete, validation, previous-step retention and successful submission in the simulator.

### 3. Learning and exams

Files: `pages/tasks`, `pages/learn`, `pages/exam`, `pages/result`, `pages/completion`, local media.

- [ ] Implement application-level tasks, native local-video playback and completion gating.
- [ ] Implement question navigation, answer retention, countdown/timeout, grading, wrong-answer review, retake and training completion.
- [ ] Verify a failed attempt followed by a passing attempt and persisted completion.

### 4. Delivery verification

Files: `README.md`, `scripts/smoke.cjs`, `doc/demo-verification.md`.

- [ ] Run type checking and all domain tests.
- [ ] Compile and exercise all four entry flows using WeChat Developer Tools; inspect console and screenshots.
- [ ] Review the implementation for data loss, repeated submissions, invalid deep links, unfinished exams and storage failures.
- [ ] Document setup, example answers, local-media limitations and actual verification results.

## Review focus

1. Repeated submit taps must not duplicate registrations/tasks.
2. Back/reload must preserve entered fields and in-progress exam answers.
3. Unanswered questions score zero; non-expired exams require all answers before submission. Expiry grades existing answers against the 80-point pass mark.
4. Deleted registrations must remove associated training tasks.
5. Invalid deep links and empty/corrupt storage must show recoverable states.
