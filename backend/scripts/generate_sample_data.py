"""Generate the demo files in sample_data/ (synthetic mine-site survey near Bengaluru).

python -m scripts.generate_sample_data
"""

import io
import zipfile
from pathlib import Path

import shapefile
from pyproj import CRS, Transformer
from shapely.geometry import LinearRing

OUT = Path(__file__).resolve().parent.parent / "sample_data"
UTM43N = CRS.from_epsg(32643)
WGS84 = CRS.from_epsg(4326)
WEB_MERCATOR = CRS.from_epsg(3857)
TO_LONLAT = Transformer.from_crs(UTM43N, WGS84, always_xy=True)
TO_MERCATOR = Transformer.from_crs(WGS84, WEB_MERCATOR, always_xy=True)

E, N = 781_000.0, 1_436_000.0  # origin of the synthetic site, UTM 43N metres


# Fixed timestamps so regenerating the samples produces byte-identical files (clean git diffs).
FIXED_ZIP_TIME = (2026, 1, 1, 0, 0, 0)
FIXED_DBF_DATE = bytes([2026 - 1900, 1, 1])  # dBASE header bytes 1-3: last-update date YY MM DD


def write_member(zf: zipfile.ZipFile, name: str, data: bytes | str) -> None:
    info = zipfile.ZipInfo(name, date_time=FIXED_ZIP_TIME)
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    zf.writestr(info, data)


def fixed_dbf(data: bytes) -> bytes:
    """pyshp stamps today's date into the .dbf header; replace it with a fixed date."""
    return data[:1] + FIXED_DBF_DATE + data[4:]


def rect(x, y, w, h):
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y)]


def clockwise(ring):
    """ESRI Shapefiles store polygon exterior rings clockwise (holes counter-clockwise)."""
    return ring[::-1] if LinearRing(ring).is_ccw else ring


def lonlat(points):
    return [TO_LONLAT.transform(x, y) for x, y in points]


def coords(points, alt=None):
    return " ".join(f"{x:.8f},{y:.8f}" + (f",{alt}" if alt is not None else "") for x, y in points)


