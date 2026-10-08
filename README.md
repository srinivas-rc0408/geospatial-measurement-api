# Geospatial File Measurement API

Upload a Shapefile or KML file and get accurate areas and lengths for every feature — computed in
the right map projection, never in raw latitude/longitude degrees.

- [`backend/`](backend/) — FastAPI service: upload, processing, measurements ([technical docs](backend/README.md))
- [`frontend/`](frontend/) — React web interface ([docs](frontend/README.md))
- [`docs/`](docs/) — [architecture](docs/ARCHITECTURE.md), [API contract](docs/API_CONTRACT.md),
  [decision log](docs/DECISIONS.md)

## Run the whole site locally

```bash
docker build -t geo-measure .
docker run --rm --env-file backend/.env -e PORT=8000 -p 8000:8000 geo-measure
```

Open **http://localhost:8000** for the app and **http://localhost:8000/docs** for the API. Without `--env-file`,
the app uses SQLite inside the container. For development with hot reload, run the backend and `npm run dev` as
described in each README.

## Deployment

One Render web service serves both the frontend and the API from one URL (Blueprint: [`render.yaml`](render.yaml)).
The root [`Dockerfile`](Dockerfile) builds the frontend in a Node stage, then copies the build into the API image,
which serves it next to `/api`. The database is Neon PostgreSQL in the same region (Singapore); the container runs
`alembic upgrade head` on start. Values to enter when creating the Blueprint:

| Variable | Value |
|---|---|
| `GEO_DATABASE_URL` | Neon **pooled** connection string |
| `GEO_MIGRATIONS_DATABASE_URL` | Neon **direct** connection string |
| `GEO_PUBLIC_URL` | the service URL, e.g. `https://geo-measure.onrender.com` (absolute link-preview URLs) |

The free instance sleeps after 15 minutes idle, and the first visit then takes about a minute. To keep it awake
during a review, point an uptime pinger at `/health` every ~10 minutes; that endpoint never queries the database,
so Neon still scales to zero.
