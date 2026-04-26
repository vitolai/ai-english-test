const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/ingest/web', (req, res) => res.json({ text: 'Sample' }));
app.post('/api/ingest/pdf', (req, res) => res.json({ text: 'Sample' }));
app.get('/api/status/:id', (req, res) => res.json({ phase: 'completed', progress: 100 }));
app.get('/storage/sessions/:id/exam_data.json', (req, res) => res.json({
  title: 'TOEIC Practice',
  questions: [
    { id: 1, type: 'listening', part: 1, question: 'Sample?', options: ['A','B','C','D'], answer: 'A', audio: '', image: '' }
  ]
}));

app.listen(3001, () => console.log('TOEIC Backend active on 3001'));
