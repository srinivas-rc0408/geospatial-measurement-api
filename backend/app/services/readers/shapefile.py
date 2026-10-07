"""Shapefile reader (pure Python via ``pyshp``; CRS from the ``.prj`` via ``pyproj``).

A ZIP may hold several Shapefiles. Each one becomes its own ``Dataset`` because each
can have its own CRS.
"""

import codecs
import io
import struct
from dataclasses import dataclass
from pathlib import PurePosixPath

import shapefile
from pyproj import CRS
from pyproj.exceptions import CRSError

from app.services.crs import WGS84
from app.services.errors import InvalidFileError
from app.services.jsonsafe import json_safe
from app.services.readers.base import Dataset, ProblemKind, RawFeature

REQUIRED_PARTS = (".shp", ".shx", ".dbf")
OPTIONAL_PARTS = (".prj", ".cpg")


@dataclass
class ShapefileParts:
    name: str  # layer name, e.g. "roads" for roads.shp
    members: dict[str, str]  # extension -> archive member name


def group_shapefiles(member_names: list[str]) -> list[ShapefileParts]:
    """Group archive members into Shapefiles by path stem (extensions matched case-insensitively)."""
    groups: dict[str, ShapefileParts] = {}
    for name in member_names:
        path = PurePosixPath(name)
        ext = path.suffix.lower()
        if ext not in REQUIRED_PARTS + OPTIONAL_PARTS:
            continue
        key = str(path.with_suffix("")).lower()
        group = groups.setdefault(key, ShapefileParts(name=path.stem, members={}))
        group.members[ext] = name
        if ext == ".shp":
            group.name = path.stem

    shapefiles = [g for g in groups.values() if ".shp" in g.members]
    for group in shapefiles:
        missing = [ext for ext in REQUIRED_PARTS if ext not in group.members]
        if missing:
            raise InvalidFileError(
                f"Shapefile '{group.name}' is missing required component(s): {', '.join(missing)}. "
                "A Shapefile needs .shp, .shx and .dbf files with the same name."
            )
    return sorted(shapefiles, key=lambda g: g.members[".shp"])


def _decode(data: bytes) -> str:
    return data.decode("utf-8-sig", errors="replace").strip()


def _encoding(cpg: bytes | None) -> str:
    if cpg:
        candidate = _decode(cpg)
        try:
            codecs.lookup(candidate)
            return candidate
        except LookupError:
            pass
    return "utf-8"


def _looks_geographic(bbox: list[float]) -> bool:
    xmin, ymin, xmax, ymax = bbox
    return -180.0 <= xmin <= xmax <= 180.0 and -90.0 <= ymin <= ymax <= 90.0


def read_shapefile(parts: ShapefileParts, data: dict[str, bytes], assume_wgs84: bool) -> Dataset:
    dataset = Dataset(name=parts.name, crs=None)
    blob = {ext: data[member] for ext, member in parts.members.items()}

    if ".prj" in blob:
        try:
            dataset.crs = CRS.from_user_input(_decode(blob[".prj"]))
        except CRSError:
            dataset.warnings.append(f"[{parts.name}] .prj could not be parsed; CRS is unknown.")

    try:
        reader = shapefile.Reader(
            shp=io.BytesIO(blob[".shp"]),
            shx=io.BytesIO(blob[".shx"]),
            dbf=io.BytesIO(blob[".dbf"]),
            encoding=_encoding(blob.get(".cpg")),
            encodingErrors="replace",
        )
        records = list(reader.iterShapeRecords())
        bbox = list(reader.bbox) if records else None
    except (shapefile.ShapefileException, struct.error, ValueError, IndexError) as exc:
        raise InvalidFileError(f"Shapefile '{parts.name}' could not be read: {exc}") from exc

    if dataset.crs is None and ".prj" not in blob:
        if assume_wgs84 and bbox and _looks_geographic(bbox):
            dataset.crs = WGS84
            dataset.warnings.append(
                f"[{parts.name}] No .prj file; coordinates fit lon/lat bounds, so EPSG:4326 was assumed."
            )
        else:
            dataset.warnings.append(
                f"[{parts.name}] No .prj file and coordinates are not lon/lat; CRS unknown, features not measured."
            )

    for record in records:
        shape = record.shape
        props = json_safe(record.record.as_dict())
        declared = shapefile.SHAPETYPE_LOOKUP.get(shape.shapeType)  # e.g. "POLYGONZ", "MULTIPATCH"
        if shape.shapeType == shapefile.NULL:
            dataset.features.append(
                RawFeature(
                    parts.name, None, props, None, "Feature has a NULL shape (no geometry).", ProblemKind.INVALID
                )
            )
            continue
        try:
            geometry = json_safe(shape.__geo_interface__)
        except Exception as exc:  # e.g. MultiPatch has no GeoJSON form
            dataset.features.append(
                RawFeature(parts.name, None, props, declared, f"Unsupported shape type: {exc}", ProblemKind.UNSUPPORTED)
            )
            continue
        dataset.features.append(RawFeature(parts.name, geometry, props, geometry.get("type")))

    if not records:
        dataset.warnings.append(f"[{parts.name}] Shapefile contains no features.")
    return dataset
