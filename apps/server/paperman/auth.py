from typing import Annotated, Literal

import jwt
from fastapi import Header, HTTPException
from pydantic import BaseModel, ConfigDict, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from paperman.models import Document


class AuthSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PAPERMAN_", env_file=".env", extra="ignore"
    )

    auth_enabled: bool = False
    api_auth_secret: str = ""

    @model_validator(mode="after")
    def check_secret(self) -> "AuthSettings":
        if self.auth_enabled and len(self.api_auth_secret) < 32:
            raise ValueError(
                "PAPERMAN_API_AUTH_SECRET must contain at least 32 characters"
            )
        return self


class Principal(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    sub: str
    name: str
    role: Literal["user", "admin"]
    mode: Literal["personal", "admin"]
    owner_ids: list[str]
    iss: Literal["paperman-web"]
    aud: Literal["paperman-api"]
    iat: int
    exp: int

    @property
    def admin(self) -> bool:
        return self.role == "admin" and self.mode == "admin"

    def can_view(self, document: Document) -> bool:
        return self.admin or bool(set(self.owner_ids).intersection(document.owner_ids))


class Auth:
    def __init__(self, settings: AuthSettings) -> None:
        self.settings = settings

    def __call__(
        self, authorization: Annotated[str | None, Header()] = None
    ) -> Principal | None:
        if not self.settings.auth_enabled:
            return None
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Sign in to continue")
        try:
            claims = jwt.decode(
                authorization.removeprefix("Bearer "),
                self.settings.api_auth_secret,
                algorithms=["HS256"],
                issuer="paperman-web",
                audience="paperman-api",
                options={"require": ["exp", "iat", "iss", "aud", "sub"]},
            )
            principal = Principal.model_validate(claims)
            if principal.exp - principal.iat > 30:
                raise ValueError("Invalid token lifetime")
            return principal
        except (jwt.InvalidTokenError, ValidationError, ValueError) as error:
            raise HTTPException(401, "Sign in to continue") from error

    def require_admin(
        self, authorization: Annotated[str | None, Header()] = None
    ) -> Principal | None:
        principal = self(authorization)
        if principal is not None and not principal.admin:
            raise HTTPException(403, "Admin mode is required")
        return principal


def check_document(principal: Principal | None, document: Document) -> None:
    if principal is not None and not principal.can_view(document):
        raise HTTPException(404, "Record not found")
