from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.common import ApiResponse
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", response_model=ApiResponse[UserRead])
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    existing = await repo.find_by_username(body.username)
    if existing:
        return ApiResponse(success=False, error=f"Username '{body.username}' already exists")
    user = await repo.create(username=body.username)
    await db.commit()
    return ApiResponse(success=True, data=UserRead.model_validate(user))


@router.get("", response_model=ApiResponse[list[UserRead]])
async def list_users(db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    users = await repo.find_all()
    return ApiResponse(success=True, data=[UserRead.model_validate(u) for u in users])


@router.get("/{user_id}", response_model=ApiResponse[UserRead])
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = UserRepository(db)
    user = await repo.find_by_id(user_id)
    if not user:
        return ApiResponse(success=False, error="User not found")
    return ApiResponse(success=True, data=UserRead.model_validate(user))
