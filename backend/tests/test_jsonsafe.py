from datetime import date, datetime
from decimal import Decimal

from app.services.jsonsafe import json_safe


def test_json_safe_converts_file_attribute_types():
    value = {
        "date": date(2026, 1, 2),
        "ts": datetime(2026, 1, 2, 3, 4, 5),
        "dec": Decimal("1.5"),
        "nan": float("nan"),
        "raw": b"caf\xc3\xa9",
        "tuple": (1, 2),
        1: object.__new__(type("Odd", (), {"__str__": lambda self: "odd"})),
    }
    assert json_safe(value) == {
        "date": "2026-01-02",
        "ts": "2026-01-02T03:04:05",
        "dec": 1.5,
        "nan": None,
        "raw": "café",
        "tuple": [1, 2],
        "1": "odd",
    }
