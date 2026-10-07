"""Build test files in memory, so the suite needs no binary fixtures."""

import io
import zipfile
from dataclasses import dataclass, field

import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import LinearRing

UTM43N = CRS.from_epsg(32643)  # zone covering Bengaluru
WEB_MERCATOR = CRS.from_epsg(3857)
WGS84 = CRS.from_epsg(4326)

# A point in Bengaluru, expressed in UTM 43N metres.
BLR_E, BLR_N = 780_000.0, 1_435_000.0


def to_lonlat(points: list[tuple[float, float]], crs: CRS = UTM43N) -> list[tuple[float, float]]:
    t = Transformer.from_crs(crs, WGS84, always_xy=True)
    return [t.transform(x, y) for x, y in points]


def oriented(ring: list[tuple[float, float]], clockwise: bool) -> list[tuple[float, float]]:
    """The ring running in the requested direction."""
    return ring[::-1] if LinearRing(ring).is_ccw == clockwise else ring


def square(x0: float, y0: float, side: float) -> list[tuple[float, float]]:
    """Closed counter-clockwise square ring."""
    return [(x0, y0), (x0 + side, y0), (x0 + side, y0 + side), (x0, y0 + side), (x0, y0)]


# ---------------------------------------------------------------- KML


def kml_coords(points: list[tuple[float, ...]]) -> str:
    return " ".join(",".join(f"{v:.10f}" for v in p) for p in points)


def kml_polygon(outer, holes=()) -> str:
    inner = "".join(
        f"<innerBoundaryIs><LinearRing><coordinates>{kml_coords(h)}</coordinates></LinearRing></innerBoundaryIs>"
        for h in holes
    )
    return (
        f"<Polygon><outerBoundaryIs><LinearRing><coordinates>{kml_coords(outer)}</coordinates>"
        f"</LinearRing></outerBoundaryIs>{inner}</Polygon>"
    )


def kml_line(points) -> str:
    return f"<LineString><coordinates>{kml_coords(points)}</coordinates></LineString>"


def kml_point(point) -> str:
    return f"<Point><coordinates>{kml_coords([point])}</coordinates></Point>"


def placemark(name: str, geometry_xml: str, data: dict | None = None) -> str:
    extended = ""
    if data:
        items = "".join(f'<Data name="{k}"><value>{v}</value></Data>' for k, v in data.items())
        extended = f"<ExtendedData>{items}</ExtendedData>"
    return f"<Placemark><name>{name}</name>{extended}{geometry_xml}</Placemark>"


def kml_document(*placemarks: str, folder: str | None = None) -> bytes:
    body = "".join(placemarks)
    if folder:
        body = f"<Folder><name>{folder}</name>{body}</Folder>"
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">'
        f"<Document><name>test</name>{body}</Document></kml>"
    ).encode()


def zip_bytes(files: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()


# ---------------------------------------------------------------- Shapefile


@dataclass
class Layer:
    shape_type: int
    shapes: list = field(default_factory=list)  # pyshp-style parts, or None for a NULL shape
    records: list[dict] = field(default_factory=list)
    crs: CRS | None = WGS84
    clockwise: bool = True  # ESRI convention for polygon exterior rings; False writes them counter-clockwise


def shapefile_members(name: str, layer: Layer) -> dict[str, bytes]:
    shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
    w = shapefile.Writer(shp=shp, shx=shx, dbf=dbf, shapeType=layer.shape_type)
    keys = list(layer.records[0]) if layer.records else ["name"]
    for key in keys:
        w.field(key, "C", size=80)
    for parts, record in zip(layer.shapes, layer.records or [{"name": ""}] * len(layer.shapes), strict=True):
        if parts is None:
            w.null()
        elif layer.shape_type == shapefile.POLYGON:
            w.poly([oriented(ring, layer.clockwise) for ring in parts])  # factory polygons have no holes
        elif layer.shape_type == shapefile.POLYLINE:
            w.line(parts)
        elif layer.shape_type == shapefile.POINT:
            w.point(*parts)
        w.record(**{k: str(v) for k, v in record.items()})
    w.close()
    members = {f"{name}.shp": shp.getvalue(), f"{name}.shx": shx.getvalue(), f"{name}.dbf": dbf.getvalue()}
    if layer.crs is not None:
        members[f"{name}.prj"] = layer.crs.to_wkt("WKT1_ESRI").encode()
    members[f"{name}.cpg"] = b"UTF-8"
    return members


def shapefile_zip(layers: dict[str, Layer], drop: set[str] = frozenset()) -> bytes:
    files: dict[str, bytes] = {}
    for name, layer in layers.items():
        files.update(shapefile_members(name, layer))
    return zip_bytes({k: v for k, v in files.items() if k not in drop})
