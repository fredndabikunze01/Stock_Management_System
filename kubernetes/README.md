# Stock Management System on Kubernetes

This deployment targets a local Minikube cluster. It uses the existing public
Docker Hub images, keeps PostgreSQL private inside the cluster, and exposes the
React application through a NodePort.

## Architecture

```text
Browser
  │ http://<minikube-ip>:30080 (or minikube service frontend-service)
  ▼
frontend-service (NodePort 30080) → frontend Pod (Nginx :80)
                                      │ /api/* proxy; API_BACKEND=backend-service:8081
                                      ▼
                            backend-service (ClusterIP :8081)
                                      │ JDBC: postgres-service:5432
                                      ▼
                            postgres-service (ClusterIP :5432)
                                      │
                            postgres-pvc (persistent storage)
```

The browser sends same-origin `/api/...` requests to Nginx. Nginx forwards
those requests to the `backend-service` Kubernetes DNS name, so browser
JavaScript never needs to resolve an internal cluster address. The backend
uses `postgres-service:5432`; it must not use `localhost` for the database.
Only the frontend Service is exposed outside the cluster.

## Manifest reference

| File | Purpose |
|---|---|
| `namespace.yaml` | Creates the dedicated `stock-management` namespace. |
| `postgres-secret.yaml` | Documents the Secret resource name and type. It deliberately contains no credentials and is not included in Kustomize. The deployment script creates/updates it from `POSTGRES_PASSWORD`. |
| `postgres-pvc.yaml` | Requests 1 GiB of persistent storage using Minikube's default StorageClass. |
| `postgres-deployment.yaml` | Runs the official `postgres:16-alpine` image, mounts the PVC, reads credentials from the Secret, and probes with `pg_isready`. |
| `postgres-service.yaml` | Provides private in-cluster PostgreSQL access on port 5432. |
| `backend-deployment.yaml` | Runs the existing Java 17 Spring Boot image on port 8081 with database environment variables, resource bounds, and Actuator startup/readiness/liveness probes. |
| `backend-service.yaml` | Provides private in-cluster backend access on port 8081. |
| `frontend-deployment.yaml` | Runs the existing Nginx/React image on port 80 and sets `API_BACKEND=backend-service:8081`. |
| `frontend-service.yaml` | Exposes Nginx as a NodePort Service on port 30080. |
| `kustomization.yaml` | Collects the namespace and workload manifests for `kubectl apply -k`. The Secret is excluded so a placeholder manifest cannot overwrite the runtime credential. |

Database name and username use the values already configured in Compose:
`stock_management` and `stock_user`. The backend listens on 8081 and probes
`/actuator/health/readiness` and `/actuator/health/liveness`, which are enabled
by the application's Actuator configuration.

The PVC requests 1 GiB because the Compose named volume has no size limit.
Adjust that request to fit the Minikube storage available for your data.
PostgreSQL uses a single replica and a `Recreate` strategy because a
ReadWriteOnce volume is intended for one database pod.

The Kubernetes PVC is separate from the Docker Compose named volume. The
deployment creates a new, empty Kubernetes database; existing Compose data is
not copied automatically. If existing inventory must be retained, back up
PostgreSQL and plan a database dump/restore into Kubernetes before switching
users to the new frontend.

Kubernetes Secrets are not encryption by themselves. This configuration
prevents the password from being committed in the manifests; restrict access
to the Minikube cluster and its Secret resources as well.

## Prerequisites

- Docker Engine and Minikube with the Docker driver.
- `kubectl`, `curl`, and Bash.
- The Jenkins/local deployment identity can reach the Minikube API server.
- Both Docker Hub images are public, or you have configured a Kubernetes
  `imagePullSecret` for private repositories.

Start and inspect Minikube:

```bash
minikube status
minikube start --driver=docker --cpus=4 --memory=1800
kubectl get nodes
```

## Deploy locally

The recommended script creates the namespace and database Secret, deploys
PostgreSQL first, waits for its PVC and readiness, then deploys and waits for
the backend and frontend. If the Secret is already present, it reuses it. If
the Secret is missing, the script prompts for the PostgreSQL password without
echoing it. Jenkins supplies the password via its Secret text credential:

```bash
scripts/deploy-kubernetes.sh
```

For automation, provide the password through a secret manager or CI credential
instead of putting it in a command, shell history, or source file:

```bash
export POSTGRES_PASSWORD
scripts/deploy-kubernetes.sh
unset POSTGRES_PASSWORD
```

The script defaults to the `minikube` Kubernetes context and Minikube profile.
Override `KUBE_CONTEXT` or `MINIKUBE_PROFILE` if you use different names.
Override `BACKEND_IMAGE` or `FRONTEND_IMAGE` to deploy versioned image tags.

To apply the Kustomize bundle manually, first create the namespace and the
Secret (the Secret is intentionally not part of Kustomize):

