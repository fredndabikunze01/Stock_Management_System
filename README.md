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
Browser ── HTTP :3000 ──> Frontend container (Nginx + React :80)
                                  │ /api/* reverse proxy
                                  ▼
                         Backend container (:8081)
                                  │ JDBC on private Docker network
                                  ▼
                         PostgreSQL container (:5432)
                                  │
                            postgres_data volume
```

In Compose, Nginx proxies `/api/` to the `backend` service using the Docker network. Browser requests use a same-origin relative URL, so the browser does not need to resolve the internal Docker hostname. The backend connects to PostgreSQL at `postgres:5432` (not `localhost`). The database is not published to the host by default.

## Kubernetes deployment

For the Minikube deployment, Kubernetes manifests, Jenkins integration, and operational commands, see [kubernetes/README.md](kubernetes/README.md). Kubernetes uses a separate PostgreSQL volume; Compose database contents are not migrated automatically.

### Minikube and kubectl command reference

Run these commands from the project root unless stated otherwise. The
Kubernetes namespace is `stock-management`; the frontend is exposed through
`frontend-service` on NodePort `30080`. PostgreSQL and the backend are internal
ClusterIP Services.

#### Start and inspect Minikube

| Command | What it does |
|---|---|
| `minikube version` | Shows the installed Minikube version. |
| `minikube profile list` | Lists Minikube clusters/profiles on this machine. |
| `minikube status` | Checks whether the Minikube node and Kubernetes components are running. |
| `minikube start --driver=docker --cpus=4 --memory=1800` | Creates or starts the default cluster using Docker, 4 CPUs, and 1800 MB of memory. Minikube may warn that this is below its recommended memory. Existing clusters cannot have CPU/memory changed by rerunning this command; do not delete a cluster containing data just to change those values. |
| `minikube stop` | Stops the cluster but keeps its configuration and persistent data. |
| `minikube ip` | Prints the Minikube node IP; use it to try `http://$(minikube ip):30080` if the host can reach that IP. |
| `minikube service frontend-service -n stock-management` | Opens or prints a reachable URL for the frontend Service. This is the recommended frontend access method. |
| `minikube addons list` | Lists Minikube addons and whether they are enabled. |
| `minikube logs --problems` | Collects Minikube logs and reports detected cluster problems. |

#### Check kubectl and cluster access

| Command | What it does |
|---|---|
| `kubectl version --client` | Prints the installed kubectl client version. |
| `kubectl config current-context` | Shows which Kubernetes cluster kubectl commands currently target. |
| `kubectl get nodes -o wide` | Shows Kubernetes nodes, readiness, IP addresses, and runtime. A ready Minikube node should show `Ready`. |
| `kubectl cluster-info` | Shows Kubernetes control-plane and core-service endpoints. |
| `kubectl get namespaces` | Lists namespaces in the current cluster. |
| `kubectl get namespace stock-management` | Checks whether this application's namespace exists. |

#### Deploy or update the application

| Command | What it does |
|---|---|
| `kubectl apply -f kubernetes/namespace.yaml` | Creates or updates the application's namespace. |
| `scripts/deploy-kubernetes.sh` | Recommended deployment: securely prompts for the PostgreSQL password if the Secret is missing, deploys PostgreSQL first, waits for it, then deploys and waits for the backend and frontend. It reuses an existing Secret on reruns. |
| `kubectl apply -k kubernetes/` | Applies the Kustomize resources. It does **not** create `postgres-secret`; create that Secret securely first or use the deployment script. |
| `kubectl diff -k kubernetes/` | Previews changes Kustomize would apply, when supported by the installed kubectl. |
| `kubectl rollout status deployment/postgres -n stock-management --timeout=240s` | Waits for the PostgreSQL deployment to become available. |
| `kubectl rollout status deployment/backend -n stock-management --timeout=300s` | Waits for the backend deployment to become available. |
| `kubectl rollout status deployment/frontend -n stock-management --timeout=180s` | Waits for the frontend deployment to become available. |
| `kubectl rollout history deployment/backend -n stock-management` | Lists recorded backend rollout revisions. |
| `kubectl rollout undo deployment/backend -n stock-management` | Reverts the backend deployment to its previous revision, if one exists. |

#### Run the deployment and verification scripts

Open a terminal in the project root and run these commands in order:

```bash
# 1. Check that Minikube and its Kubernetes components are running.
minikube status

# 2. If the host status is not "Running", start the existing/default profile.
minikube start --driver=docker --cpus=4 --memory=1800

# 3. Deploy PostgreSQL, then the backend and frontend; wait for each rollout.
./scripts/deploy-kubernetes.sh

# 4. Check node, pod, service, database, backend, frontend, and proxied API health.
./scripts/verify-kubernetes.sh

# 5. Open the frontend in your browser.
minikube service frontend-service -n stock-management
```

Both scripts must be run from the project checkout and require `kubectl` and
`minikube`; the verification script also requires `curl`. The deploy script
will prompt without echoing if it needs the PostgreSQL password and the
Kubernetes Secret does not already exist. On later deployments it reuses that
Secret unless `POSTGRES_PASSWORD` is explicitly supplied. Do not put a real
password directly in a shell command or commit it to a file.

The deployment script should finish with successful rollout messages for
`postgres`, `backend`, and `frontend`, followed by their pod/service/deployment
status. The verification script should show successful rollout checks,
PostgreSQL accepting connections, backend health `UP`, and HTTP 200 responses
for both the frontend and `/api/products`. If a script fails, inspect the pod
events and application logs using the commands in the sections below.

If you apply manifests manually and the Secret does not exist, create it
without putting the password in the command history or a manifest:

```bash
read -r -s -p "PostgreSQL password: " POSTGRES_PASSWORD
printf '\n'
printf '%s' "$POSTGRES_PASSWORD" |
  kubectl create secret generic postgres-secret \
    -n stock-management \
    --from-file=POSTGRES_PASSWORD=/dev/stdin \
    --dry-run=client -o yaml |
  kubectl apply --server-side --force-conflicts \
    --field-manager=stock-management-deployer -f -
unset POSTGRES_PASSWORD
```

This creates/updates the Secret consumed by both PostgreSQL and the backend.
Kubernetes Secret values are sensitive; do not print or commit them.

For Jenkins, use the pipeline to publish and deploy commit-tagged images. The
Kubernetes deployment requires the Jenkins credentials described in
[kubernetes/README.md](kubernetes/README.md); do not put registry or database
passwords directly in commands or manifests.

#### Inspect pods, deployments, and services

| Command | What it does |
|---|---|
| `kubectl get pods -n stock-management` | Shows application pods and their status/restarts. |
| `kubectl get pods -n stock-management -o wide` | Also shows pod IPs and the node each pod runs on. |
| `kubectl get deployments -n stock-management` | Shows desired, ready, and available pod counts per deployment. |
| `kubectl get services -n stock-management` | Shows Service types, cluster IPs, ports, and NodePort. |
| `kubectl get all -n stock-management` | Gives a quick view of common workload resources. It does not include every resource type, such as PVCs or Secrets. |
| `kubectl get pvc -n stock-management` | Checks whether `postgres-pvc` is bound and how much storage it requests. |
| `kubectl get endpoints -n stock-management` | Checks which ready pod IPs each Service routes to. |
| `kubectl get events -n stock-management --sort-by=.lastTimestamp` | Shows recent namespace events, useful for scheduling, image-pull, and probe failures. |
| `kubectl get secret postgres-secret -n stock-management` | Confirms the Secret exists and shows its key count without printing its values. |
| `kubectl describe pod -n stock-management POD_NAME` | Shows a selected pod's configuration, conditions, and recent events; replace `POD_NAME` with a name from `get pods`. |
| `kubectl describe deployment backend -n stock-management` | Shows backend deployment settings, rollout status, and events. |
| `kubectl describe service frontend-service -n stock-management` | Shows frontend Service selectors, ports, and endpoints. |
| `kubectl describe pvc postgres-pvc -n stock-management` | Shows PostgreSQL volume binding details and storage events. |

#### Read logs and check application health

| Command | What it does |
|---|---|
| `kubectl logs -n stock-management deployment/postgres` | Prints the current PostgreSQL container logs. |
| `kubectl logs -n stock-management deployment/backend` | Prints Spring Boot backend logs. |
| `kubectl logs -n stock-management deployment/frontend` | Prints Nginx/frontend logs. |
| `kubectl logs -f -n stock-management deployment/backend` | Follows backend logs live; press `Ctrl+C` to stop following. |
| `kubectl logs --previous -n stock-management deployment/backend` | Prints logs from the previous backend container, useful after a crash/restart. |
| `kubectl exec -n stock-management deployment/postgres -- pg_isready -U stock_user -d stock_management` | Checks whether PostgreSQL accepts connections for this database/user. |
| `kubectl exec -n stock-management deployment/backend -- curl -fsS http://localhost:8081/actuator/health/readiness` | Calls the backend's Spring Actuator readiness endpoint from inside its pod. |
| `kubectl exec -n stock-management deployment/frontend -- wget -qO- http://backend-service:8081/actuator/health/readiness` | Checks that the frontend pod can resolve and reach the backend Service over the cluster network. |
| `scripts/verify-kubernetes.sh` | Runs the project's complete check: Minikube/node, rollout status, PostgreSQL, backend health, frontend, and proxied API. |

#### Access and test the frontend/API

| Command | What it does |
|---|---|
| `minikube service frontend-service -n stock-management` | Opens the frontend through Minikube's service tunnel/helper. |
| `curl -fsS http://$(minikube ip):30080/` | Tries the NodePort directly from the host; this depends on the Minikube driver/network. |
| `kubectl port-forward -n stock-management service/frontend-service 8080:80` | Temporarily forwards host port 8080 to frontend Nginx; leave running, then open `http://localhost:8080`. Press `Ctrl+C` to stop. |
| `curl -fsS http://localhost:8080/api/products` | With the port-forward above running, tests the API through Nginx and the backend Service. |
| `kubectl port-forward -n stock-management service/backend-service 8081:8081` | Temporarily exposes the backend locally for direct testing; press `Ctrl+C` to stop. |
| `curl -fsS http://localhost:8081/actuator/health` | With the backend port-forward above running, checks the backend health endpoint. |

#### Restart or scale workloads

| Command | What it does |
|---|---|
| `kubectl rollout restart deployment/backend -n stock-management` | Recreates the backend pod using its current image and configuration. |
| `kubectl rollout restart deployment/frontend -n stock-management` | Recreates the frontend pod using its current image and configuration. |
| `kubectl scale deployment/backend --replicas=2 -n stock-management` | Runs two backend pods; available node CPU/memory must be sufficient. |
| `kubectl scale deployment/frontend --replicas=2 -n stock-management` | Runs two frontend pods behind the same Service. |
| `kubectl scale deployment/backend --replicas=1 -n stock-management` | Returns the backend to one replica. |
| `kubectl scale deployment/frontend --replicas=1 -n stock-management` | Returns the frontend to one replica. |

Keep PostgreSQL at one replica with this ReadWriteOnce PVC. Restarting an
application deployment does not delete database data.

#### Stop or remove the deployment

| Command | What it does |
|---|---|
| `minikube stop` | Stops the local cluster while preserving its resources and database volume. |
| `kubectl delete -k kubernetes/` | **Destructive:** deletes the Kustomize resources, including the namespace and PostgreSQL PVC. Persistent database data may be permanently lost. |
| `kubectl delete namespace stock-management` | **Destructive:** deletes all namespaced application resources, including the PostgreSQL PVC. Persistent database data may be permanently lost. |
| `minikube delete` | **Destructive:** removes the selected Minikube cluster and its Kubernetes resources/data. Do not run as a routine stop/restart command. |

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
│   ├── .dockerignore
│   └── pom.xml
├── frontend/
│   ├── src/                 # React app, API client, and styles
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── docker-compose.published.yml
├── kubernetes/
│   ├── *.yaml
│   └── README.md
├── scripts/
│   ├── deploy-kubernetes.sh
│   └── verify-kubernetes.sh
├── Jenkinsfile
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
- Backend health: <http://localhost:8081/actuator/health>
- Backend API: <http://localhost:8081/api>

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
| `BACKEND_PORT` | Host port mapped to the API | `8081` |
| `CORS_ALLOWED_ORIGINS` | Allowed local browser origins for direct API access | `http://localhost:3000,http://localhost:5173` |
| `DOCKERHUB_USERNAME` | Docker Hub account for the published-image Compose file | Set in `.env` |

### Deploy with Jenkins

Configure a Jenkins Pipeline or Multibranch Pipeline to use this repository's `Jenkinsfile`. The Ubuntu agent must have Docker Engine, the Docker Compose v2 plugin, and permission to use the Docker daemon. Add a Jenkins **Secret text** credential with ID `stock-management-postgres-password`; Jenkins injects it at runtime and does not write it into the repository. The pipeline validates Compose, builds both application images, starts the Compose services, and smoke-tests the frontend and proxied API. The application is available at `http://<Ubuntu-host>:3000` (or the configured `FRONTEND_PORT`).

For deployments with an existing PostgreSQL volume, set the Jenkins credential to the password already used to initialize that database. PostgreSQL only applies `POSTGRES_USER`, `POSTGRES_DB`, and `POSTGRES_PASSWORD` when initializing an empty data directory.

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
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to `http://localhost:8081` by default; set `API_PROXY_TARGET` if the backend listens elsewhere. For a production build, `VITE_API_BASE_URL` defaults to the same-origin `/api` path, which Nginx proxies to the backend.

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
curl -fsS http://localhost:8081/actuator/health
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
curl -fsS http://localhost:8081/actuator/health
curl -fsS http://localhost:3000/api/dashboard/summary
curl -fsS http://localhost:3000/api/products
```

The root URL `http://localhost:3000` should load the React application; API calls in the browser's Network panel should use `/api/...` and return successfully.

### Exercise product, stock, history, and dashboard endpoints

These commands use `jq` to capture a product ID. Set `API=http://localhost:8081` if calling the backend directly, or `API=http://localhost:3000` to also test the Nginx proxy.

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
- **Frontend shows an API error:** run `docker compose ps`, inspect `docker compose logs backend frontend`, and confirm backend readiness at `http://localhost:8081/actuator/health`.
- **Backend cannot connect to PostgreSQL:** verify both services share `stock-network`, check `docker compose logs postgres`, and use the `postgres` service name in the JDBC URL. Never use `localhost` for the database from the backend container.
- **Port is already in use:** change `FRONTEND_PORT` or `BACKEND_PORT` in `.env`, then recreate with `docker compose up -d`.
- **Docker Hub pull is denied:** verify `docker login`, the username/repository spelling, visibility/permissions, and that the requested tag was pushed.
- **Published Compose requires username:** set `DOCKERHUB_USERNAME` in `.env` to your real Docker Hub username, not the example placeholder.
- **Need a clean database:** `docker compose down -v` deletes the persistent database volume. This operation is destructive.
- **Frontend is stale after source changes:** rebuild with `docker compose up --build -d frontend`.
