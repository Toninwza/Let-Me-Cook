"""Voice with ElevenLabs: speech to text (Scribe) and text to speech.
Contract: docs/contract.md "AI module interface"."""

from collections import OrderedDict

import httpx

from app.config import settings

_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
_STT_MODEL = "scribe_v2"
_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_64"
# eleven_v3 is the model that speaks Thai; the flash models reject language "th".
_TTS_MODEL = "eleven_v3"
_DEFAULT_VOICE = "onwK4e9ZLuTAKqWW03F9"  # Daniel, used when ELEVENLABS_VOICE_ID is empty
_TIMEOUT_S = 60

# Bot replies repeat ("เปิดหน้า U-Pay ให้แล้วครับ ..."), so keep recent audio instead of paying twice.
_tts_cache: OrderedDict[str, bytes] = OrderedDict()
_TTS_CACHE_SIZE = 64


class SpeechFailed(RuntimeError):
    pass


async def transcribe(audio_bytes: bytes, mime_type: str) -> str:
    if not settings.elevenlabs_api_key:
        raise SpeechFailed("ELEVENLABS_API_KEY is not set in api/.env")
    async with httpx.AsyncClient(timeout=_TIMEOUT_S) as http:
        response = await http.post(
            _STT_URL,
            headers={"xi-api-key": settings.elevenlabs_api_key},
            # No language_code: Scribe detects Thai or English itself, so both work by voice too.
            data={"model_id": _STT_MODEL, "tag_audio_events": "false"},
            files={"file": ("speech", audio_bytes, mime_type or "application/octet-stream")},
        )
    if response.status_code != 200:
        raise SpeechFailed(f"ElevenLabs {response.status_code}: {response.text[:200]}")
    return response.json().get("text", "").strip()


async def speak(text: str) -> bytes:
    """MP3 of the bot reading `text` in Thai."""
    if not settings.elevenlabs_api_key:
        raise SpeechFailed("ELEVENLABS_API_KEY is not set in api/.env")
    if text in _tts_cache:
        _tts_cache.move_to_end(text)
        return _tts_cache[text]
    async with httpx.AsyncClient(timeout=_TIMEOUT_S) as http:
        response = await http.post(
            _TTS_URL.format(voice_id=settings.elevenlabs_voice_id or _DEFAULT_VOICE),
            headers={"xi-api-key": settings.elevenlabs_api_key},
            json={"text": text, "model_id": _TTS_MODEL},
        )
    if response.status_code != 200:
        raise SpeechFailed(f"ElevenLabs {response.status_code}: {response.text[:200]}")
    _tts_cache[text] = response.content
    if len(_tts_cache) > _TTS_CACHE_SIZE:
        _tts_cache.popitem(last=False)
    return response.content
