import asyncio
import edge_tts
import os
import sys
import json
import re

async def gen_audio(file_path, text, sem, voice="en-US-JennyNeural"):
    if os.path.exists(file_path):
        return
    if not text or text.strip() == "":
        return
    async with sem:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(file_path)

async def gen_multi_voice_audio(file_path, segments, sem):
    """Generate audio with different voices for different segments.
    segments: list of (text, voice) tuples
    Concatenates into a single mp3 file using ffmpeg.
    """
    if os.path.exists(file_path):
        return
    if not segments:
        return
    temp_files = []
    for i, (text, voice) in enumerate(segments):
        if not text or text.strip() == "":
            continue
        temp_path = file_path.replace(".mp3", "_part{}.mp3".format(i))
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(temp_path)
        temp_files.append(temp_path)
    if not temp_files:
        return
    if len(temp_files) == 1:
        os.rename(temp_files[0], file_path)
    else:
        concat_list = os.path.abspath(file_path.replace(".mp3", "_concat.txt"))
        with open(concat_list, "w") as f:
            for tf in temp_files:
                f.write("file '{}'\n".format(os.path.abspath(tf)))
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_list,
            "-c", "copy", file_path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        await proc.wait()
        for tf in temp_files:
            try:
                os.remove(tf)
            except:
                pass
        try:
            os.remove(concat_list)
        except:
            pass

MALE_VOICE = "en-US-GuyNeural"
FEMALE_VOICE = "en-US-JennyNeural"
MALE_NAMES = ["michael", "man", "m", "john", "david", "robert", "james", "mark", "tom", "kevin"]
FEMALE_NAMES = ["jennifer", "woman", "w", "sarah", "lisa", "mary", "emma", "karen", "amy", "susan"]

async def main():
    if len(sys.argv) < 3:
        print("Usage: python gen_session_audio.py <json_path> <audio_dir>")
        sys.exit(1)

    json_path = sys.argv[1]
    audio_dir = sys.argv[2]

    if not os.path.exists(audio_dir):
        os.makedirs(audio_dir)

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    sem = asyncio.Semaphore(5)
    tasks = []
    for q in data.get("questions", []):
        if q.get("type") != "listening" or not q.get("audio"):
            continue

        voice = FEMALE_VOICE if q["id"] % 2 == 0 else MALE_VOICE
        output_path = os.path.join(audio_dir, os.path.basename(q["audio"]))
        text = ""

        if q.get("part") == 1:
            # Part 1: combine all 4 options with A/B/C/D labels (like Part 2)
            options = q.get("options", [])
            if options:
                parts = []
                for i, opt in enumerate(options):
                    label = chr(65 + i)  # A, B, C, D
                    parts.append("{}. {}".format(label, opt))
                text = ". ".join(parts)
        elif q.get("part") == 2:
            # Part 2: spoken question + 3 responses with A/B/C labels
            question = q.get("transcript", "") or q.get("question", "")
            options = q.get("options", [])
            if question and options:
                parts = [question]
                for i, opt in enumerate(options[:3]):
                    label = chr(65 + i)
                    parts.append("{}. {}".format(label, opt))
                text = ". ".join(parts)
            elif question:
                text = question
            else:
                text = "Could you please tell me about the current status?"
        elif q.get("part") in (3, 4):
            # Part 3/4: multi-voice audio
            # Split transcript by speaker, use different voices per speaker gender
            transcript = q.get("transcript", "")
            question = q.get("question", "")
            options = q.get("options", [])
            segments = []
            if transcript:
                # Parse speaker turns
                turns = re.split(r"(?=(?:Michael|Jennifer|M|W|Man|Woman|John|David|Robert|James|Mark|Sarah|Lisa|Mary|Emma|Karen|Tom|Kevin|Amy|Susan):\s*)", transcript)
                for turn in turns:
                    turn = turn.strip()
                    if not turn:
                        continue
                    name_match = re.match(r"^([A-Za-z]+):\s*(.*)", turn, re.DOTALL)
                    if name_match:
                        speaker = name_match.group(1).lower()
                        dialogue = name_match.group(2).strip()
                        if speaker in MALE_NAMES:
                            v = MALE_VOICE
                        elif speaker in FEMALE_NAMES:
                            v = FEMALE_VOICE
                        else:
                            v = FEMALE_VOICE
                        if dialogue:
                            segments.append((dialogue, v))
                    else:
                        segments.append((turn, FEMALE_VOICE))
            if question:
                segments.append(("Question: {}".format(question), FEMALE_VOICE))
            if options:
                for i, opt in enumerate(options):
                    label = chr(65 + i)
                    segments.append(("{}. {}".format(label, opt), FEMALE_VOICE))
            if segments:
                tasks.append(gen_multi_voice_audio(output_path, segments, sem))
            continue
        else:
            text = q.get("transcript") or q.get("question") or ""

        if text and text.strip():
            tasks.append(gen_audio(output_path, text, sem, voice))

    if tasks:
        await asyncio.gather(*tasks)
        print("Generated {} audio files.".format(len(tasks)))
    else:
        print("No audio needed.")

if __name__ == "__main__":
    asyncio.run(main())