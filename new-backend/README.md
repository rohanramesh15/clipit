# FastAPI Backend

A modern FastAPI backend application with a clean project structure.

## Project Structure

```
.
├── app/
│   ├── api/
│   │   └── routes/          # API route handlers
│   │       └── health.py    # Health check endpoint
│   ├── core/
│   │   └── config.py        # Application configuration
│   ├── models/              # Database models
│   ├── schemas/             # Pydantic schemas
│   └── services/            # Business logic
├── main.py                  # Application entry point
├── requirements.txt         # Python dependencies
└── README.md
```

## Setup

### Prerequisites

- Python 3.8 or higher
- pip

### Installation

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
```bash
# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

### Configuration

Create a `.env` file in the root directory to override default settings:

```env
PROJECT_NAME=My FastAPI App
DEBUG=True
HOST=0.0.0.0
PORT=8000
```

## Running the Application

### Development Mode

Run with auto-reload enabled:
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Available Endpoints

- `GET /` - Root endpoint with API information
- `GET /api/health` - Health check endpoint

## Adding New Routes

1. Create a new file in `app/api/routes/`
2. Define your router and endpoints
3. Import and include the router in `main.py`

Example:
```python
# app/api/routes/users.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/users")
async def get_users():
    return {"users": []}
```

Then in `main.py`:
```python
from app.api.routes import users
app.include_router(users.router, prefix="/api", tags=["users"])
```

## Next Steps

- Add database integration (SQLAlchemy)
- Implement authentication (JWT)
- Add environment-specific configurations
- Set up testing with pytest
- Add logging and monitoring
