LabPlay

Standalone, integration-first interactive lab platform for isolated coding and Linux exercises.


<img width="1920" height="801" alt="Screenshot (1636)" src="https://github.com/user-attachments/assets/d46e3741-a206-4ded-95a3-b95c7a3a2498" />


LabPlay is a standalone lab player designed to be launched from another application through a signed server-to-server integration.

A partner application chooses the learner and lab. LabPlay verifies the launch request, creates an Attempt, provisions a dedicated Docker sandbox, presents the current task, executes and grades work asynchronously, and returns the final result to the partner application through a signed webhook.

The project is intentionally built around real backend and DevOps concerns rather than a simple CRUD flow: application integration, asymmetric cryptography, short-lived browser handoff, distributed queues, worker processing, per-attempt sandbox lifecycle, WebSocket terminals, asynchronous grading, idempotency, resource isolation, cleanup, observability, and versioned lab content.

Table of Contents

Why LabPlay

Key Features

System Architecture

Core Flows

Sandbox Security Model

Queue and Worker Model

Domain Model

Lab Versioning

Technology Stack

Repository Structure

Local Development

Environment Configuration

API Overview

Partner Integration

Observability

Testing Strategy

Production Deployment

Scaling Model

Production Hardening Checklist

Roadmap

Project Status

Why LabPlay

Interactive learning platforms have a deceptively difficult infrastructure problem:

learner code must not execute directly inside the public API process;

each learner needs an isolated workspace;

lab state must survive multiple Run/Check requests during an Attempt;

browsers must never receive partner private keys, Docker credentials, hidden checkers, or Runner credentials;

long-running work must not block HTTP requests;

completed attempts need reliable result delivery back to the system that launched them;

lab content must be versioned so an in-progress Attempt never changes underneath the learner.

LabPlay separates these concerns into explicit services and security boundaries.

Key Features

Integration-first launch

Server-to-server partner launch.

RS256-signed JWT verification.

issuer, audience, kid, expiration and maximum-token-age validation.

Redis-backed jti replay protection.

One-time opaque launch code instead of placing the partner JWT in the browser URL.

Short-lived LabPlay session stored in an HttpOnly cookie.

Per-Attempt isolated runtime

A new Attempt represents one learner running one concrete lab version.

Each active Attempt can receive its own Docker sandbox.

Persistent workspace volume for the duration of the Attempt.

Lifecycle: provision → active → complete/expire → destroy.

Asynchronous execution

Redis-backed BullMQ queues.

Separate workers for provisioning, grading, result delivery, and cleanup.

Retry/backoff semantics for transient failures.

Small job payloads; MongoDB remains the business source of truth.

Coding labs

Monaco-based browser editor.

Starter files.

Run versus Check separation.

Server-trusted hidden checker.

Asynchronous submission execution and polling.

Structured learner feedback.

Linux labs

Browser terminal powered by xterm.js.

Short-lived terminal ticket.

WebSocket Terminal Gateway.

Authenticated Gateway-to-Runner connection.

Linux shell attached to the learner's existing Attempt container.

State-based checking instead of checking shell command history.

Admin application

Dedicated admin frontend.

Lab creation and task management.

Coding and Linux task types.

Draft / published / archived lifecycle.

Immutable published lab versions.

New draft versions created from existing published versions.

Completion delivery

Completion score/status.

Signed outbound webhook.

Retryable result-delivery queue.

Registered partner callback URL and return URL.

Sandbox cleanup after completion or expiry.

System Architecture

flowchart LR
    P[Partner Application] -->|RS256 launch JWT| API[LabPlay API]
    API --> M[(MongoDB)]
    API --> R[(Redis)]
    API -->|enqueue jobs| Q[BullMQ Queues]

    B[Learner Browser] -->|launch exchange / session cookie| API
    B -->|REST| API
    B -->|WebSocket + terminal ticket| TG[Terminal Gateway]

    Q --> W[Workers]
    W -->|private authenticated HTTP| RN[Runner]
    TG -->|private authenticated WebSocket| RN

    RN --> D[Docker Engine]
    D --> S1[Attempt Sandbox A]
    D --> S2[Attempt Sandbox B]
    D --> S3[Attempt Sandbox N]

    W --> M
    W --> R
    W -->|signed completion webhook| P
    A[Admin Frontend] -->|Admin API| API

