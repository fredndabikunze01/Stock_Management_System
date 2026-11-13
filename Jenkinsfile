pipeline {
    agent any

    options {
        timestamps()
    }

    environment {
        POSTGRES_PASSWORD = credentials('stock-management-postgres-password')
    }

    stages {
        stage('Validate Compose') {
            steps {
                sh 'docker compose config > /dev/null'
            }
        }

        stage('Build Images') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker compose up -d --remove-orphans'
                sh 'docker compose ps'
            }
        }

        stage('Smoke Test') {
            steps {
                sh 'docker compose exec -T frontend wget --quiet --tries=1 --spider http://127.0.0.1/'
                sh 'docker compose exec -T frontend wget --quiet --tries=1 --output-document=/dev/null http://127.0.0.1/api/products'
            }
        }
    }
}
