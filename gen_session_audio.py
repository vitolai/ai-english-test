import asyncio
import edge_tts
import os
import sys
import json

async def gen_audio(file_path, text, sem, voice="en-US-JennyNeural"):
    if os.path.exists(file_path):
        return
    async with sem:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(file_path)

async def main():
    if len(sys.argv) < 3:
        print("Usage: python gen_session_audio.py <json_path> <audio_dir>")
        sys.exit(1)

    json_path = sys.argv[1]
    audio_dir = sys.argv[2]

    if not os.path.exists(audio_dir):
        os.makedirs(audio_dir)

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    sem = asyncio.Semaphore(5)
    tasks = []
    for q in data.get('questions', []):
        if q.get('type') == 'listening' and q.get('audio') and q.get('transcript'):
            # Alternate voices for variety
            voice = "en-US-JennyNeural" if q['id'] % 2 == 0 else "en-US-GuyNeural"
            output_path = os.path.join(audio_dir, q['audio'])
            tasks.append(gen_audio(output_path, q['transcript'], sem, voice))

    if tasks:
        await asyncio.gather(*tasks)
        print(f"Generated {len(tasks)} audio files.")
    else:
        print("No audio needed.")

if __name__ == "__main__":
    asyncio.run(main())
