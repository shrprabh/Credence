from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_mcp import FastApiMCP # type: ignore
# Change import path based on running context
try:
    from app.routers import users, skills, videos, quizzes, nft, auth, privy_auth
except ModuleNotFoundError:
    # If running from inside the app directory
    from routers import users, skills, videos, quizzes, nft, auth, privy_auth

app = FastAPI(
    title="Credence API",
    version="0.1.0"
)

# Define allowed origins
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5178",  # Add the current frontend port
    "http://localhost:5174",  # Adding new port for Vite dev server
]

# Add the CORSMiddleware BEFORE including any routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include classic REST routers
app.include_router(users.router)
app.include_router(skills.router)
app.include_router(videos.router)
app.include_router(quizzes.router)
app.include_router(nft.router)
app.include_router(auth.router)
app.include_router(privy_auth.router, prefix="/privy")

# 🔗 One-liner: expose every endpoint as an MCP tool
FastApiMCP(app)  # creates /mcp/v1/… endpoints automatically

@app.get("/")
async def root():
    return {"message": "Credence API is running and CORS should be configured."}
