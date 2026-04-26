export interface TTSConfig {
  azureKey?: string;
  azureRegion?: string;
  elevenKey?: string;
  primaryProvider: 'azure' | 'eleven' | 'native';
}

export interface ScriptLine {
  voice: 'female' | 'male';
  text: string;
}

const fetchAzureMultiVoice = async (lines: ScriptLine[], apiKey: string, region: string = 'eastus'): Promise<string> => {
  // Construct SSML for multi-voice dialogue
  let ssmlBody = "";
  for (const line of lines) {
    const voiceName = line.voice === 'female' ? 'en-US-JennyNeural' : 'en-US-GuyNeural';
    ssmlBody += `<voice name='${voiceName}'>${line.text}</voice><break time='500ms'/>`;
  }

  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>${ssmlBody}</speak>`;

  const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
    },
    body: ssml
  });

  if (!response.ok) throw new Error('Azure Multi-Voice TTS Failed');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const getAudioUrl = async (transcript: string | ScriptLine[], config: TTSConfig): Promise<string | null> => {
  // Convert plain string to a default ScriptLine array if needed
  const lines: ScriptLine[] = typeof transcript === 'string' 
    ? [{ voice: 'female', text: transcript }] 
    : transcript;

  if (config.primaryProvider === 'azure' && config.azureKey) {
    try {
      return await fetchAzureMultiVoice(lines, config.azureKey, config.azureRegion);
    } catch (e) {
      console.warn('Azure Multi-Voice failed, falling back...');
    }
  }

  return null; // Safety fallback
};
