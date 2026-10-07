"""Convert values read from files (dates, Decimals, bytes, NaN, tuples) into JSON-serialisable data."""

import math
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any


def json_safe(value: Any) -> Any:
    if value is None or isinstance(value, bool | str | int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, Decimal):
        return json_safe(float(value))
    if isinstance(value, datetime | date | time):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [json_safe(v) for v in value]
    return str(value)
