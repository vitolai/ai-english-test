# TOEIC Pilot v0.3.1

A modern, AI-powered TOEIC practice platform with distributed generation capabilities.

## Features

- **200-Question Full Session Support**: Simulates a complete TOEIC exam with balanced listening and reading sections.
- **AI-Driven Content Generation**: Uses local Ollama (Qwen2.5-Coder) or cloud-based models to generate high-quality, context-aware exam questions.
- **Multi-Source Ingestion**:
  - **Random Shuttle**: Instant generation based on standard TOEIC patterns.
  - **Web-Sourced**: Ingest content from any website to create topical exam questions.
  - **Self Import**: Upload your own PDF documents for personalized study material.
- **Dynamic Audio Synthesis**: Automatically generates high-fidelity listening audio using Microsoft Edge-TTS via a Python backend.
- **Premium UI/UX**:
  - Glassmorphic design with a sleek blue (#2563eb) color palette.
  - Fully responsive, capsule-shaped buttons and modern typography (Inter/System).
  - Real-time generation feedback and immersive exam interface.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4.
- **Backend**: Node.js (Express), Multer (File Uploads), PDF-Parse.
- **AI Engine**: Ollama (Local), Python (Edge-TTS).
- **Architecture**: Gstack Distributed Mesh (WIP for multi-node offloading).

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.10+ (with `edge-tts` installed)
- Ollama (running locally at `http://localhost:11434`)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the backend:
   ```bash
   node server.js
   ```

3. Start the frontend:
   ```bash
   npm run dev
   ```

## Distributed Architecture (Gstack)

The project is currently migrating to a distributed architecture using the **Gstack Mesh**:
- **Dashboard Node (NB)**: Handles user interaction and frontend rendering.
- **Engine Node (ORCL/Pi5)**: Offloads heavy AI generation and audio synthesis tasks to specialized nodes.
- **Auditor Node**: Performs automated QA and consistency checks on generated content.

---
*Created with Antigravity AI - Advanced Agentic Coding*
