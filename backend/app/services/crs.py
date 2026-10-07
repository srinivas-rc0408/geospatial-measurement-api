"""CRS helpers: readable labels and the choice of projected CRS used for measuring.

Strategy: every geometry is first brought to WGS84 (EPSG:4326), then projected into the
UTM zone that contains its centroid. UTM keeps scale error within about ±0.1% inside a
zone, far better than any single global projection.

UTM is undefined above 84°N / below 80°S. Universal Polar Stereographic (EPSG:32661/32761)
covers those areas but has ~0.4% scale error at 85°, so instead a Lambert Azimuthal
Equal-Area projection centred on the feature itself is built on the fly: equal-area by
construction, with negligible length distortion for site-sized features.
"""

from pyproj import CRS

WGS84 = CRS.from_epsg(4326)

UTM_MAX_LAT = 84.0
UTM_MIN_LAT = -80.0


def crs_label(crs: CRS | None) -> str | None:
    """Short human-readable name, e.g. ``EPSG:4326``; falls back to the CRS name."""
    if crs is None:
        return None
    authority = crs.to_authority(min_confidence=70)
    if authority:
        return f"{authority[0]}:{authority[1]}"
    return crs.name


def utm_zone(lon: float) -> int:
    lon = ((lon + 180.0) % 360.0) - 180.0  # normalise to [-180, 180)
    return int((lon + 180.0) // 6.0) + 1


def select_projected_crs(lon: float, lat: float) -> tuple[str, CRS]:
    """(label, CRS) of a metric projection suited to a geometry centred at (lon, lat)."""
    if lat > UTM_MAX_LAT or lat < UTM_MIN_LAT:
        lat0, lon0 = round(lat, 4), round(lon, 4)
        crs = CRS.from_proj4(f"+proj=laea +lat_0={lat0} +lon_0={lon0} +datum=WGS84 +units=m +no_defs")
        return f"LAEA(lat_0={lat0}, lon_0={lon0})", crs
    epsg = (32600 if lat >= 0 else 32700) + utm_zone(lon)  # WGS 84 / UTM north | south
    return f"EPSG:{epsg}", CRS.from_epsg(epsg)
