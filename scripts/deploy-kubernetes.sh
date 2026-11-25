#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMESPACE="${K8S_NAMESPACE:-stock-management}"
KUBE_CONTEXT="${KUBE_CONTEXT:-minikube}"
MINIKUBE_PROFILE="${MINIKUBE_PROFILE:-minikube}"
BACKEND_IMAGE="${BACKEND_IMAGE:-fredndabikunze01/stock-management-backend:latest}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-fredndabikunze01/stock-management-frontend:latest}"

for command in kubectl minikube; do
    if ! command -v "$command" >/dev/null 2>&1; then
        printf 'Required command not found: %s\n' "$command" >&2
        exit 1
    fi
done

if ! MINIKUBE_STATUS="$(minikube status --profile "$MINIKUBE_PROFILE" --format='{{.Host}}' 2>&1)"; then
    printf 'Unable to read Minikube status:\n%s\n' "$MINIKUBE_STATUS" >&2
    exit 1
fi
if [[ "$MINIKUBE_STATUS" != "Running" ]]; then
    printf 'Minikube profile "%s" is not running (host status: %s).\n' \
        "$MINIKUBE_PROFILE" "$MINIKUBE_STATUS" >&2
    printf 'Start it with: minikube start --profile %s --driver=docker --cpus=4 --memory=1800\n' \
        "$MINIKUBE_PROFILE" >&2
    exit 1
fi

cd "$PROJECT_ROOT"
kubectl --context "$KUBE_CONTEXT" apply -f kubernetes/namespace.yaml

if [[ -z "${POSTGRES_PASSWORD:-}" ]]; then
    EXISTING_SECRET_KEY="$(kubectl --context "$KUBE_CONTEXT" get secret postgres-secret \
        --namespace "$NAMESPACE" \
        -o jsonpath='{.data.POSTGRES_PASSWORD}' 2>/dev/null || true)"
    if [[ -z "$EXISTING_SECRET_KEY" ]]; then
        read -r -s -p "PostgreSQL password: " POSTGRES_PASSWORD
        printf '\n'
    fi
fi

if [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
    printf '%s' "$POSTGRES_PASSWORD" |
        kubectl --context "$KUBE_CONTEXT" create secret generic postgres-secret \
        --namespace "$NAMESPACE" \
        --from-file=POSTGRES_PASSWORD=/dev/stdin \
        --dry-run=client -o yaml |
        kubectl --context "$KUBE_CONTEXT" apply \
            --server-side --force-conflicts --field-manager=stock-management-deployer -f -
    unset POSTGRES_PASSWORD
elif [[ -z "${EXISTING_SECRET_KEY:-}" ]]; then
    printf 'POSTGRES_PASSWORD must not be empty.\n' >&2
    exit 1
else
    printf 'Reusing existing PostgreSQL Secret.\n'
fi

printf 'Applying PostgreSQL resources...\n'
kubectl --context "$KUBE_CONTEXT" apply \
    -f kubernetes/postgres-pvc.yaml \
    -f kubernetes/postgres-deployment.yaml \
    -f kubernetes/postgres-service.yaml
kubectl --context "$KUBE_CONTEXT" wait \
    --for=jsonpath='{.status.phase}'=Bound \
    "pvc/postgres-pvc" --namespace "$NAMESPACE" --timeout=180s
kubectl --context "$KUBE_CONTEXT" rollout status \
    "deployment/postgres" --namespace "$NAMESPACE" --timeout=240s

apply_deployment() {
    local manifest="$1"
    local deployment="$2"
    local container="$3"
    local image="$4"

    kubectl --context "$KUBE_CONTEXT" apply -f "$manifest"
    kubectl --context "$KUBE_CONTEXT" set image \
        "deployment/$deployment" "$container=$image" \
        --namespace "$NAMESPACE"
}

printf 'Applying backend resources...\n'
kubectl --context "$KUBE_CONTEXT" apply -f kubernetes/backend-service.yaml
apply_deployment kubernetes/backend-deployment.yaml backend backend "$BACKEND_IMAGE"
kubectl --context "$KUBE_CONTEXT" rollout status \
    "deployment/backend" --namespace "$NAMESPACE" --timeout=300s

printf 'Applying frontend resources...\n'
kubectl --context "$KUBE_CONTEXT" apply -f kubernetes/frontend-service.yaml
apply_deployment kubernetes/frontend-deployment.yaml frontend frontend "$FRONTEND_IMAGE"
kubectl --context "$KUBE_CONTEXT" rollout status \
    "deployment/frontend" --namespace "$NAMESPACE" --timeout=180s

printf '\nDeployment resources:\n'
kubectl --context "$KUBE_CONTEXT" get pods,services,deployments \
    --namespace "$NAMESPACE" -o wide
printf '\nFrontend access: minikube service frontend-service --namespace %s\n' "$NAMESPACE"
