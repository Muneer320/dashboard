from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.services.file_storage import file_response_from_token

router = APIRouter()


@router.get("/{token}", response_class=FileResponse)
async def download_file(token: str) -> FileResponse:
    return file_response_from_token(token)
