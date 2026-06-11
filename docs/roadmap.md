# SecureWatch — Roadmap

Full story map from the requirements document, organized by phase.

For detailed feature status, see [features.md](features.md).

---

## Phase 1 — Project Foundation
- ✅ HU-00 Project initialization
- ✅ HU-01 Define base architecture
- ✅ HU-02 Configure local infrastructure
- ✅ HU-03 Create API Gateway

## Phase 2 — Security and Users
- ✅ HU-04 User registration
- ✅ HU-05 User sign-in
- ✅ HU-06 Role-based access

## Phase 3 — Cases and Evidence
- ✅ HU-07 Create case
- ✅ HU-08 List and filter cases
- ✅ HU-09 View case details
- ✅ HU-10 Update case
- ✅ HU-11 Upload evidence (multi-file + folder)
- ✅ HU-12 Validate evidence
- ✅ HU-13 Classify evidence

## Phase 4 — Distributed Orchestration
- ✅ HU-14 Create tasks automatically
- ✅ HU-15 Queue tasks in RabbitMQ
- 🔄 HU-27 Retries and dead-letter queue
- 🔄 HU-28 Cancel task or case

## Phase 5 — Workers
- ✅ HU-16 Process text
- ✅ HU-17 Process PDF documents
- ✅ HU-18 Process images
- ✅ HU-19 Process audio
- ✅ HU-20 Process archives
- ✅ HU-21 Calculate case risk score

## Phase 6 — Results
- ✅ HU-22 Generate report
- ✅ HU-23 Download and view report
- ✅ HU-26 Internal alerts (notifications)

## Phase 7 — Monitoring and Presentation
- ✅ HU-24 General dashboard
- ✅ HU-25 Real-time updates (SSE)
- ✅ HU-29 Audit trail
- ✅ HU-30 Metrics and observability
- 🔄 HU-31 Load testing
- ✅ HU-32 Project documentation
