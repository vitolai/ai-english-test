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
            "-c:a", "libmp3lame", file_path,
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

# Comprehensive name -> gender maps (lowercase).
# Male: explicitly masculine given names used as speaker labels in TOEIC transcripts.
MALE_NAMES = {
    "michael", "john", "david", "robert", "james", "mark", "tom", "kevin",
    "alex", "pete", "peter", "hank", "vik", "leo", "lee", "sam", "chris",
    "jordan", "jamie", "man", "m",
}
# Female: explicitly feminine given names used as speaker labels in TOEIC transcripts.
FEMALE_NAMES = {
    "jennifer", "sarah", "lisa", "mary", "emma", "karen", "amy", "susan", "laura",
    "maya", "anna", "maria", "nina", "olga", "tara", "gina", "woman", "w",
}

# Generic role labels that don't carry gender. We alternate voice by position
# (first occurrence -> male, second -> female, third -> male, ...). The label
# itself is stripped from the dialogue so it is never spoken aloud.
GENERIC_ROLE_LABELS = {
    "advisor", "agent", "analyst", "assistant", "client", "colleague",
    "coordinator", "employee", "engineer", "hr", "investor", "leader",
    "legal", "manager", "member", "passenger", "supervisor", "trader",
    "traveler", "speaker", "person", "host", "guest", "customer",
    "representative", "officer", "director", "president", "secretary",
    "receptionist", "operator", "narrator", "announcer",
}

# Parse a single speaker turn: capture the speaker name (group 1) and the
# dialogue (group 2). Only used by parse_speaker_turns when iterating over
# label matches. The dialogue is what gets passed to edge_tts -- the speaker
# name is NEVER spoken.
SPEAKER_TURN_PARSE_RE = re.compile(r"^([A-Z][a-zA-Z]{1,}):\s*(.*)", re.DOTALL)

_OPTION_LABEL_RE = re.compile(r"^[A-D][.)]\s+")


def _strip_option_label(text):
    """Strip leading A. B. C. D. label from option text to avoid duplication."""
    return _OPTION_LABEL_RE.sub("", text, count=1).strip()


def _voice_for_speaker(speaker, alternate_index):
    """Pick a voice for a speaker label.

    speaker: lowercase speaker label (e.g. 'michael', 'maya', 'manager').
    alternate_index: position among generic/unknown speakers so far (used to
        alternate male/female voices when no explicit gender is known).
    """
    if speaker in MALE_NAMES:
        return MALE_VOICE
    if speaker in FEMALE_NAMES:
        return FEMALE_VOICE
    # Generic role or unknown name -> alternate by position to ensure
    # distinct voices across a multi-turn conversation.
    return MALE_VOICE if alternate_index % 2 == 0 else FEMALE_VOICE


