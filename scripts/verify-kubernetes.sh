#!/usr/bin/env bash
set -Eeuo pipefail

NAMESPACE="${K8S_NAMESPACE:-stock-management}"
KUBE_CONTEXT="${KUBE_CONTEXT:-minikube}"
MINIKUBE_PROFILE="${MINIKUBE_PROFILE:-minikube}"

for command in kubectl minikube curl; do
    if ! command -v "$command" >/dev/null 2>&1; then
        printf 'Required command not found: %s\n' "$command" >&2
        exit 1
    fi
done

printf 'Minikube status:\n'
minikube status --profile "$MINIKUBE_PROFILE"

printf '\nKubernetes nodes:\n'
kubectl --context "$KUBE_CONTEXT" get nodes -o wide
kubectl --context "$KUBE_CONTEXT" wait \
    --for=condition=Ready nodes --all --timeout=120s

printf '\nPods, services, and deployments:\n'
kubectl --context "$KUBE_CONTEXT" get pods,services,deployments \
    --namespace "$NAMESPACE" -o wide

for deployment in postgres backend frontend; do
    kubectl --context "$KUBE_CONTEXT" rollout status \
        "deployment/$deployment" --namespace "$NAMESPACE" --timeout=300s
done

printf '\nPostgreSQL readiness:\n'
kubectl --context "$KUBE_CONTEXT" exec \
    --namespace "$NAMESPACE" deployment/postgres -- \
    pg_isready -U stock_user -d stock_management

printf '\nBackend readiness through the frontend proxy:\n'
kubectl --context "$KUBE_CONTEXT" exec \
    --namespace "$NAMESPACE" deployment/frontend -- \
    wget --quiet --output-document=- \
    http://backend-service:8081/actuator/health/readiness
printf '\n'

LOCAL_PORT="${K8S_VERIFY_LOCAL_PORT:-18080}"
PORT_FORWARD_LOG="$(mktemp)"
kubectl --context "$KUBE_CONTEXT" port-forward \
    --namespace "$NAMESPACE" service/frontend-service "$LOCAL_PORT:80" \
    >"$PORT_FORWARD_LOG" 2>&1 &
PORT_FORWARD_PID=$!
cleanup() {
    kill "$PORT_FORWARD_PID" 2>/dev/null || true
    wait "$PORT_FORWARD_PID" 2>/dev/null || true
    rm -f "$PORT_FORWARD_LOG"
}
trap cleanup EXIT

ready=false
for _ in $(seq 1 30); do
    if curl --fail --silent "http://127.0.0.1:$LOCAL_PORT/" >/dev/null; then
        ready=true
        break
    fi
    sleep 1
done
if [[ "$ready" != true ]]; then
    printf 'Frontend service did not respond through port-forward:\n' >&2
    cat "$PORT_FORWARD_LOG" >&2
    exit 1
fi

printf '\nFrontend accessibility:\n'
curl --fail --silent --output /dev/null \
    --write-out 'Frontend HTTP %{http_code}\n' \
    "http://127.0.0.1:$LOCAL_PORT/"
curl --fail --silent --output /dev/null \
    --write-out 'Proxied API HTTP %{http_code}\n' \
    "http://127.0.0.1:$LOCAL_PORT/api/products"
