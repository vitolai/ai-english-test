export interface SourceData {
  type: 'web' | 'pdf' | 'text';
  content: string;
  metadata?: any;
}

export const extractFromUrl = async (url: string): Promise<string> => {
  // In a serverless env, we will use a public fetch or a proxy for CORS
  const response = await fetch(`https://r.jina.ai/${url}`); // Using Jina Reader as a free, high-quality text extractor
  if (!response.ok) throw new Error('Failed to fetch web content');
  return await response.text();
};

export const parsePdf = async (_file: File): Promise<string> => {
  // We will integrate pdf.js for client-side parsing in the next step
  return "PDF Content Placeholder - Integration Pending";
};

export const formatSourceForAI = (source: SourceData): string => {
  return `SOURCE TYPE: ${source.type}\n\nCONTENT:\n${source.content}\n\nTASK: Generate TOEIC questions based ONLY on this content.`;
};

export const normalizePdfText = (text: string): string => {
  // Simple logic to remove common PDF artifacts like multiple spaces and broken line breaks
  return text
    .replace(/\s+/g, ' ')
    .replace(/-\s+/g, '') // Fix words broken by line breaks
    .trim();
};
