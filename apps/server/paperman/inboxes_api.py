from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from paperman_parser.models import Identifier

from paperman.api_models import AccountInbox, InboxRouting
from paperman.auth import Auth, Principal
from paperman.models import Inbox, personal_inbox_id
from paperman.storage import FileStorage


def routes(storage: FileStorage, auth: Auth) -> APIRouter:
    router = APIRouter()

    @router.get("/api/inboxes", operation_id="inboxes")
    def inboxes(principal: Annotated[Principal | None, Depends(auth)]) -> list[Inbox]:
        return [
            inbox
            for inbox in storage.list_inboxes()
            if principal is None or principal.admin or inbox.account_id == principal.sub
        ]

    @router.put(
        "/api/inboxes/accounts",
        operation_id="register_inboxes",
        dependencies=[Depends(auth.require_account_admin)],
    )
    def register_inboxes(accounts: list[AccountInbox]) -> list[Inbox]:
        with storage.transaction():
            for account in accounts:
                identifier = personal_inbox_id(account.account_id)
                try:
                    inbox = storage.get_inbox(identifier)
                except FileNotFoundError:
                    inbox = Inbox(
                        id=identifier, name=account.name, account_id=account.account_id
                    )
                inbox.name = account.name
                storage.save_inbox(inbox)
        return storage.list_inboxes()

    @router.put(
        "/api/inboxes/{inbox_id}/routing",
        operation_id="inbox_routing",
        dependencies=[Depends(auth.require_admin)],
    )
    def inbox_routing(inbox_id: Identifier, value: InboxRouting) -> Inbox:
        with storage.transaction():
            inbox = storage.get_inbox(inbox_id)
            if inbox.account_id is None:
                raise HTTPException(422, "Select a personal inbox")
            owners = {owner.id for owner in storage.catalog().owners} - {"unknown"}
            if not set(value.owner_ids) <= owners:
                raise HTTPException(422, "Select known owners from the catalog")
            inbox.routing_owner_ids = sorted(set(value.owner_ids))
            storage.save_inbox(inbox)
        return inbox

    return router
