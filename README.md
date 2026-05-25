# 🧠 AI Assessment Creator

> An AI-powered assessment generator that creates structured, professionally formatted question papers using Gemini AI.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)

---

## Architecture Overview

```
┌───────────────────┐       ┌────────────────────┐       ┌──────────────┐
│   Next.js Client  │──────▶│  Express API Server │──────▶│   MongoDB    │
│   (Zustand Store) │◀──────│  (REST + Socket.io) │       │  (Mongoose)  │
│                   │  WS   │                     │       └──────────────┘
└───────────────────┘       │   ┌─────────────┐   │       ┌──────────────┐
                            │   │  BullMQ      │   │──────▶│    Redis     │
                            │   │  Worker      │   │       │  (Job Queue) │
                            │   └──────┬───────┘   │       └──────────────┘
                            │          │           │
                            │   ┌──────▼───────┐   │
                            │   │  Gemini API  │   │
                            │   │  (AI Gen)    │   │
                            │   └──────────────┘   │
                            └────────────────────┘
```

### Flow

1. **Teacher submits** the assignment creation form (with optional PDF/text upload)
2. **Express API** validates input (Zod), extracts file text (pdf-parse), saves to MongoDB, and queues a BullMQ job
3. **BullMQ Worker** picks up the job, builds a structured prompt, calls Gemini 2.0 Flash in JSON mode
4. **Gemini returns** strict JSON → worker validates, saves to MongoDB, emits Socket.io event
5. **Frontend receives** the WebSocket event and renders the structured question paper

---

## Tech Stack

| Layer      | Technology                                     |
| ---------- | ---------------------------------------------- |
| Frontend   | Next.js 15, React 19, TypeScript, Zustand      |
| Backend    | Node.js, Express 5, TypeScript                 |
| Database   | MongoDB (Mongoose)                             |
| Cache/Queue| Redis, BullMQ                                  |
| Real-time  | Socket.io (WebSocket)                          |
| AI         | Google Gemini 2.0 Flash (free tier, JSON mode) |
| PDF Export | html2canvas + jsPDF                            |
| Validation | Zod (frontend + backend)                       |
| Security   | Helmet, CORS, express-rate-limit               |

---

## Approach

- **Structured AI Output**: Gemini is called in `responseMimeType: "application/json"` mode with a detailed schema prompt. The LLM response is never rendered raw — it's parsed, validated, and stored as structured data.
- **Background Processing**: BullMQ with Redis ensures the API responds instantly while AI generation happens asynchronously. Failed jobs retry 3 times with exponential backoff.
- **Real-time Updates**: Socket.io rooms scoped to `assignmentId` deliver targeted status events (pending → processing → completed/failed).
- **In-Memory File Handling**: Uploaded files are processed in-memory via Multer buffers. Only extracted text is persisted in MongoDB — no binary storage overhead.
- **PDF Export**: Client-side PDF generation using html2canvas for rendering and jsPDF for multi-page PDF assembly.

---

## Setup Instructions

### Prerequisites

- **Node.js** ≥ 18
- **MongoDB** (local or Atlas)
- **Redis** (local or cloud)
- **Gemini API Key** (free from [Google AI Studio](https://aistudio.google.com/apikey))

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/ai-assessment-creator.git
cd ai-assessment-creator
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ai-assessment-creator
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your_gemini_api_key_here
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

Start the backend:
```bash
npm run dev
```

### 3. Setup Frontend

```bash
cd frontend
npm install
```

Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_WS_URL=http://localhost:5000
```

Start the frontend:
```bash
npm run dev
```

### 4. Open the app

Navigate to `http://localhost:3000`

---

## Features

- ✅ Assignment creation form with full validation
- ✅ Drag-and-drop file upload (PDF / TXT)
- ✅ AI question paper generation (Gemini 2.0 Flash)
- ✅ Structured output with sections, difficulty badges, and marks
- ✅ Real-time status updates via WebSocket
- ✅ Background job processing with BullMQ
- ✅ Regeneration support
- ✅ PDF export
- ✅ Student info section (Name, Roll No, Section)
- ✅ Mobile responsive design
- ✅ Dark theme with glassmorphism UI
