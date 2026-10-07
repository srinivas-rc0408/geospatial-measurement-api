"""Safe ZIP handling.

Members are read into memory and never extracted to disk, so a malicious path such as
``../../etc/passwd`` (zip-slip) cannot write anywhere. Total uncompressed size and member
count are checked *before* decompressing anything (zip-bomb protection).
"""

import zipfile
import zlib
from pathlib import Path, PurePosixPath

from app.config import Settings
from app.services.errors import InvalidFileError

_IGNORED_PREFIXES = ("__MACOSX/",)


def _is_ignored(name: str) -> bool:
    if name.startswith(_IGNORED_PREFIXES):
        return True
    return PurePosixPath(name).name.startswith(".")  # .DS_Store, ._foo.shp (macOS metadata)


def _open(path: Path) -> zipfile.ZipFile:
    try:
        return zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        raise InvalidFileError("The uploaded file is not a valid ZIP archive.") from exc


def _members(zf: zipfile.ZipFile, settings: Settings) -> list[zipfile.ZipInfo]:
    infos = [i for i in zf.infolist() if not i.is_dir() and not _is_ignored(i.filename)]
    if not infos:
        raise InvalidFileError("The ZIP archive is empty.")
    if len(infos) > settings.max_archive_members:
        raise InvalidFileError(f"The ZIP archive has {len(infos)} files; the limit is {settings.max_archive_members}.")
    total = sum(i.file_size for i in infos)
    if total > settings.max_uncompressed_bytes:
        raise InvalidFileError(
            f"The ZIP archive expands to {total / 1024 / 1024:.1f} MB; "
            f"the limit is {settings.max_uncompressed_mb:g} MB."
        )
    return infos


def list_members(path: Path, settings: Settings) -> list[str]:
    """Names of the meaningful files in the archive (validates limits, reads nothing)."""
    with _open(path) as zf:
        return [i.filename for i in _members(zf, settings)]


def read_members(path: Path, settings: Settings, names: set[str] | None = None) -> dict[str, bytes]:
    """Read members (all, or only ``names``) into memory."""
    with _open(path) as zf:
        infos = [i for i in _members(zf, settings) if names is None or i.filename in names]
        try:
            return {i.filename: zf.read(i) for i in infos}
        except (zipfile.BadZipFile, zlib.error, EOFError) as exc:
            raise InvalidFileError(f"The ZIP archive is corrupt: {exc}") from exc
