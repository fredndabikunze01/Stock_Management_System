# Stock Management System

A lightweight full-stack inventory application for the Development Operations containerization assignment. The React interface manages products and stock; a Spring Boot REST API applies business rules and records every stock movement; PostgreSQL stores the data on a persistent Docker volume.

## Objectives

- Manage and search a product catalog.
- Add and remove inventory with validation that prevents negative stock.
- Review low-stock and out-of-stock products, dashboard totals, and movement history.
- Run the frontend, API, and database as separate Docker Compose services.
- Build and publish the frontend and backend images independently to Docker Hub.

## Technologies

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Axios, Bootstrap 5 |
| Backend | Java 17, Spring Boot 3, Spring Data JPA, Maven |
| Database | PostgreSQL 16 |
| Containers | Docker, Docker Compose, Nginx |
| API checks | curl or Postman |

## Architecture

```text
Browser ── HTTP :3000 ──> Frontend container (Nginx + React)
                                  │ /api/* reverse proxy
                                  ▼
                         Backend container (:8080)
                                  │ JDBC on private Docker network
                                  ▼
                         PostgreSQL container (:5432)
                                  │
                            postgres_data volume
```

In Compose, Nginx proxies `/api/` to the `backend` service using the Docker network. Browser requests use a same-origin relative URL, so the browser does not need to resolve the internal Docker hostname. The backend connects to PostgreSQL at `postgres:5432` (not `localhost`). The database is not published to the host by default.

## Project layout

```text
Stock_Management_System/
├── backend/
│   ├── src/main/java/com/example/stockmanagement/
│   │   ├── config/          # CORS configuration
│   │   ├── controller/      # REST endpoints
│   │   ├── dto/             # Validated API requests and responses
│   │   ├── exception/       # Consistent API error responses
│   │   ├── model/           # Product and stock movement entities
│   │   ├── repository/      # Spring Data repositories
│   │   └── service/         # Business logic and transactions
│   ├── src/test/            # Backend unit tests
│   ├── Dockerfile
│   └── pom.xml
├── frontend/
│   ├── src/                 # React app, API client, and styles
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── docker-compose.published.yml
├── .env.example
└── README.md
```

## Prerequisites

- Docker Engine with Docker Compose v2 (`docker compose`).
- For running without containers: Java 17, Maven 3.9+, Node.js 22+, npm, PostgreSQL 16, and `jq` for the optional command-line CRUD examples.
- A Docker Hub account for publishing images.

## Run with Docker Compose (recommended)

From the project root, make a local environment file and set a non-default password:

```bash
cp .env.example .env
```

Edit `.env`; at minimum replace `POSTGRES_PASSWORD`. Never commit `.env`. For a normal local run, the Docker Hub username is not used.

Build the images and start all three services:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

The backend starts after PostgreSQL passes its health check; the frontend starts after the API reports ready. Open:

- Frontend: <http://localhost:3000>
- Backend health: <http://localhost:8080/actuator/health>
- Backend API: <http://localhost:8080/api>

Stop the containers and keep the database contents:

```bash
docker compose down
```

To also delete the persisted database, use `docker compose down -v`. This permanently removes the named `postgres_data` volume.

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `POSTGRES_DB` | PostgreSQL database name | `stock_management` |
| `POSTGRES_USER` | PostgreSQL application user | `stock_user` |
| `POSTGRES_PASSWORD` | Database password; required | Set in `.env` |
| `LOW_STOCK_THRESHOLD` | Positive quantity at or below which a product is low-stock | `10` |
| `FRONTEND_PORT` | Host port mapped to Nginx | `3000` |
| `BACKEND_PORT` | Host port mapped to the API | `8080` |
| `CORS_ALLOWED_ORIGINS` | Allowed local browser origins for direct API access | `http://localhost:3000,http://localhost:5173` |
| `DOCKERHUB_USERNAME` | Docker Hub account for the published-image Compose file | Set in `.env` |

Database credentials are injected into the backend from the Compose environment; they are not embedded in application source or the image. Hibernate `ddl-auto=update` is convenient for this assignment; use managed schema migrations for a production deployment.

## Run locally without Docker

Start a local PostgreSQL 16 server and create a database/user matching the values below (or set different values in the environment):

```bash
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/stock_management
export SPRING_DATASOURCE_USERNAME=stock_user
export SPRING_DATASOURCE_PASSWORD='your_local_database_password'
export SPRING_JPA_HIBERNATE_DDL_AUTO=update
export LOW_STOCK_THRESHOLD=10
cd backend
mvn spring-boot:run
```

In another terminal:

```bash
cd frontend
npm install
VITE_API_BASE_URL=http://localhost:8080/api npm run dev
```

