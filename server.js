import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use('/storage', express.static(path.join(__dirname, 'storage')));

const STORAGE_DIR = path.join(__dirname, 'storage', 'sessions');
const UPLOAD_DIR = path.join(__dirname, 'storage', 'uploads');
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

// Ingestion: PDF to Text
app.post('/api/ingest/pdf', upload.single('pdfFile'), async (req, res) => {
    const pdfPath = req.file?.path;
    if (!pdfPath || !fs.existsSync(pdfPath)) return res.status(400).json({ error: 'PDF file not uploaded.' });
    try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        fs.unlinkSync(pdfPath);
        res.json({ text: data.text });
    } catch (err) {
        res.status(500).json({ error: 'Failed to parse PDF.' });
    }
});

// Ingestion: Web to Text
app.post('/api/ingest/web', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required.' });
    try {
        const response = await axios.get(url, { timeout: 10000 });
        const text = response.data.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '').replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        res.json({ text: text.slice(0, 10000) });
    } catch (err) {
        res.status(500).json({ error: `Failed to fetch URL: ${err.message}` });
    }
});

// AI Generation
app.post('/api/generate', async (req, res) => {
    const { seedText, questionCount, aiSource, model, apiKey, config } = req.body;
    const session_id = `${new Date().toISOString().split('T')[0]}-${uuidv4().slice(0, 8)}`;
    const sessionDir = path.join(STORAGE_DIR, session_id);
    fs.mkdirSync(sessionDir);
    const audioDir = path.join(sessionDir, 'audio');
    fs.mkdirSync(audioDir);

    console.log(`Generating ${questionCount} questions (Source: ${aiSource}) for session ${session_id}...`);

    try {
        req.setTimeout(0);
        let finalQuestions = [];
        let attempts = 0;
        const maxAttempts = 5;

        // Debug Mode Override: Use 'test' anywhere in key to avoid AI calls (case insensitive)
        const isTestMode = apiKey && apiKey.toLowerCase().includes('test');
        if (isTestMode) {
            console.log('DEBUG MODE TRIGGERED: Generating 10-question golden sample.');
            finalQuestions = generateMockData(questionCount, session_id).questions;
        } else if (aiSource === 'ai-cloud' || aiSource === 'local-ollama') {
            while (finalQuestions.length < questionCount && attempts < maxAttempts) {
                attempts++;
                const remainingCount = questionCount - finalQuestions.length;
                const currentChunkSize = Math.min(20, remainingCount);
                const startId = finalQuestions.length + 1;

                let part1Count = 1;
                if (questionCount === 50) part1Count = 2;
                if (questionCount === 100) part1Count = 3;
                if (questionCount >= 200) part1Count = 6;
                // Note: 10, 20, 30 questions all default to 1 photo.

                let part1Instruction = '';
                if (startId <= part1Count) {
                    const neededPart1 = Math.min(currentChunkSize, part1Count - startId + 1);
                    part1Instruction = `\n- Questions ${startId} to ${startId + neededPart1 - 1} MUST be 'Part 1: Photographs'. 
                    Use IDs (1556761175-b413da4baf72, 1497366216548-37526070297c, 1556760611-5dc3fca0de17, 1530464684110-0ec74b4b5f88, 1521733610363-24751139a722) for Unsplash urls.
                    - ALL OTHER listening questions MUST be 'Part 2' (Response) or 'Part 3' (Short Conversations) without images.`;
                } else {
                    part1Instruction = `\n- Questions ${startId} to ${startId + currentChunkSize - 1} MUST NOT include any 'Part 1' or images. Use 'Part 2' or 'Part 3' for all listening questions.`;
                }

                const prompt = `Generate a JSON object with a "questions" array containing EXACTLY ${currentChunkSize} TOEIC questions starting at ID ${startId}. 
                Distribution: 50% 'listening', 50% 'reading'.${part1Instruction}
                Context: ${seedText || 'International business environment.'}
                Return format: { "questions": [...] }`;

                console.log(`AI Gen (Attempt ${attempts}): Asking for ${currentChunkSize} questions starting at ${startId}...`);

                const targetUrl = config?.apiUrl || 'http://localhost:11434';
                const isGroq = targetUrl.includes('groq.com');
                const endpoint = targetUrl.endsWith('/v1/chat/completions') ? targetUrl : `${targetUrl.replace(/\/$/, '')}/v1/chat/completions`;

                // Map Groq model names to Ollama-compatible names if needed
                let modelName = model || 'nemotron-3-super:cloud';
                if (isGroq) {
                    // Groq uses different model identifiers - pass as-is
                    console.log(`Using Groq endpoint: ${endpoint}, model: ${modelName}`);
                }

                try {
                    const response = await axios.post(endpoint, {
                        model: modelName,
                        messages: [
                            {
                                role: 'system',
                                content: `You are a professional TOEIC exam generator. 
                                Return ONLY valid JSON matching this schema:
                                {
                                  "questions": Array<{
                                    "id": number,
                                    "part": number (1-7),
                                    "type": "listening" | "reading",
                                    "image"?: string (Unsplash URL for Part 1),
                                    "transcript"?: string (For listening),
                                    "passage"?: string (For reading),
                                    "question": string,
                                    "options": [string, string, string, string], (Exactly 4 strings)
                                    "answer": "A" | "B" | "C" | "D"
                                  }>
                                }`
                            },
                            { role: 'user', content: prompt }
                        ],
                        response_format: { type: "json_object" }
                    }, {
                        timeout: 120000,
                        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
                    });

                    const content = response.data.choices[0].message.content;
                    const chunkData = JSON.parse(content);
                    if (chunkData.questions && Array.isArray(chunkData.questions) && chunkData.questions.length > 0) {
                        console.log(`Received ${chunkData.questions.length} questions.`);
                        const newQuestions = chunkData.questions.slice(0, remainingCount).map(q => {
                            if (q.type === 'listening') {
                                // IMPORTANT: Assign the audio filename for the audio engine to find
                                const sessionIdPart = `sessions/${session_id}/audio`;
                                return { ...q, audio: `${sessionIdPart}/q${q.id}.mp3` };
                            }
                            return q;
                        });
                        finalQuestions = [...finalQuestions, ...newQuestions];
                    } else {
                        console.warn(`Attempt ${attempts}: AI returned empty or invalid question array.`);
                    }
                } catch (err) {
                    console.error('AI Chunk Failed:', err.message);
                    if (attempts >= maxAttempts && finalQuestions.length === 0) throw err;
                }
            }
        } else if (aiSource === 'mock-mode') {
            finalQuestions = generateMockData(questionCount, session_id).questions;
        }

        // Fallback to Mock if generation failed or incomplete
        if (finalQuestions.length === 0) {
            console.warn('Generation failed, falling back to mock data.');
            finalQuestions = generateMockData(questionCount, session_id).questions;
        }

        const examData = { title: "TOEIC Session", questions: finalQuestions };
        const jsonPath = path.join(sessionDir, 'exam_data.json');
        fs.writeFileSync(jsonPath, JSON.stringify(examData, null, 2));

        console.log(`Triggering audio generation for ${session_id}...`);
        try {
            await execAsync(`py -3.14 gen_session_audio.py "${jsonPath}" "${audioDir}"`);
        } catch (audioErr) {
            console.error('Audio Generation Failed:', audioErr.message);
        }

        res.json({ session_id, data: examData });
    } catch (err) {
        console.error('Final Generation failed:', err);
        res.status(500).json({ error: `Generation failed: ${err.message}` });
    }
});

