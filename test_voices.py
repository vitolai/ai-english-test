import edge_tts
import asyncio

async def test():
    voices = await edge_tts.VoicesManager.create()
    for v in voices.voices:
        if v['Name'] in ['en-US-GuyNeural', 'en-US-JennyNeural']:
            print(f"{v['Name']}: {v['Gender']}")

asyncio.run(test())
