from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: T | None = None
    error: str | None = None
    meta: PaginationMeta | None = None
