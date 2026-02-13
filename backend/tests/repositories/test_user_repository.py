import pytest

from app.repositories.user_repository import UserRepository
from tests.db_fixture import db_session  # noqa: F401


@pytest.mark.asyncio
async def test_create_user(db_session):
    repo = UserRepository(db_session)
    user = await repo.create(username="alice")
    assert user.id is not None
    assert user.username == "alice"


@pytest.mark.asyncio
async def test_find_by_id(db_session):
    repo = UserRepository(db_session)
    user = await repo.create(username="bob")
    found = await repo.find_by_id(user.id)
    assert found is not None
    assert found.username == "bob"


@pytest.mark.asyncio
async def test_find_by_username(db_session):
    repo = UserRepository(db_session)
    await repo.create(username="charlie")
    found = await repo.find_by_username("charlie")
    assert found is not None
    assert found.username == "charlie"


@pytest.mark.asyncio
async def test_find_by_username_not_found(db_session):
    repo = UserRepository(db_session)
    found = await repo.find_by_username("nonexistent")
    assert found is None


@pytest.mark.asyncio
async def test_find_all(db_session):
    repo = UserRepository(db_session)
    await repo.create(username="u1")
    await repo.create(username="u2")
    users = await repo.find_all()
    assert len(users) == 2


@pytest.mark.asyncio
async def test_delete_user(db_session):
    repo = UserRepository(db_session)
    user = await repo.create(username="delme")
    deleted = await repo.delete(user.id)
    assert deleted is True
    assert await repo.find_by_id(user.id) is None