Service responsibilities

Component

Responsibility

Learner Frontend

Launch exchange, lab UI, task progress, Monaco editor, Linux terminal

Backend API

Authentication, integration verification, domain rules, sessions, API orchestration

MongoDB

Durable business state: labs, tasks, attempts, submissions, partner configuration

Redis

BullMQ transport/state, one-time launch codes, replay protection, rate-limit counters

BullMQ Workers

Provisioning, grading, webhook delivery, sandbox cleanup

Runner

Privileged sandbox control plane; talks to Docker for learner workloads

Terminal Gateway

Authenticated WebSocket bridge between browser terminal and Runner

Docker Sandboxes

Isolated execution environment per Attempt

Admin Frontend

Lab/task authoring, publishing and version management

Core Flows

1. Partner launch

sequenceDiagram
    participant Partner as Partner Backend
    participant API as LabPlay API
    participant Redis
    participant Mongo as MongoDB
    participant Queue as BullMQ
    participant Browser

    Partner->>API: POST /api/v1/integrations/launch + Bearer JWT
    API->>API: Resolve partner by iss / kid
    API->>API: Verify RS256 signature + iss + aud + age
    API->>Redis: SET launch:jti:* NX EX
    API->>Mongo: Create Attempt
    API->>Mongo: Create TaskAttempt states
    API->>Queue: Enqueue provision-attempt
    API->>Redis: Store hash(one-time-code) -> Attempt
    API-->>Partner: launchUrl + attemptId
    Partner-->>Browser: Redirect to launchUrl

The browser never receives the partner private key and does not need the original launch JWT.

2. Browser handoff

Partner receives launchUrl
        ↓
Browser opens /launch?code=<opaque-code>
        ↓
POST /api/v1/auth/exchange
        ↓
Redis GETDEL consumes the one-time code
        ↓
LabPlay creates a session token
        ↓
Browser receives HttpOnly lab_session cookie
        ↓
Frontend navigates to /lab
        ↓
GET /api/v1/attempts/current

The one-time code is deliberately opaque: it contains no meaningful learner or lab claims. It only maps to short-lived server-side state in Redis.

3. Sandbox provisioning

Attempt created with status=provisioning
        ↓
sandbox-provision queue
        ↓
Provision Worker
        ↓
Load Attempt + Lab from MongoDB
        ↓
RunnerClient.provision(...)
        ↓
POST Runner /v1/sandboxes
        ↓
Docker volume + container
        ↓
Attempt:
  sandboxStatus=ready
  status=active

Provisioning is asynchronous; the launch HTTP request does not directly create the container.

4. Run / Check

Learner presses Run or Check
        ↓
POST /api/v1/submissions
        ↓
Submission(status=queued)
        ↓
submission-grade queue
        ↓
Grading Worker
        ↓
Runner /v1/grade
        ↓
Existing Attempt sandbox
        ↓
Execution + trusted checker
        ↓
Submission result persisted
        ↓
Frontend polls GET /submissions/:id

Run is exploratory execution and does not advance task state.

Check is authoritative grading. A passing Check marks the current TaskAttempt as passed and activates the next task.

5. Linux terminal

sequenceDiagram
    participant Browser
    participant API
    participant Gateway as Terminal Gateway
    participant Runner
    participant Docker as Attempt Container

    Browser->>API: POST /attempts/current/terminal-ticket
    API-->>Browser: short-lived terminal JWT
    Browser->>Gateway: WebSocket ?ticket=...
    Gateway->>Gateway: Verify ticket
    Gateway->>Runner: Authenticated private WebSocket
    Runner->>Docker: docker exec /bin/bash
    Docker-->>Runner: terminal byte stream
    Runner-->>Gateway: byte stream
    Gateway-->>Browser: byte stream

