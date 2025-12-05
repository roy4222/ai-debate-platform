# 使用 uv 官方映像
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

WORKDIR /app

# 複製依賴定義
COPY pyproject.toml uv.lock* ./

# 安裝依賴（生產環境，不含開發依賴）
RUN uv sync --frozen --no-dev

# 複製應用程式碼
COPY app ./app

# 暴露端口（Cloud Run 使用 8080）
EXPOSE 8080

# 啟動應用
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
