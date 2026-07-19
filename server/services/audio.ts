import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function generateAudio(jsonPath: string, audioDir: string): Promise<void> {
  try {
    await execAsync(`python3 gen_session_audio.py "${jsonPath}" "${audioDir}"`);
  } catch (audioErr) {
    const msg = audioErr instanceof Error ? audioErr.message : String(audioErr);
    console.error('[Audio] Generation failed:', msg);
  }
}