def make_kml() -> bytes:
    pit = lonlat(rect(E, N, 600, 400))
    hole = lonlat(rect(E + 200, N + 150, 100, 80))[::-1]  # water pond inside the pit boundary
    stockpile = lonlat(rect(E + 700, N + 50, 150, 120))
    haul_road = lonlat([(E + 600, N + 200), (E + 650, N + 210), (E + 700, N + 110), (E + 900, N + 90)])
    flight = lonlat([(E + 100 * i, N + (450 if i % 2 else 500)) for i in range(10)])
    gcp = lonlat([(E + 10, N + 10)])[0]
    bowtie = lonlat([(E, N - 300), (E + 100, N - 200), (E + 100, N - 300), (E, N - 200), (E, N - 300)])

    when = "".join(f"<when>2026-09-01T10:{i:02d}:00Z</when>" for i in range(len(flight)))
    track = "".join(f"<gx:coord>{x:.8f} {y:.8f} 120</gx:coord>" for x, y in flight)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document>
  <name>Bengaluru mine site survey (synthetic)</name>
  <Folder>
    <name>Site boundaries</name>
    <Placemark>
      <name>Pit boundary</name>
      <ExtendedData><Data name="zone"><value>North pit</value></Data><Data name="surveyed_by"><value>Drone-07</value></Data></ExtendedData>
      <Polygon>
        <outerBoundaryIs><LinearRing><coordinates>{coords(pit)}</coordinates></LinearRing></outerBoundaryIs>
        <innerBoundaryIs><LinearRing><coordinates>{coords(hole)}</coordinates></LinearRing></innerBoundaryIs>
      </Polygon>
    </Placemark>
    <Placemark>
      <name>Stockpile A</name>
      <ExtendedData><Data name="material"><value>Iron ore</value></Data></ExtendedData>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>{coords(stockpile, 0)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>
    <Placemark>
      <name>Disputed parcel (self-intersecting)</name>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>{coords(bowtie)}</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>
  </Folder>
  <Folder>
    <name>Infrastructure</name>
    <Placemark><name>Haul road</name><LineString><coordinates>{coords(haul_road)}</coordinates></LineString></Placemark>
    <Placemark><name>GCP-01</name><Point><coordinates>{coords([gcp], 912.4)}</coordinates></Point></Placemark>
    <Placemark><name>Conveyor tower</name><Model><Link><href>tower.dae</href></Link></Model></Placemark>
  </Folder>
  <Folder>
    <name>Flight logs</name>
    <Placemark><name>Mission 2026-09-01</name><gx:Track>{when}{track}</gx:Track></Placemark>
  </Folder>
</Document>
</kml>
""".encode()


def shapefile_zip(layers: dict[str, tuple[int, list, list[dict], CRS | None]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, (shape_type, shapes, records, crs) in layers.items():
            shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
            w = shapefile.Writer(shp=shp, shx=shx, dbf=dbf, shapeType=shape_type)
            for key in records[0]:
                w.field(key, "N" if isinstance(records[0][key], (int, float)) else "C", size=60, decimal=2)
            for parts, record in zip(shapes, records, strict=True):
                if shape_type == shapefile.POLYGON:
                    w.poly([clockwise(ring) for ring in parts])  # sample polygons have no holes
                else:
                    w.line(parts)
                w.record(**record)
            w.close()
            write_member(zf, f"{name}.shp", shp.getvalue())
            write_member(zf, f"{name}.shx", shx.getvalue())
            write_member(zf, f"{name}.dbf", fixed_dbf(dbf.getvalue()))
            write_member(zf, f"{name}.cpg", "UTF-8")
            if crs is not None:
                write_member(zf, f"{name}.prj", crs.to_wkt("WKT1_ESRI"))
    return buf.getvalue()


def main() -> None:
    OUT.mkdir(exist_ok=True)
    (OUT / "mine_site_survey.kml").write_bytes(make_kml())

    parcels = [[rect(E, N, 500, 500)], [rect(E + 600, N, 250, 400)], [rect(E, N + 600, 1000, 100)]]
    roads = [[[(E, N - 50), (E + 1000, N - 50)]], [[(E + 550, N - 50), (E + 550, N + 700)]]]
    (OUT / "parcels_utm43n.zip").write_bytes(
        shapefile_zip(
            {
                "parcels": (
                    shapefile.POLYGON,
                    parcels,
                    [
                        {"parcel_id": "P-001", "owner": "Demo Mining Co."},
                        {"parcel_id": "P-002", "owner": "Demo Mining Co."},
                        {"parcel_id": "P-003", "owner": "State land"},
                    ],
                    UTM43N,
                ),
                "access_roads": (
                    shapefile.POLYLINE,
                    roads,
                    [{"road_id": "R-1", "surface": "gravel"}, {"road_id": "R-2", "surface": "paved"}],
                    UTM43N,
                ),
            }
        )
    )

    # Same 1 km x 1 km "square" stored in Web Mercator: naive area would be 1,000,000 m².
    x, y = TO_MERCATOR.transform(*TO_LONLAT.transform(E, N))
    (OUT / "web_mercator_square.zip").write_bytes(
        shapefile_zip(
            {
                "mercator_square": (
                    shapefile.POLYGON,
                    [[rect(x, y, 1000, 1000)]],
                    [{"note": "1000 x 1000 Web Mercator units"}],
                    WEB_MERCATOR,
                )
            }
        )
    )

    # Broken on purpose: .dbf missing, to demonstrate validation.
    with (
        zipfile.ZipFile(OUT / "parcels_utm43n.zip") as full,
        zipfile.ZipFile(OUT / "broken_missing_dbf.zip", "w") as zf,
    ):
        for name in full.namelist():
            if name.startswith("parcels.") and not name.endswith(".dbf"):
                write_member(zf, name, full.read(name))
    print(f"Sample data written to {OUT}")


if __name__ == "__main__":
    main()
