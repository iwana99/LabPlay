
# LabPlay

Standalone, integration-first interactive lab platform for isolated coding and Linux exercises.


<img width="1920" height="801" alt="Screenshot (1636)" src="https://github.com/user-attachments/assets/d46e3741-a206-4ded-95a3-b95c7a3a2498" />



It can be launched from another application through a secure server-to-server integration.
Each learner attempt receives an isolated Docker sandbox, while grading and lifecycle operations are processed asynchronously through Redis and BullMQ.

## Highlights

- Secure partner-to-LabPlay launch using RS256 JWTs
- One isolated Docker sandbox per Attempt
- Redis + BullMQ background job processing
- Async Run / Check grading
- Browser Linux terminal via WebSockets
- Monaco code editor
- Signed completion webhooks
- Lab versioning and admin panel
- Automatic sandbox cleanup

## Architecture

## Architecture

```mermaid
flowchart LR
    Partner[Partner App] --> API[LabPlay API]
    API --> Attempt[Attempt]
    Attempt --> Queue[Redis / BullMQ]
    Queue --> Worker[Worker]
    Worker --> Runner[Runner]
    Runner --> Docker[Docker Sandbox]

    Browser[Student Browser] --> Frontend[LabPlay Frontend]
    Frontend --> API
    Frontend --> Gateway[Terminal Gateway]
    Gateway --> Runner
```

## Tech Stack

Frontend:
React, Vite, Axios, Monaco Editor, xterm.js

Backend:
Node.js, Express, MongoDB, Redis, BullMQ

Infrastructure:
Docker, WebSockets

Security:
RS256 JWT, HttpOnly sessions, HMAC webhooks


## Local Development

Start:

```bash
# backend
npm run dev

# workers
npm run worker

# runner
npm run dev

# terminal gateway
npm run dev

# frontend
npm run dev

Author

Built as a full-stack / DevOps engineering project focused on secure integrations, distributed job processing, containerized sandbox execution and production-oriented system design.


