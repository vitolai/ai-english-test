import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function generateAudio(jsonPath: string, audioDir: string): Promise<{ success: boolean; error?: string }> {
  try {
    await execAsync(`python3 gen_session_audio.py "${jsonPath}" "${audioDir}"`);
  } catch (audioErr) {
    const msg = audioErr instanceof Error ? audioErr.message : String(audioErr);
    console.error('[Audio] Generation failed:', msg);
    return { success: false, error: msg };
  }

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const questions = (data.questions || []) as Array<{ id?: number; audio?: string }>;
    for (const q of questions) {
      if (q.audio) {
        const mp3Name = path.basename(q.audio);
        const mp3Path = path.join(audioDir, mp3Name);
        if (!fs.existsSync(mp3Path)) {
          const warn = `Missing audio file for question ${q.id}: ${mp3Name}`;
          console.warn('[Audio]', warn);
          return { success: false, error: warn };
        }
      }
    }
  } catch (readErr) {
    console.warn('[Audio] Could not verify mp3 files:', readErr instanceof Error ? readErr.message : String(readErr));
  }

  return { success: true };
}
