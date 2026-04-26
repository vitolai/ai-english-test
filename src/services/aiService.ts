import axios from 'axios';

export interface Question {
  id: number;
  part: string;
  type: 'listening' | 'reading';
  question: string;
  options: string[];
  answer: string;
  transcript?: string;
  image?: string;
}

export const generateBatch = async (count: number, config: any, seedText: string): Promise<Question[]> => {
  const endpoint = config.apiUrl || 'https://api.groq.com/openai/v1/chat/completions';
  const response = await axios.post(endpoint, {
    model: config.model,
    messages: [
      { role: 'system', content: 'Generate TOEIC questions in JSON format.' },
      { role: 'user', content: `Generate ${count} questions. Context: ${seedText}` }
    ],
    response_format: { type: 'json_object' }
  }, {
    headers: { 'Authorization': `Bearer ${config.apiKey}` }
  });
  return response.data.choices[0].message.content.questions;
};

export const generateQuestions = async (total: number, config: any, seedText: string): Promise<Question[]> => {
  const batchSize = 10;
  let allQuestions: Question[] = [];
  
  for (let i = 0; i < total; i += batchSize) {
    const currentBatchSize = Math.min(batchSize, total - i);
    console.log(`Generating batch ${i + 1} to ${i + currentBatchSize} of ${total}...`);
    
    try {
      const batch = await generateBatch(currentBatchSize, config, seedText);
      allQuestions = [...allQuestions, ...batch];
      
      // Mandatory rest between batches to avoid rate limits
      if (total > batchSize) await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.warn('Rate limit hit or error. Waiting 5s before retry...');
      await new Promise(r => setTimeout(r, 5000));
      i -= batchSize; // Retry this batch
    }
  }
  
  return allQuestions;
};