The browser never receives RUNNER_API_TOKEN and never connects directly to the Docker daemon.

6. Completion and cleanup

All TaskAttempts passed
        ↓
POST /attempts/current/finish
        ↓
Attempt completed + score stored
        ↓
result-delivery job
        ↓
HMAC-signed webhook to partner callback URL
        ↓
sandbox-cleanup job
        ↓
Runner removes container + workspace volume
        ↓
Browser may return to registered partner return URL

Attempts also have an expiry path so abandoned sandboxes can be reclaimed.

Sandbox Security Model

Important: Docker isolation is useful, but plain containers should not be treated as the final security boundary for hostile multi-tenant Internet workloads. See the production hardening section below.

Current sandbox controls include:

--network none;

memory limits;

CPU limits;

PID/process limits;

--cap-drop ALL;

no-new-privileges;

read-only root filesystem;

dedicated writable workspace volume;

bounded /tmp tmpfs;

non-root runtime user according to sandbox profile;

deterministic LabPlay-owned container and volume names;

labels tying a sandbox to an Attempt;

learner file path validation;

internal Runner Bearer-token authentication;

terminal access restricted to known LabPlay-managed Linux sandboxes.

Current Runner defaults:

Memory:      256 MB
CPU:         0.5
PID limit:   64
Network:     disabled
Root FS:     read-only
/tmp:        64 MB tmpfs

Current profile concepts include node-basic and linux-basic. The profile selects the image, runtime user, work directory and writable volume target.

Queue and Worker Model

LabPlay uses four BullMQ queues:

Queue

Trigger

Worker responsibility

sandbox-provision

New Attempt

Create sandbox and mark Attempt ready

submission-grade

Run / Check

Execute learner work and trusted checker

result-delivery

Completed Attempt

Deliver signed completion webhook

sandbox-cleanup

Completion / expiry

Destroy container and workspace volume

Jobs use retry/backoff semantics. Job payloads intentionally carry identifiers rather than duplicating the domain model.

await provisionQueue.add(
  "provision-attempt",
  { attemptId: attempt.id },
  { jobId: `attempt-${attempt.id}` }
);

Workers reload current business state from MongoDB before acting. This keeps MongoDB as the durable source of truth and Redis/BullMQ as the asynchronous transport and job-state layer.

Domain Model

IntegrationPartner

External application allowed to launch labs.

Stores concepts such as:

issuer;

active public launch keys (kid, public key);

callback URL;

return URL;

encrypted webhook secret;

partner status.

Lab

Versioned learning content.

slug

title

track

version

sandboxProfile

status: draft | published | archived

Tracks include linux, frontend, backend, and algorithms.

Task

Defines what must be completed: order, instructions, starter files, language, hints, trusted checker and resource limits.

Attempt

Represents one learner running one concrete lab version.

Partner
  +
External learner
  +
Lab version
  +
Current task
  +
Sandbox
  +
Progress
  +
Expiry

Typical lifecycle:

provisioning → active → completing → completed
                     ↘ failed / expired

TaskAttempt

Learner-specific state for one Task inside one Attempt: locked, active, passed, tries and hint progress.

Submission

One Run or Check request.

queued → running → passed
                 → failed
                 → system_error

WebhookDelivery

Reliable delivery state for completion events sent to the partner.

Lab Versioning

Published lab content is treated as immutable.

Lab v1 — published
        ↓
Create new version
        ↓
Lab v2 — draft
        ↓
Edit tasks
        ↓
Publish v2
        ↓
v1 archived
v2 published

An Attempt remains connected to the exact Lab version it started with. Publishing a new version does not silently alter an in-progress learner experience.

Technology Stack

Frontend

React

Vite

React Router

Axios

Monaco Editor

xterm.js

Backend

Node.js

Express

Mongoose

JOSE

Zod

Pino

Prometheus client

Helmet

cookie-parser

Async / State

Redis

BullMQ

Execution

Docker

Dockerode / Docker CLI integration