def parse_speaker_turns(transcript):
    """Parse a multi-speaker transcript into (speaker, dialogue, voice) tuples.

    Only the dialogue is returned for TTS; the speaker name is stripped so it
    is never read aloud. Voices are assigned by gender when the speaker name
    has a known gender, otherwise alternated by position.

    A "speaker turn" is a span starting with a Capitalised label of at least
    two letters followed by a colon and whitespace, e.g. "Alex: ...". We find
    all such labels and slice the transcript between them. Any text before
    the first label is treated as narration (no speaker).
    """
    segments = []
    if not transcript:
        return segments

    # Find every speaker label position. A label is a Capitalised word of at
    # least 2 letters followed by ":" and whitespace. It must either start
    # the transcript, or be preceded by a sentence-ending punctuation mark
    # and whitespace (". ", "! ", "? "). This prevents matching substrings
    # like "A:" inside a word or "Mr.:" style abbreviations.
    label_re = re.compile(
        r"(?:(?:^|(?<=[.!?]\s)))([A-Z][a-zA-Z]{1,}):\s+"
    )
    matches = list(label_re.finditer(transcript))

    if not matches:
        # No speaker labels found -> single narration segment.
        segments.append(("", transcript.strip(), FEMALE_VOICE))
        return segments

    # Text before the first label, if any, is narration.
    if matches[0].start() > 0:
        pre = transcript[: matches[0].start()].strip()
        if pre:
            segments.append(("", pre, FEMALE_VOICE))

    generic_index = 0
    for i, m in enumerate(matches):
        speaker = m.group(1).lower()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(transcript)
        dialogue = transcript[start:end].strip()
        if not dialogue:
            continue
        if speaker in MALE_NAMES:
            voice = MALE_VOICE
        elif speaker in FEMALE_NAMES:
            voice = FEMALE_VOICE
        else:
            # Generic role label or unknown name: alternate by position so a
            # two-speaker conversation gets distinct male+female voices.
            voice = MALE_VOICE if generic_index % 2 == 0 else FEMALE_VOICE
            generic_index += 1
        segments.append((speaker, dialogue, voice))
    return segments


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

    all_questions = data.get("questions", [])
    non_p34 = [q for q in all_questions if q.get("part") not in (3, 4)]
    p34 = [q for q in all_questions if q.get("part") in (3, 4) and q.get("audio")]

    # Group P3/P4 questions by transcript (consecutive questions with
    # the same transcript belong to the same conversation/talk group).
    groups = []
    for q in p34:
        t = q.get("transcript", "")
        if groups and groups[-1][0].get("transcript", "") == t:
            groups[-1].append(q)
        else:
            groups.append([q])

    json_updated = False

    # --- P3/P4: generate one audio file per group ---
    for group in groups:
        first_q = group[0]
        first_id = first_q["id"]
        part = first_q["part"]
        group_filename = "q{}_part{}.mp3".format(first_id, part)
        output_path = os.path.join(audio_dir, group_filename)

        # Build the relative audio path for JSON (strip directory prefix).
        raw_audio = first_q["audio"]
        group_audio_field = raw_audio.rsplit("/", 1)[0] + "/" + group_filename

        # Build combined segments: conversation + each question.
        segments = []
        transcript = first_q.get("transcript", "")
        if transcript:
            parsed = parse_speaker_turns(transcript)
            segments.extend((dialogue, voice) for (_sp, dialogue, voice) in parsed)
        for gq in group:
            question = gq.get("question", "")
            if question:
                segments.append(("Question: {}".format(question), FEMALE_VOICE))

        if segments:
            tasks.append(gen_multi_voice_audio(output_path, segments, sem))

        # Point every question in the group at the shared group file.
        for gq in group:
            gq["audio"] = group_audio_field
            json_updated = True

    # --- Non-P3/P4: generate per-question audio as before ---
    for q in non_p34:
        if q.get("type") != "listening" or not q.get("audio"):
            continue

        voice = FEMALE_VOICE if q["id"] % 2 == 0 else MALE_VOICE
        output_path = os.path.join(audio_dir, os.path.basename(q["audio"]))
        text = ""

        if q.get("part") == 1:
            options = q.get("options", [])
            if options:
                parts = []
                for i, opt in enumerate(options):
                    label = chr(65 + i)
                    opt = _strip_option_label(opt)
                    parts.append("{}. {}".format(label, opt))
                text = ". ".join(parts)
        elif q.get("part") == 2:
            question = q.get("transcript", "") or q.get("question", "")
            options = q.get("options", [])
            if question and options:
                parts = [question]
                for i, opt in enumerate(options[:3]):
                    label = chr(65 + i)
                    opt = _strip_option_label(opt)
                    parts.append("{}. {}".format(label, opt))
                text = ". ".join(parts)
            elif question:
                text = question
            else:
                text = "Could you please tell me about the current status?"
        else:
            text = q.get("transcript") or q.get("question") or ""

        if text and text.strip():
            tasks.append(gen_audio(output_path, text, sem, voice))

    if tasks:
        await asyncio.gather(*tasks)
        print("Generated {} audio files.".format(len(tasks)))
    else:
        print("No audio needed.")

    # Write updated JSON so frontend reads correct group audio paths.
    if json_updated:
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    asyncio.run(main())