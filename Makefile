PROJECT_ID   := claude-daily-report-project
REGION       := asia-northeast1
REPO         := ai-daily-report-app
SERVICE      := ai-daily-report-app
IMAGE        := $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPO)/$(SERVICE)

.PHONY: help setup build push deploy

help: ## コマンド一覧を表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Artifact Registry リポジトリを作成し、Docker 認証を設定する（初回のみ）
	gcloud config set project $(PROJECT_ID)
	gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
	gcloud artifacts repositories create $(REPO) \
		--repository-format=docker \
		--location=$(REGION) \
		--description="Docker repository for $(SERVICE)"
	gcloud auth configure-docker $(REGION)-docker.pkg.dev

build: ## Docker イメージをビルドする
	docker build -t $(IMAGE):latest .

push: build ## Docker イメージをビルドして Artifact Registry にプッシュする
	docker push $(IMAGE):latest

deploy: push ## ビルド・プッシュして Cloud Run にデプロイする
	gcloud run deploy $(SERVICE) \
		--image $(IMAGE):latest \
		--region $(REGION) \
		--platform managed \
		--allow-unauthenticated \
		--port 3000 \
		--set-env-vars DATABASE_URL=$$DATABASE_URL