function generateMockData(count, session_id) {
    const questions = [];

    // Distribution rules from user table
    let part1Count = 1;
    if (count === 50) part1Count = 2;
    if (count === 100) part1Count = 3;
    if (count >= 200) part1Count = 6;

    const listeningCount = Math.floor(count / 2);
    const readingCount = count - listeningCount;

    const photoIds = [
        "1556761175-b413da4baf72", // Office
        "1497366216548-37526070297c", // Desk
        "1556760611-5dc3fca0de17", // Reception
        "1530464684110-0ec74b4b5f88", // Airport
        "1521733610363-24751139a722"  // Writing
    ];

    for (let i = 1; i <= count; i++) {
        const isListening = i <= listeningCount;
        const isPart1 = i <= part1Count;

        if (isListening) {
            const photoId = photoIds[(i - 1) % photoIds.length];
            questions.push({
                id: i,
                part: isPart1 ? 1 : 2,
                type: 'listening',
                image: isPart1 ? `https://images.unsplash.com/photo-${photoId}?q=80&w=800` : undefined,
                transcript: `Welcome to the TOEIC preparation session. This is a listening exercise for question number ${i}. Please listen carefully to the following options.`,
                audio: `sessions/${session_id}/audio/q${i}.mp3`,
                options: [
                    "A decision is being made by the team.",
                    "The equipment is being maintained.",
                    "They are focused on their current task.",
                    "The area is being cleaned up."
                ],
                answer: "C"
            });
        } else {
            questions.push({
                id: i,
                part: 5,
                type: 'reading',
                question: `The new marketing strategy was _______ received by the board of directors last Tuesday.`,
                options: ["enthusiasm", "enthusiastic", "enthusiastically", "enthuse"],
                answer: "C"
            });
        }
    }
    return { questions };
}

app.listen(PORT, () => {
    console.log(`TOEIC backend running at http://localhost:${PORT}`);
});
