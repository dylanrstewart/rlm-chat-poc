import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.types import JSON, Uuid
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now())

    knowledge_bases = relationship("KnowledgeBase", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    milvus_collection = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now())

    user = relationship("User", back_populates="knowledge_bases")
    files = relationship("File", back_populates="knowledge_base", cascade="all, delete-orphan")
    topics = relationship("CollectionTopic", back_populates="knowledge_base", cascade="all, delete-orphan")


class File(Base):
    __tablename__ = "files"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    knowledge_base_id = Column(Uuid, ForeignKey("knowledge_bases.id"), nullable=False)
    filename = Column(String, nullable=False)
    title = Column(String)
    file_type = Column(String)
    content = Column(Text)
    metadata_ = Column("metadata", JSON, default=dict)
    file_size_bytes = Column(BigInteger)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now())

    knowledge_base = relationship("KnowledgeBase", back_populates="files")


class CollectionTopic(Base):
    __tablename__ = "collection_topics"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    knowledge_base_id = Column(Uuid, ForeignKey("knowledge_bases.id"), nullable=False)
    topic_level = Column(Integer, nullable=False)
    topic_label = Column(String, nullable=False)
    topic_id = Column(Integer, nullable=False)
    doc_count = Column(Integer, default=0)
    sample_keywords = Column(JSON)  # stored as JSON array, maps to TEXT[] in Postgres via init.sql
    parent_topic_id = Column(Uuid, ForeignKey("collection_topics.id"))
    updated_at = Column(DateTime, default=datetime.utcnow, server_default=func.now())

    knowledge_base = relationship("KnowledgeBase", back_populates="topics")
    parent = relationship("CollectionTopic", remote_side="CollectionTopic.id")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now())

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id = Column(Uuid, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    metadata_ = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")
