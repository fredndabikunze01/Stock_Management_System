pipeline {
    agent any

    options {
        timestamps()
    }

    environment {
        POSTGRES_PASSWORD = credentials('stock-management-postgres-password')
        BACKEND_IMAGE = 'fredndabikunze01/stock-management-backend'
        FRONTEND_IMAGE = 'fredndabikunze01/stock-management-frontend'
        K8S_NAMESPACE = 'stock-management'
        KUBE_CONTEXT = 'minikube'
    }

    stages {
        stage('Validate Compose') {
            steps {
                sh 'docker compose config > /dev/null'
            }
        }

        stage('Backend Tests') {
            steps {
                dir('backend') {
                    sh 'mvn -B test'
                }
            }
        }

        stage('Frontend Build and Test') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }

        stage('Build and Push Images') {
            steps {
                script {
                    env.IMAGE_TAG = sh(
                        script: 'git rev-parse --short=12 HEAD',
                        returnStdout: true
                    ).trim()
                }
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKERHUB_USERNAME',
                        passwordVariable: 'DOCKERHUB_TOKEN'
                    )
                ]) {
                    sh '''
                        set +x
                        printf '%s' "$DOCKERHUB_TOKEN" |
                            docker login --username "$DOCKERHUB_USERNAME" --password-stdin
                        docker build --pull \
                            --tag "$BACKEND_IMAGE:$IMAGE_TAG" \
                            --tag "$BACKEND_IMAGE:latest" backend
                        docker build --pull \
                            --tag "$FRONTEND_IMAGE:$IMAGE_TAG" \
                            --tag "$FRONTEND_IMAGE:latest" frontend
                        docker push "$BACKEND_IMAGE:$IMAGE_TAG"
                        docker push "$BACKEND_IMAGE:latest"
                        docker push "$FRONTEND_IMAGE:$IMAGE_TAG"
                        docker push "$FRONTEND_IMAGE:latest"
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'minikube-kubeconfig',
                        variable: 'KUBECONFIG'
                    )
                ]) {
                    sh '''
                        BACKEND_IMAGE="$BACKEND_IMAGE:$IMAGE_TAG" \
                        FRONTEND_IMAGE="$FRONTEND_IMAGE:$IMAGE_TAG" \
                        scripts/deploy-kubernetes.sh
                    '''
                }
            }
        }

        stage('Verify Kubernetes Deployment') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'minikube-kubeconfig',
                        variable: 'KUBECONFIG'
                    )
                ]) {
                    sh 'scripts/verify-kubernetes.sh'
                }
            }
        }
    }

    post {
        always {
            sh 'docker logout >/dev/null 2>&1 || true'
        }
    }
}
