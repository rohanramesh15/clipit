from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.models.user import User  # noqa: F401 — registers model with Base
from app.api.routes import health, users
from app.api.routes.auth import router as auth_router
from app.api.routes.videos import router as videos_router
from app.api.routes.subtitles import router as subtitles_router
from app.api.routes.vocabulary import router as vocabulary_router
from app.api.routes.flashcards import router as flashcards_router
from app.api.routes.lookup import router as lookup_router


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth_router, prefix="/api", tags=["auth"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(videos_router, prefix="/api/videos", tags=["videos"])
app.include_router(subtitles_router, prefix="/api", tags=["subtitles"])
app.include_router(vocabulary_router, prefix="/api", tags=["vocabulary"])
app.include_router(flashcards_router, prefix="/api", tags=["flashcards"])
app.include_router(lookup_router, prefix="/api", tags=["lookup"])


@app.get("/")
async def root():
    return {
        "message": "Deadbird API",
        "version": settings.VERSION,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