WebSockets

Persistence

MongoDB

Repository Structure

.
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── queues/
│   │   ├── routes/
│   │   ├── runners/
│   │   ├── security/
│   │   ├── services/
│   │   ├── validation/
│   │   ├── workers/
│   │   └── dev/
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/
│       ├── lib/
│       └── store/
├── admin/
│   └── frontend/
├── runner/
│   └── src/
├── terminal-gateway/
│   └── src/
├── infra/
│   └── k8s/
├── docs/
└── docker-compose.yml

Local Development

Prerequisites

Node.js 22+

npm

Docker Desktop / Docker Engine

MongoDB

Redis

The local environment uses several processes because API, workers, Runner, learner UI, admin UI and Terminal Gateway have separate responsibilities.

Default local ports

Service

Port

Learner frontend

5173

Admin frontend

5174

Backend API

4000

Terminal Gateway

4080

Runner

7070

Redis

6379

MongoDB

27017

Install dependencies

cd backend && npm install
cd ../frontend && npm install
cd ../runner && npm install
cd ../terminal-gateway && npm install
cd ../admin/frontend && npm install

Start infrastructure

Start Docker Desktop first. Ensure MongoDB and Redis are available. If using the repository Compose setup:

docker compose up -d

Start the Backend API

cd backend
npm run dev

API: http://localhost:4000

Start BullMQ Workers

cd backend
npm run worker

Start the Runner

cd runner
npm run dev

Health: http://localhost:7070/health

Start the Terminal Gateway

cd terminal-gateway
npm run dev

Local URL: http://localhost:4080

Start the Learner Frontend

cd frontend
npm run dev

Learner UI: http://localhost:5173

Start the Admin Frontend

cd admin/frontend
npm run dev

Admin UI: http://localhost:5174

Seed development data

For a fresh development database:

cd backend
node src/dev/seedDev.js

Development keys and secrets are only for local testing. Never reuse them in production.

Create a development launch

cd backend
npm run dev:launch -- <lab-slug>

Example:

npm run dev:launch -- javascript-first-lab

The development launch script simulates a partner backend: it signs a short-lived launch JWT, calls the LabPlay integration endpoint and prints a one-time launch URL.

Environment Configuration

Never commit production secrets.

Backend API / Workers

NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://...
REDIS_URL=redis://...
CLIENT_ORIGINS=http://localhost:5173,http://localhost:5174
PUBLIC_APP_URL=http://localhost:5173
INTEGRATION_AUDIENCE=skilllab-launch
SESSION_SECRET=<minimum-32-character-secret>
SESSION_TTL_SECONDS=7200
EXTERNAL_ID_PEPPER=<minimum-32-character-secret>
PARTNER_SECRET_KEK_B64=<base64-encoded-32-byte-key>
RUNNER_BASE_URL=http://localhost:7070
RUNNER_API_TOKEN=<internal-runner-token>
TERMINAL_TICKET_SECRET=<minimum-32-character-secret>
TERMINAL_GATEWAY_URL=ws://localhost:4080
WEBHOOK_MAX_ATTEMPTS=12
ADMIN_SESSION_SECRET=<minimum-32-character-secret>
ADMIN_SESSION_TTL_SECONDS=28800
LOG_LEVEL=info

Runner

RUNNER_PORT=7070
RUNNER_API_TOKEN=<same-internal-runner-token>
RUNNER_IMAGE=node:22-alpine
RUNNER_LINUX_IMAGE=labplay-linux-basic:1.0
RUNNER_MEMORY_MB=256
RUNNER_CPUS=0.5
RUNNER_PIDS_LIMIT=64

Terminal Gateway

TERMINAL_GATEWAY_PORT=4080
TERMINAL_TICKET_SECRET=<same-terminal-ticket-secret>
RUNNER_TERMINAL_WS_BASE=ws://localhost:7070
RUNNER_API_TOKEN=<same-internal-runner-token>

Learner Frontend

VITE_API_BASE_URL=http://localhost:4000

