from typing import Annotated, Literal

import jwt
from fastapi import Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from paperman.models import Document, Inbox, Scan, personal_inbox_id
from paperman.storage import FileStorage


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
    owner_ids: list[str] = Field(default_factory=list)
    iss: Literal["paperman-web"]
    aud: Literal["paperman-api"]
    iat: int
    exp: int

    @property
    def admin(self) -> bool:
        return self.role == "admin" and self.mode == "admin"

    def can_view(self, document: Document) -> bool:
        confirmed_owner = (
            document.inbox_id == "shared"
            and document.delivery_confirmation is not None
            and bool(set(self.owner_ids).intersection(document.owner_ids))
        )
        return (
            (self.admin and document.inbox_id == "shared")
            or self.sub in document.access_user_ids
            or confirmed_owner
        )

    @property
    def inbox_id(self) -> str:
        return personal_inbox_id(self.sub)

    def can_view_source(self, scan: Scan) -> bool:
        return scan.inbox_id == self.inbox_id or (
            self.admin and scan.inbox_id == "shared"
        )

    def can_manage_document(self, document: Document) -> bool:
        return document.inbox_id == self.inbox_id or (
            self.admin and document.inbox_id == "shared"
        )


class Auth:
    def __init__(self, settings: AuthSettings, storage: FileStorage) -> None:
        self.settings = settings
        self.storage = storage

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
        except (jwt.InvalidTokenError, ValidationError, ValueError) as error:
            raise HTTPException(401, "Sign in to continue") from error
        with self.storage.transaction():
            try:
                inbox = self.storage.get_inbox(principal.inbox_id)
            except FileNotFoundError:
                inbox = Inbox(
                    id=principal.inbox_id,
                    name=principal.name,
                    account_id=principal.sub,
                )
                self.storage.save_inbox(inbox)
            if inbox.name != principal.name:
                inbox.name = principal.name
                self.storage.save_inbox(inbox)
            principal.owner_ids = inbox.routing_owner_ids.copy()
        return principal

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


def check_source(principal: Principal | None, scan: Scan) -> None:
    if principal is not None and not principal.can_view_source(scan):
        raise HTTPException(404, "Record not found")
