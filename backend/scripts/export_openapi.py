"""Write the API's OpenAPI schema to openapi.json (the frontend generates its types from it).

Run from backend/:  python -m scripts.export_openapi
"""

import json
from pathlib import Path

from app.config import Settings
from app.main import create_app

OUT = Path(__file__).resolve().parent.parent / "openapi.json"


def render_schema() -> str:
    # In-memory settings: building the schema must not touch a real database or read .env.
    app = create_app(Settings(_env_file=None, database_url="sqlite://"))
    return json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main() -> None:
    OUT.write_text(render_schema(), encoding="utf-8")
    print(f"OpenAPI schema written to {OUT}")


if __name__ == "__main__":
    main()