Use a dedicated secret manager in production; .env files are a development convenience, not a production secret-management strategy.

API Overview

All learner/integration routes are mounted under /api/v1.

Integration

Method

Route

Purpose

POST

/integrations/launch

Verify partner JWT and create an Attempt

POST

/auth/exchange

Exchange one-time code for LabPlay session

Attempt

Method

Route

Purpose

GET

/attempts/current

Return session-authorized current Attempt view

POST

/attempts/current/tasks/:taskId/hint

Reveal an allowed hint

POST

/attempts/current/terminal-ticket

Create a short-lived terminal ticket

POST

/attempts/current/finish

Complete the Attempt after all tasks pass

Submissions

Method

Route

Purpose

POST

/submissions

Queue Run/Check work

GET

/submissions/:submissionId

Read asynchronous grading status/result

Admin

Admin routes are mounted under /api/v1/admin and manage lab content, tasks, publishing and versions behind the admin authentication boundary.

Partner Integration

Trust model

The partner owns an RSA private key. LabPlay stores only the corresponding public key and kid.

Partner PRIVATE KEY
      ↓ signs
Launch JWT
      ↓
LabPlay PUBLIC KEY
      ↓ verifies
Trusted launch payload

A launch contains claims similar to:

{
  "sub": "partner-learner-id",
  "lab_slug": "linux-basics",
  "assignment_id": "assignment-001",
  "iss": "https://partner.example",
  "aud": "skilllab-launch",
  "jti": "unique-token-id"
}

LabPlay validates the allowed algorithm, issuer, audience, token age/expiration, active kid, signature, required claims and jti replay protection.

Why the browser receives an opaque code

URLs can leak into browser history, logs, analytics and referrers. After server-to-server verification LabPlay therefore generates a random one-time code.

hash(code) -> { attemptId, partnerId }

The browser sees only:

/launch?code=<one-time-value>

The code has a short TTL and is consumed atomically during /auth/exchange.

Browser session

After exchange, LabPlay stores the session in an HttpOnly cookie. Browser JavaScript does not need direct access to the token. The backend derives the current Attempt from the verified session rather than trusting an arbitrary Attempt ID from the browser.

Observability

Useful production metrics include:

HTTP request count, error rate and p50/p95/p99 latency;

queue depth, queue wait time, failures and retries;

sandbox provisioning latency and active sandbox count;

grading runtime and system-error rate;

lab starts, completion rate, pass rate, tries and hint usage;

launch rejection/replay counts;

webhook success/retry/dead counts;

Redis memory/latency;

MongoDB connection pool and slow queries;

Runner CPU/memory saturation.

Avoid logging complete learner terminal sessions or source code by default. Learners can accidentally paste credentials into an editor or terminal. Prefer structured metadata and bounded outputs.

Testing Strategy

A production-grade validation strategy should cover:

Unit

Session signing/verification, webhook signatures, secret encryption/decryption and validation helpers.

Service

Task ordering, completion rules, partner-launch replay rejection and one-time code behavior.

API

Session exchange, Origin checks, rate limiting, ownership boundaries and correct error status behavior.

Worker

Provision success/failure, grading pass/fail/system-error, retries, next-task activation and cleanup idempotency.

Integration

Redis + MongoDB + BullMQ lifecycle, Runner contract and signed webhook delivery.

End-to-end

partner launch
→ browser /launch
→ session exchange
→ lab
→ Run
→ Check
→ next task
→ finish
→ webhook
→ cleanup

Security / abuse

Test path traversal, oversized payloads, fork/process exhaustion, CPU/memory exhaustion, blocked networking, sandbox ownership validation, invalid Runner token, replayed terminal tickets, cross-Attempt access, malformed partner JWT, replayed jti, and reused launch codes.

Production Deployment

A demo environment can run several components on one machine. A serious Internet-facing deployment should separate the application tier from the execution tier.

