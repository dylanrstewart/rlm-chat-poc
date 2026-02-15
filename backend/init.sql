CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR NOT NULL,
    description TEXT,
    milvus_collection VARCHAR UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id),
    filename VARCHAR NOT NULL,
    title VARCHAR,
    file_type VARCHAR,
    content TEXT,
    metadata JSONB DEFAULT '{}',
    file_size_bytes BIGINT,
    chunk_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),

    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(filename, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'D')
    ) STORED
);

CREATE INDEX idx_files_filename_trgm ON files USING gin (filename gin_trgm_ops);
CREATE INDEX idx_files_title_trgm ON files USING gin (title gin_trgm_ops);
CREATE INDEX idx_files_search ON files USING gin (search_vector);

CREATE TABLE collection_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id),
    topic_level INT NOT NULL,
    topic_label VARCHAR NOT NULL,
    topic_id INT NOT NULL,
    doc_count INT DEFAULT 0,
    sample_keywords JSONB,
    parent_topic_id UUID REFERENCES collection_topics(id),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id),
    role VARCHAR NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
