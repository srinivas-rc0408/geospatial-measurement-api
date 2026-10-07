"""Format-neutral structures returned by every reader."""

from dataclasses import dataclass, field
from enum import StrEnum

from pyproj import CRS


class ProblemKind(StrEnum):
    INVALID = "INVALID"  # malformed coordinates, too few points, ...
    UNSUPPORTED = "UNSUPPORTED"  # valid but not representable (KML <Model>, Shapefile MultiPatch)


@dataclass
class RawFeature:
    """One feature as read from the file, before measurement."""

    layer: str | None
    geometry: dict | None  # GeoJSON-style geometry mapping, or None
    properties: dict
    geometry_type: str | None = None  # declared type, used when geometry could not be parsed
    problem: str | None = None
    problem_kind: ProblemKind | None = None


@dataclass
class Dataset:
    """Features that share one CRS (a KML document, or one Shapefile inside a ZIP)."""

    name: str
    crs: CRS | None
    features: list[RawFeature] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