```bash
kubectl apply -f kubernetes/namespace.yaml
read -r -s -p "PostgreSQL password: " POSTGRES_PASSWORD
printf '\n'
printf '%s' "$POSTGRES_PASSWORD" | kubectl create secret generic postgres-secret \
  --namespace stock-management \
  --from-file=POSTGRES_PASSWORD=/dev/stdin \
  --dry-run=client -o yaml |
  kubectl apply --server-side --force-conflicts \
    --field-manager=stock-management-deployer -f -
unset POSTGRES_PASSWORD
kubectl apply -k kubernetes/
kubectl rollout status deployment/postgres -n stock-management --timeout=240s
kubectl rollout status deployment/backend -n stock-management --timeout=300s
kubectl rollout status deployment/frontend -n stock-management --timeout=180s
```

## Access and verification

Open the frontend using Minikube's service helper:

```bash
minikube service frontend-service -n stock-management
```

With the Docker driver, the helper may print a URL or maintain a tunnel while
it runs. The NodePort is `30080`; the direct URL, when the Minikube node IP is
reachable from your host, is `http://$(minikube ip):30080`.

Run the automated checks:

```bash
scripts/verify-kubernetes.sh
```

The script verifies the node, pods, deployments, PostgreSQL readiness, backend
readiness through the frontend pod's network, and frontend plus proxied API
responses using a temporary local port-forward.

Useful inspection commands:

```bash
kubectl get nodes
kubectl get pods -n stock-management
kubectl get services -n stock-management
kubectl get deployments -n stock-management
kubectl get pvc -n stock-management
kubectl describe pods -n stock-management
```

View logs:

```bash
kubectl logs -n stock-management deployment/postgres
kubectl logs -n stock-management deployment/backend
kubectl logs -n stock-management deployment/frontend
kubectl logs -n stock-management deployment/backend --previous
```

Restart or scale the stateless applications:

```bash
kubectl rollout restart deployment/backend -n stock-management
kubectl rollout restart deployment/frontend -n stock-management
kubectl scale deployment/backend --replicas=2 -n stock-management
kubectl scale deployment/frontend --replicas=2 -n stock-management
```

Keep PostgreSQL at one replica with this PVC and `Recreate` strategy. Do not
delete the PVC when restarting or updating the application. Removing the
namespace or PVC can permanently delete the database data.

## Jenkins deployment

The root `Jenkinsfile` keeps Compose configuration validation and adds backend
tests, frontend production-build validation, Docker image build/push, staged
Kubernetes deployment, rollout checks, and smoke tests.

Configure these Jenkins credentials:

| Credential ID | Jenkins kind | Used for |
|---|---|---|
| `stock-management-postgres-password` | Secret text | PostgreSQL password injected when creating/updating the Kubernetes Secret. |
| `dockerhub-credentials` | Username with password | Docker Hub login and image publication. Use a Docker Hub access token as the password. |
| `minikube-kubeconfig` | Secret file | Kubeconfig with the `minikube` context and credentials accessible to the Jenkins agent. |

The Jenkins agent needs Docker and Compose v2, Java 17/Maven, Node.js 22/npm,
`kubectl`, `minikube`, and `curl`. It must have permission to use Docker and
access the running Minikube profile/API server. If Jenkins runs in a container,
ensure its kubeconfig is self-contained and that its network can reach the
Minikube API server; a kubeconfig that references certificate files only
present on the host will not work in the container.

On each successful build Jenkins publishes both a commit-specific image tag
and `latest`, then deploys the commit-specific images. Rollout status and a
frontend/API smoke check must pass for the pipeline to succeed.

## Troubleshooting

- **Pod is `ImagePullBackOff`:** check the image name/tag and Docker Hub
  visibility. For private repositories, configure and reference an
  `imagePullSecret`.
- **PostgreSQL pod does not become ready:** inspect its logs, PVC status, and
  Secret key:

  ```bash
  kubectl logs -n stock-management deployment/postgres
  kubectl describe pvc -n stock-management postgres-pvc
  kubectl describe secret -n stock-management postgres-secret
  ```

- **Backend reports a datasource error:** confirm PostgreSQL is ready and the
  JDBC URL uses `postgres-service:5432`. The Secret value must match the
  password used when the database volume was initialized; changing the Secret
  does not alter an existing PostgreSQL user's password.
- **Frontend loads but API calls fail:** check backend readiness and confirm
  the frontend pod has `API_BACKEND=backend-service:8081`. Nginx proxies
  `/api/` through this in-cluster service.
- **PVC remains `Pending`:** inspect `kubectl get storageclass` and Minikube
  storage-provisioner status. Ensure the default StorageClass is available.
- **Jenkins cannot connect to Minikube:** verify the kubeconfig credential,
  active context, API endpoint reachability, and that Minikube is running on
  an agent that can access its control plane.
- **Port 30080 is unavailable:** use `minikube service frontend-service -n
  stock-management` or `kubectl port-forward -n stock-management
  service/frontend-service 8080:80`.

<!-- getting link to deployed app -->
minikube service frontend-service -n stock-management --url

minikube service frontend-service -n stock-management