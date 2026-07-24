# AI English Test Practice

An AI-powered English proficiency practice exam application. Generate custom practice tests using various AI providers with configurable question counts, content sources (random, web-sourced, or self-imported PDFs), and a wide range of cloud and local AI models.

## Features

- AI-powered question generation from multiple providers (NVIDIA, OpenRouter, Groq, Anthropic, Google, Azure, Together, DeepSeek, Cohere, Bedrock, Ollama, and more)
- Multiple content sources: random shuffle, web-sourced content, and PDF import
- Configurable question counts (10–200)
- Vision-capable models for photo description questions
- Session history and review

## Quick Start

### Prerequisites

- **Node.js 20+** – https://nodejs.org/
- **Python 3** – `sudo apt install python3 python3-pip`
- **ffmpeg** – `sudo apt install ffmpeg`

### Install

```bash
chmod +x install.sh
./install.sh
```

This installs Node.js dependencies, Python's `edge-tts`, and verifies everything is ready.

### Run

```bash
# Terminal 1 – API server
npx tsx server/app.ts

# Terminal 2 – Vite dev server
npx vite
```

Then open **http://localhost:5173** in your browser.

## Trademark Disclaimer

This project is not affiliated with, endorsed by, or sponsored by ETS (Educational Testing Service). TOEIC is a registered trademark of Educational Testing Service. This is an independent educational tool.
