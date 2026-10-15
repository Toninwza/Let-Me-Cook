import logging

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field

from app.ai import speak, transcribe
from app.config import settings
from app.ratelimit import limit

log = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

MAX_AUDIO_BYTES = 10 * 1024 * 1024  # about 10 minutes of compressed speech, far more than a chat message


class TranscriptOut(BaseModel):
    text: str


class SpeakIn(BaseModel):
    text: str = Field(min_length=1, max_length=600)


@router.post("/transcribe", dependencies=[Depends(limit("transcribe", 15))])
async def transcribe_audio(file: UploadFile) -> TranscriptOut:
    if not settings.elevenlabs_api_key:
        raise HTTPException(503, "ระบบแปลงเสียงยังไม่ได้ตั้งค่า")
    audio = await file.read()
    if len(audio) < 1000:
        raise HTTPException(422, "ไฟล์เสียงสั้นเกินไป ลองกดพูดใหม่อีกครั้งครับ")
    if len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "ไฟล์เสียงใหญ่เกินไป")
    try:
        text = await transcribe(audio, file.content_type or "")
    except Exception:
        log.exception("transcribe failed")
        raise HTTPException(502, "แปลงเสียงเป็นข้อความไม่สำเร็จ ลองพูดใหม่อีกครั้งครับ")
    if not text:
        raise HTTPException(422, "ไม่ได้ยินเสียงพูด ลองพูดใหม่อีกครั้งครับ")
    return TranscriptOut(text=text)


@router.post("/speak", dependencies=[Depends(limit("speak", 30))], response_class=Response, responses={200: {"content": {"audio/mpeg": {}}}})
async def speak_text(body: SpeakIn) -> Response:
    if not settings.elevenlabs_api_key:
        raise HTTPException(503, "ระบบเสียงยังไม่ได้ตั้งค่า")
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "ไม่มีข้อความให้อ่าน")
    try:
        audio = await speak(text)
    except Exception:
        log.exception("speak failed")
        raise HTTPException(502, "สร้างเสียงไม่สำเร็จ")
    return Response(content=audio, media_type="audio/mpeg")