Open <http://localhost:5173>. `CORS_ALLOWED_ORIGINS` defaults to allow the Vite origin. For the frontend build, `VITE_API_BASE_URL` is a Vite build-time setting; the containerized production build defaults to `/api` and uses Nginx proxy routing. 

## REST API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/products?search=term` | List/search products by name or code |
| `GET` | `/api/products/{id}` | Product details |
| `POST` | `/api/products` | Create product |
| `PUT` | `/api/products/{id}` | Update product details |
| `DELETE` | `/api/products/{id}` | Delete product without movement history |
| `POST` | `/api/stock/add` | Add stock and record an `IN` movement |
| `POST` | `/api/stock/remove` | Remove available stock and record an `OUT` movement |
| `GET` | `/api/stock/movements` | List movement history, newest first |
| `GET` | `/api/dashboard/summary` | Product and stock totals plus recent movements |

Example request bodies:

```json
{
  "code": "KB-001",
  "name": "Wireless Keyboard",
  "description": "Compact wireless keyboard",
  "price": 49.99,
  "quantity": 0
}
```

```json
{
  "productId": 1,
  "quantity": 12,
  "description": "Purchase order PO-1042"
}
```

Stock operations lock the product row and update its quantity in the same transaction as the movement record. An attempted removal above available stock returns HTTP 409. A product created with an opening quantity records an opening `IN` movement; later quantity changes must use the stock endpoints. Product codes are unique (case-insensitive). Products with movement history cannot be deleted so that the audit trail is retained. The API responds with a JSON error object for validation, missing product, and business-rule failures.

## Build, publish, and pull Docker Hub images

Create the two Docker Hub repositories named `stock-management-frontend` and `stock-management-backend` under your account. Replace the placeholder username below with your actual Docker Hub username; do not include angle brackets.

```bash
docker login

# Build directly from the individual image contexts:
docker build -t YOUR_DOCKERHUB_USERNAME/stock-management-backend:latest .
docker build -t YOUR_DOCKERHUB_USERNAME/stock-management-frontend:latest .

# (Optional) Tag a version in addition to latest:
docker tag YOUR_DOCKERHUB_USERNAME/stock-management-backend:latest YOUR_DOCKERHUB_USERNAME/stock-management-backend:1.0.0
docker tag YOUR_DOCKERHUB_USERNAME/stock-management-frontend:latest YOUR_DOCKERHUB_USERNAME/stock-management-frontend:1.0.0

# Publish:
docker push YOUR_DOCKERHUB_USERNAME/stock-management-backend:latest
docker push YOUR_DOCKERHUB_USERNAME/stock-management-backend:1.0.0
docker push YOUR_DOCKERHUB_USERNAME/stock-management-frontend:latest
docker push YOUR_DOCKERHUB_USERNAME/stock-management-frontend:1.0.0
```

Build and push from Compose-built images instead, if preferred:

```bash
docker compose build
docker tag stock-management-backend:local YOUR_DOCKERHUB_USERNAME/stock-management-backend:latest
docker tag stock-management-frontend:local YOUR_DOCKERHUB_USERNAME/stock-management-frontend:latest
docker push YOUR_DOCKERHUB_USERNAME/stock-management-backend:latest
docker push YOUR_DOCKERHUB_USERNAME/stock-management-frontend:latest
```

To pull and run the published images with PostgreSQL, first set `DOCKERHUB_USERNAME` in `.env` to your account name, retain the database password, then use the image-only Compose definition:

```bash
# Pull each published application image:
docker pull YOUR_DOCKERHUB_USERNAME/stock-management-backend:latest
docker pull YOUR_DOCKERHUB_USERNAME/stock-management-frontend:latest

# Compose runs those pulled images alongside PostgreSQL:
docker compose -f docker-compose.published.yml pull backend frontend
docker compose -f docker-compose.published.yml up -d
docker compose -f docker-compose.published.yml ps
```

Open <http://localhost:3000>. Confirm the actual registry image references and container health:

```bash
docker image ls YOUR_DOCKERHUB_USERNAME/stock-management-frontend
docker image ls YOUR_DOCKERHUB_USERNAME/stock-management-backend
docker compose -f docker-compose.published.yml logs --tail=100 backend frontend
curl -fsS http://localhost:8080/actuator/health
curl -fsS http://localhost:3000/api/products
```

`docker-compose.published.yml` intentionally has no `build:` sections: Compose must pull and run the images from Docker Hub. Database data remains in the same named volume when switching between the local-build and published-image Compose files.

Repository links (replace after publishing):

- Frontend: <https://hub.docker.com/r/YOUR_DOCKERHUB_USERNAME/stock-management-frontend>
- Backend: <https://hub.docker.com/r/YOUR_DOCKERHUB_USERNAME/stock-management-backend>

