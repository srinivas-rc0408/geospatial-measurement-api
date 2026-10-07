"""Entry point for reading uploads: detect the format, validate cheaply, then read.

Detection is by extension, confirmed by content (a ``.zip`` must really be a ZIP and must
contain a Shapefile or a KML). Cheap structural checks run during the upload request so
the client gets an immediate 4xx; full parsing runs in the background.
"""

from pathlib import Path, PurePosixPath

from app.config import Settings
from app.models import FileType
from app.services.errors import InvalidFileError, UnsupportedFileTypeError
from app.services.readers.archive import list_members, read_members
from app.services.readers.base import Dataset
from app.services.readers.kml import read_kml
from app.services.readers.shapefile import group_shapefiles, read_shapefile

ALLOWED_EXTENSIONS = {".zip", ".kml", ".kmz"}


def extension_of(filename: str) -> str:
    ext = PurePosixPath(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise UnsupportedFileTypeError(
            f"Unsupported file type '{ext or '(none)'}'. Upload a .zip containing a Shapefile, or a .kml / .kmz file."
        )
    return ext


def _kml_member(names: list[str]) -> str | None:
    kmls = sorted(n for n in names if n.lower().endswith(".kml"))
    if not kmls:
        return None
    # KMZ convention: the main document is doc.kml at the archive root.
    return next((n for n in kmls if n.lower() == "doc.kml"), kmls[0])


def inspect_upload(path: Path, filename: str, settings: Settings) -> FileType:
    """Fast validation of the uploaded container. Returns the detected file type."""
    ext = extension_of(filename)
    if ext == ".kml":
        head = path.read_bytes()[:1024].lstrip(b"\xef\xbb\xbf \t\r\n")
        if not head.startswith(b"<"):
            raise InvalidFileError("The .kml file does not look like XML.")
        return FileType.KML

    names = list_members(path, settings)  # also enforces ZIP bomb limits
    if group_shapefiles(names):  # also raises if .shx / .dbf are missing
        return FileType.SHAPEFILE
    if _kml_member(names):
        return FileType.KMZ
    raise InvalidFileError("The archive contains no Shapefile (.shp) and no KML (.kml).")


def read_datasets(path: Path, file_type: FileType, filename: str, settings: Settings) -> list[Dataset]:
    layer = PurePosixPath(filename).stem or "layer"

    if file_type is FileType.KML:
        return [read_kml(path.read_bytes(), default_layer=layer)]

    names = list_members(path, settings)
    if file_type is FileType.KMZ:
        member = _kml_member(names)
        if member is None:
            raise InvalidFileError("The archive contains no KML document.")
        return [read_kml(read_members(path, settings, {member})[member], default_layer=layer)]

    shapefiles = group_shapefiles(names)
    wanted = {m for sf in shapefiles for m in sf.members.values()}
    data = read_members(path, settings, wanted)
    return [read_shapefile(sf, data, settings.assume_wgs84_when_crs_missing) for sf in shapefiles]
