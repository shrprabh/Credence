start cmd /k "cd client && call pnpm dev"

start cmd /k "cd server && call pnpm dev"

start cmd /k "cd app && call .venv\scripts\activate && call uvicorn main:app --host 172.29.213.171 --port 8000 --reload"