## Testing and verification

### Automated backend tests

```bash
cd backend
mvn test
```

### Verify running services

```bash
docker compose ps
curl -fsS http://localhost:8080/actuator/health
curl -fsS http://localhost:3000/api/dashboard/summary
curl -fsS http://localhost:3000/api/products
```

The root URL `http://localhost:3000` should load the React application; API calls in the browser's Network panel should use `/api/...` and return successfully.

### Exercise product, stock, history, and dashboard endpoints

These commands use `jq` to capture a product ID. Set `API=http://localhost:8080` if calling the backend directly, or `API=http://localhost:3000` to also test the Nginx proxy.

```bash
API=http://localhost:3000
PRODUCT_ID=$(curl -fsS -X POST "$API/api/products" \
  -H 'Content-Type: application/json' \
  -d '{"code":"DEMO-001","name":"Demo product","description":"Assignment test item","price":12.50,"quantity":0}' | jq -r .id)

# Search, read, and update the product:
curl -fsS "$API/api/products?search=DEMO-001"
curl -fsS "$API/api/products/$PRODUCT_ID"
curl -fsS -X PUT "$API/api/products/$PRODUCT_ID" -H 'Content-Type: application/json' \
  -d '{"code":"DEMO-001","name":"Updated demo product","description":"Updated details","price":14.00,"quantity":0}'

# Add and remove stock; then inspect history and dashboard:
curl -fsS -X POST "$API/api/stock/add" -H 'Content-Type: application/json' \
  -d "{\"productId\":$PRODUCT_ID,\"quantity\":8,\"description\":\"Test receipt\"}"
curl -fsS -X POST "$API/api/stock/remove" -H 'Content-Type: application/json' \
  -d "{\"productId\":$PRODUCT_ID,\"quantity\":3,\"description\":\"Test issue\"}"
curl -fsS "$API/api/stock/movements"
curl -fsS "$API/api/dashboard/summary"

# This should fail with HTTP 409 because only five units remain:
curl -i -X POST "$API/api/stock/remove" -H 'Content-Type: application/json' \
  -d "{\"productId\":$PRODUCT_ID,\"quantity\":99,\"description\":\"Negative stock check\"}"
```

Products with movement history are protected from deletion. To test delete, create a second product and delete it before recording a movement:

```bash
DELETE_ID=$(curl -fsS -X POST "$API/api/products" -H 'Content-Type: application/json' \
  -d '{"code":"DELETE-TEST","name":"Delete test","description":"","price":1,"quantity":0}' | jq -r .id)
curl -i -X DELETE "$API/api/products/$DELETE_ID"
```

### Verify database persistence after restart

Create at least one product, restart the containers without removing volumes, then check the product still exists:

```bash
docker compose restart
curl -fsS http://localhost:3000/api/products
```

For registry verification, use the pull-and-run steps above in a clean Docker environment (or remove only the two application images before pulling again). A local `docker build` alone does not demonstrate that Docker Hub publishing or pulling succeeded.

## Assignment screenshot checklist

- [ ] Application dashboard and product catalog running in a browser.
- [ ] React/Nginx frontend container running (`docker compose ps`).
- [ ] Spring Boot backend container healthy/running.
- [ ] PostgreSQL container healthy/running.
- [ ] Frontend and backend images built successfully (`docker image ls` or build output).
- [ ] Docker Hub frontend repository displaying the published tag.
- [ ] Docker Hub backend repository displaying the published tag.
- [ ] Successful `docker pull` output for both published images (or `docker compose ... pull`).
- [ ] Application running with images from `docker-compose.published.yml`, not a local build.

## Troubleshooting

- **Compose says `POSTGRES_PASSWORD` is missing:** copy `.env.example` to `.env` and set `POSTGRES_PASSWORD`.
- **Frontend shows an API error:** run `docker compose ps`, inspect `docker compose logs backend frontend`, and confirm backend readiness at `http://localhost:8080/actuator/health`.
- **Backend cannot connect to PostgreSQL:** verify both services share `stock-network`, check `docker compose logs postgres`, and use the `postgres` service name in the JDBC URL. Never use `localhost` for the database from the backend container.
- **Port is already in use:** change `FRONTEND_PORT` or `BACKEND_PORT` in `.env`, then recreate with `docker compose up -d`.
- **Docker Hub pull is denied:** verify `docker login`, the username/repository spelling, visibility/permissions, and that the requested tag was pushed.
- **Published Compose requires username:** set `DOCKERHUB_USERNAME` in `.env` to your real Docker Hub username, not the example placeholder.
- **Need a clean database:** `docker compose down -v` deletes the persistent database volume. This operation is destructive.
- **Frontend is stale after source changes:** rebuild with `docker compose up --build -d frontend`.
