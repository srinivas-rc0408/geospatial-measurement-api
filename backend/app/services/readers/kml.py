"""KML / KMZ reader.

Parses the XML directly with ``defusedxml`` (blocks XXE and entity-expansion attacks)
instead of depending on GDAL's KML driver, which keeps installation to pure ``pip``.

Supported geometries: Point, LineString, LinearRing, Polygon (with holes),
MultiGeometry and Google's ``gx:Track`` / ``gx:MultiTrack`` (common in drone flight logs).
Per the OGC KML 2.2 standard, KML coordinates are always WGS84 lon,lat[,alt] (EPSG:4326).
"""

from xml.etree.ElementTree import Element, ParseError

import defusedxml.ElementTree as SafeET
from defusedxml import DefusedXmlException

from app.services.crs import WGS84
from app.services.errors import InvalidFileError, UnsupportedGeometryError
from app.services.readers.base import Dataset, ProblemKind, RawFeature

GEOMETRY_TAGS = {"Point", "LineString", "LinearRing", "Polygon", "MultiGeometry", "Track", "MultiTrack", "Model"}
CONTAINER_TAGS = {"Document", "Folder"}


def _local(tag: object) -> str:
    """Tag name without its XML namespace: '{http://www.opengis.net/kml/2.2}Point' -> 'Point'."""
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _children(el: Element, name: str) -> list[Element]:
    return [c for c in el if _local(c.tag) == name]


def _child(el: Element, name: str) -> Element | None:
    found = _children(el, name)
    return found[0] if found else None


def _child_text(el: Element, name: str) -> str | None:
    child = _child(el, name)
    if child is None or child.text is None:
        return None
    return child.text.strip() or None


def _to_position(values: list[str]) -> list[float]:
    if len(values) < 2:
        raise ValueError(f"Coordinate '{','.join(values)}' needs at least longitude and latitude.")
    try:
        position = [float(v) for v in values[:3]]
    except ValueError as exc:
        raise ValueError(f"Non-numeric coordinate '{','.join(values)}'.") from exc
    lon, lat = position[0], position[1]
    if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
        raise ValueError(f"Coordinate ({lon}, {lat}) is outside valid longitude/latitude range.")
    return position


def _coordinates(el: Element) -> list[list[float]]:
    text = _child_text(el, "coordinates")
    if not text:
        raise ValueError(f"<{_local(el.tag)}> has no coordinates.")
    return [_to_position(token.split(",")) for token in text.split()]


def _ring(boundary: Element | None) -> list[list[float]]:
    ring_el = _child(boundary, "LinearRing") if boundary is not None else None
    if ring_el is None:
        raise ValueError("Polygon boundary has no <LinearRing>.")
    ring = _coordinates(ring_el)
    if ring[0][:2] != ring[-1][:2]:
        ring.append(list(ring[0]))  # KML requires closed rings; repair if the author forgot
    if len(ring) < 4:
        raise ValueError("A polygon ring needs at least 3 distinct points.")
    return ring


def _track(el: Element) -> list[list[float]]:
    coords = [c.text.split() for c in el if _local(c.tag) == "coord" and c.text]
    points = [_to_position(c) for c in coords]
    if len(points) < 2:
        raise ValueError("gx:Track needs at least 2 <gx:coord> points.")
    return points


def _merge_multi(parts: list[dict]) -> dict:
    """MultiGeometry → Multi* when all parts share one type, else GeometryCollection."""
    simple = {"Point": "MultiPoint", "LineString": "MultiLineString", "Polygon": "MultiPolygon"}
    flattened: list[dict] = []
    for part in parts:
        if part["type"] in simple.values():  # nested Multi* → split into its members
            single = part["type"].removeprefix("Multi")
            flattened.extend({"type": single, "coordinates": c} for c in part["coordinates"])
        else:
            flattened.append(part)
    types = {p["type"] for p in flattened}
    if len(types) == 1 and (only := types.pop()) in simple:
        return {"type": simple[only], "coordinates": [p["coordinates"] for p in flattened]}
    return {"type": "GeometryCollection", "geometries": parts}


def parse_geometry(el: Element) -> dict:
    kind = _local(el.tag)
    if kind == "Point":
        return {"type": "Point", "coordinates": _coordinates(el)[0]}
    if kind in ("LineString", "LinearRing"):
        coords = _coordinates(el)
        if len(coords) < 2:
            raise ValueError(f"{kind} needs at least 2 points.")
        return {"type": "LineString", "coordinates": coords}
    if kind == "Polygon":
        outer = _ring(_child(el, "outerBoundaryIs"))
        inner = [_ring(b) for b in _children(el, "innerBoundaryIs")]
        return {"type": "Polygon", "coordinates": [outer, *inner]}
    if kind == "Track":
        return {"type": "LineString", "coordinates": _track(el)}
    if kind in ("MultiGeometry", "MultiTrack"):
        parts = [parse_geometry(c) for c in el if _local(c.tag) in GEOMETRY_TAGS]
        if not parts:
            raise ValueError(f"<{kind}> contains no geometries.")
        return _merge_multi(parts)
    raise UnsupportedGeometryError(f"KML <{kind}> geometry is not supported for measurement.")


def _properties(placemark: Element) -> dict:
    props: dict = {}
    for key in ("name", "description"):
        if (value := _child_text(placemark, key)) is not None:
            props[key] = value
    extended = _child(placemark, "ExtendedData")
    if extended is not None:
        for data in _children(extended, "Data"):
            if data.get("name"):
                props[data.get("name")] = _child_text(data, "value")
        for schema_data in _children(extended, "SchemaData"):
            for simple in _children(schema_data, "SimpleData"):
                if simple.get("name"):
                    props[simple.get("name")] = (simple.text or "").strip() or None
    return props


def _feature(placemark: Element, layer: str) -> RawFeature:
    props = _properties(placemark)
    geom_el = next((c for c in placemark if _local(c.tag) in GEOMETRY_TAGS), None)
    if geom_el is None:
        return RawFeature(layer, None, props, None, "Placemark has no geometry.", ProblemKind.INVALID)
    declared = _local(geom_el.tag)
    try:
        return RawFeature(layer, parse_geometry(geom_el), props, declared)
    except UnsupportedGeometryError as exc:
        return RawFeature(layer, None, props, declared, str(exc), ProblemKind.UNSUPPORTED)
    except ValueError as exc:
        return RawFeature(layer, None, props, declared, str(exc), ProblemKind.INVALID)


def _walk(el: Element, layer: str, out: list[RawFeature]) -> None:
    """Depth-first, document-order walk. The nearest Folder/Document name becomes the layer."""
    for child in el:
        tag = _local(child.tag)
        if tag in CONTAINER_TAGS:
            _walk(child, _child_text(child, "name") or layer, out)
        elif tag == "Placemark":
            out.append(_feature(child, layer))


def read_kml(data: bytes, default_layer: str) -> Dataset:
    try:
        root = SafeET.fromstring(data)
    except DefusedXmlException as exc:
        raise InvalidFileError("KML contains a DTD or entities, which are rejected for security reasons.") from exc
    except ParseError as exc:
        raise InvalidFileError(f"KML is not well-formed XML: {exc}") from exc
    if _local(root.tag) != "kml":
        raise InvalidFileError(f"Root element is <{_local(root.tag)}>, expected <kml>.")

    features: list[RawFeature] = []
    _walk(root, default_layer, features)
    dataset = Dataset(name=default_layer, crs=WGS84, features=features)
    if not features:
        dataset.warnings.append("The KML document contains no Placemarks.")
    return dataset
