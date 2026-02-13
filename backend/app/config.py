from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_url: str = "postgresql+asyncpg://rlm:rlm@postgres:5432/rlm"
    milvus_uri: str = "http://milvus:19530"
    openai_api_key: str = ""
    llm_backend: str = "openai"
    llm_model: str = "gpt-4o-mini"
    llm_sub_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    vllm_url: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
