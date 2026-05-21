from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.core.database import get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.schemas.auth import (
    Token,
    GoogleAuthToken,
    LoginRequest,
    GoogleAuthRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
)
from app.api.deps import get_current_user
from app.services.email_service import (
    generate_token,
    send_password_reset_email,
    get_reset_token_expiry,
    is_token_expired,
)

GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID

router = APIRouter()


@router.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new user and return an access token."""
    existing = db.query(User).filter(User.email == user_in.email).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with that email already exists",
        )

    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        {"user_id": user.id, "email": user.email}
    )
    return Token(access_token=token)


@router.post("/auth/login", response_model=Token)
def login(user_in: LoginRequest, db: Session = Depends(get_db)):
    """Login with email and password, returns an access token."""
    user = db.query(User).filter(User.email == user_in.email).first()

    if not user or not user.hashed_password or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive",
        )

    token = create_access_token(
        {"user_id": user.id, "email": user.email}
    )
    return Token(access_token=token)


@router.post("/auth/google", response_model=GoogleAuthToken)
def google_auth(request: GoogleAuthRequest, db: Session = Depends(get_db)):
    """Authenticate with Google OAuth. Creates a new user if one doesn't exist."""
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            request.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )

        # Extract user info from token
        google_id = idinfo.get("sub")
        email = idinfo.get("email")
        full_name = idinfo.get("name", "")
        picture = idinfo.get("picture")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by Google",
            )

        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        is_new_user = False

        if not user:
            # Create new user
            is_new_user = True

            user = User(
                email=email,
                full_name=full_name,
                hashed_password=None,  # No password for OAuth users
                oauth_provider="google",
                oauth_id=google_id,
                profile_picture=picture,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # If mode is signup and user already exists, return error
            if request.mode == "signup":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email already exists. Please sign in instead.",
                )
            # Update OAuth info if not already set
            if not user.oauth_provider:
                user.oauth_provider = "google"
                user.oauth_id = google_id
            if picture and not user.profile_picture:
                user.profile_picture = picture
            # Update name if not set
            if not user.full_name and full_name:
                user.full_name = full_name
            db.commit()

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is inactive",
            )

        token = create_access_token(
            {"user_id": user.id, "email": user.email}
        )
        return GoogleAuthToken(access_token=token, is_new_user=is_new_user)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )


@router.get("/auth/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return current_user


@router.post("/auth/forgot-password", response_model=MessageResponse)
def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Send password reset email."""
    user = db.query(User).filter(User.email == request.email).first()

    # Don't reveal if user exists - always return success
    if user:
        reset_token = generate_token()
        user.reset_token = reset_token
        user.reset_token_expires = get_reset_token_expiry()
        db.commit()

        background_tasks.add_task(send_password_reset_email, user.email, reset_token)

    return MessageResponse(message="If that email exists, a password reset link has been sent")


@router.post("/auth/reset-password", response_model=MessageResponse)
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password with token."""
    user = db.query(User).filter(User.reset_token == request.token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    if is_token_expired(user.reset_token_expires):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired",
        )

    user.hashed_password = hash_password(request.password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()

    return MessageResponse(message="Password reset successfully")
