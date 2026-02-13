from typing import Any, Generic, Sequence, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    def __init__(self, model: type[ModelT], db: AsyncSession):
        self.model = model
        self.db = db

    async def find_all(self, **filters: Any) -> Sequence[ModelT]:
        stmt = select(self.model)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def find_by_id(self, id: UUID) -> ModelT | None:
        stmt = select(self.model).where(self.model.id == id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, **kwargs: Any) -> ModelT:
        instance = self.model(**kwargs)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: UUID, **kwargs: Any) -> ModelT | None:
        instance = await self.find_by_id(id)
        if not instance:
            return None
        for key, value in kwargs.items():
            setattr(instance, key, value)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def delete(self, id: UUID) -> bool:
        instance = await self.find_by_id(id)
        if not instance:
            return False
        await self.db.delete(instance)
        await self.db.flush()
        return True
