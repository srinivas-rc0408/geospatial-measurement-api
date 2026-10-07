"""Copy uploads to permanent storage in chunks, with a hard size limit (never holds the whole file in memory)."""

from pathlib import Path, PurePosixPath, PureWindowsPath

from fastapi import UploadFile

from app.services.errors import FileTooLargeError

CHUNK_SIZE = 1024 * 1024  # 1 MiB


def clean_filename(raw: str | None) -> str:
    """Drop any directory part a client sent (``C:\\x\\a.kml`` or ``../a.kml``) and cap the length."""
    name = PureWindowsPath(PurePosixPath(raw or "").name).name.strip()
    return (name or "upload")[-255:]


def save_upload(upload: UploadFile, destination: Path, max_bytes: int) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    try:
        with destination.open("wb") as out:
            while chunk := upload.file.read(CHUNK_SIZE):
                size += len(chunk)
                if size > max_bytes:
                    raise FileTooLargeError(f"File exceeds the {max_bytes / 1024 / 1024:g} MB upload limit.")
                out.write(chunk)
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return size
