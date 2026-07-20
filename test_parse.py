import sys
sys.path.insert(0, '/home/vlw/toeic-ai-pro-w')
from gen_session_audio import parse_speaker_turns

# Test transcript from the JSON
transcript = """Alex: Have you booked the flight to Singapore for next week's conference? Maya: Yes, I reserved a morning flight and arranged hotel accommodation near the venue. Alex: Great, don't forget to prepare the presentation slides for the logistics session."""

segments = parse_speaker_turns(transcript)
print("Parsed {} segments:".format(len(segments)))
for sp, dialogue, voice in segments:
    print("  Speaker: '{}' -> Voice: {}".format(sp, voice))
    print("    Dialogue: {}...".format(dialogue[:80]))

# Also test Laura/John
transcript2 = """Laura: The quarterly meeting will start at 9 a.m. in the main conference room. John: Should I bring the updated sales report? Laura: Yes, and also bring the logistics cost analysis for the Asia-Pacific region."""

segments2 = parse_speaker_turns(transcript2)
print("\nParsed {} segments:".format(len(segments2)))
for sp, dialogue, voice in segments2:
    print("  Speaker: '{}' -> Voice: {}".format(sp, voice))
    print("    Dialogue: {}...".format(dialogue[:80]))