flowchart TB
    Internet --> Proxy[Reverse Proxy / TLS]
    Proxy --> Web[Learner + Admin Frontends]
    Proxy --> API[API Service]
    Proxy --> TG[Terminal Gateway]

    API --> Mongo[(MongoDB)]
    API --> Redis[(Redis)]
    Workers[Worker Pool] --> Redis
    Workers --> Mongo

    API -->|private network| RunnerPool[Runner Pool]
    Workers -->|private network| RunnerPool
    TG -->|private network| RunnerPool

    RunnerPool --> Sandboxes[Isolated learner sandboxes]

Recommended separation

Application tier

reverse proxy / TLS;

learner and admin frontends;

backend API;

workers;

Terminal Gateway;

MongoDB or managed MongoDB;

Redis or managed Redis.

Execution tier

dedicated Runner nodes;

no public Runner endpoint;

sandbox runtime;

strict network segmentation;

no application/database credentials inside learner sandboxes.

Scaling Model

The architecture is decomposed so components can scale independently.

API: stateless replicas behind a load balancer.

Workers: scale replicas/concurrency according to queue depth.

Runner: scale by active sandbox count, queued jobs and CPU/RAM saturation.

Terminal Gateway: scale for long-lived WebSocket connections.

MongoDB: indexes, connection pooling, managed/replicated storage when needed.

Redis: production persistence/HA according to BullMQ durability requirements.

If ten Runner slots exist and hundreds of submissions arrive simultaneously, the API should not spawn hundreds of learner processes. The queue absorbs backlog while execution capacity remains bounded.

Production Hardening Checklist

LabPlay currently demonstrates a production-oriented architecture, but arbitrary learner code is a high-risk workload. Before describing the platform as hardened multi-tenant production infrastructure:

Run Runner nodes on a private network unreachable from the public Internet.

Separate Runner hosts from API, databases and application secrets.

Evaluate stronger isolation such as gVisor, Kata Containers or Firecracker/microVMs.

Terminate all public traffic with TLS.

Store production secrets in a dedicated secret manager.

Implement partner signing-key and internal-secret rotation.

Define database backup and restore procedures.

Use production Redis persistence/HA according to BullMQ requirements.

Add structured dashboards and alerts.

Add dependency, container and secret scanning to CI.

Pin production images by digest.

Use controlled database migrations.

Add E2E, load, chaos and abuse testing.

Define retention rules for learner source, terminal metadata and output.

Add queue saturation/backpressure UX.

Add dead-letter/replay tooling for failed partner webhooks.

Define SLOs only after measuring realistic production behavior.

Roadmap

Potential next steps:

SSE/WebSocket submission status instead of polling;

richer multi-file coding projects;

browser preview for frontend labs;

Playwright/HTTP hidden tests;

stronger isolated runtime for untrusted workloads;

systemd/network/LVM labs through microVM profiles;

Runner pool scheduling and autoscaling;

delivery replay tooling;

OpenAPI integration contract;

partner key rotation UI;

richer metrics and tracing;

LTI 1.3 / LTI Advantage adapter for LMS interoperability.

Project Status

Active development.

The project already demonstrates the core architecture for:

secure application-to-application lab launch;

isolated Attempt lifecycle;

BullMQ worker orchestration;

Docker sandbox provisioning;

asynchronous grading;

browser-based Linux terminal;

lab authoring and versioning;

partner completion delivery.

The repository is best described as production-oriented, not yet fully production-hardened, until the isolation, deployment, operational and security checklist has been completed and validated under realistic load.

Engineering Principles

The API does not execute untrusted learner code directly.

MongoDB is the business source of truth; queue messages carry identifiers, not duplicated domain state.

The verified browser session determines the current Attempt.

Published lab versions are immutable.

Hidden checkers stay server-side.

Partner private keys never enter LabPlay.

Runner credentials never enter the learner browser.

Long-running execution is asynchronous.

Sandbox cleanup is part of the lifecycle.

Retries and duplicate delivery are expected distributed-system behavior and must be handled idempotently.

Author

Built as a full-stack / DevOps engineering project focused on secure integrations, distributed job processing, containerized sandbox execution and production-oriented system design.


