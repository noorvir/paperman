import re
import unicodedata
from uuid import uuid4

from paperman_parser.models import Catalog, CatalogEntry, Creator

from paperman.auth import Principal
from paperman.storage import Storage, slug, write_record


class CreatorConflict(ValueError):
    pass


def resolve_creators(storage: Storage, creators: list[Creator]) -> list[str]:
    """Save canonical creator identities under the caller's storage transaction."""
    catalog = storage.catalog()
    ids: list[str] = []
    for creator in creators:
        matches = matching_entries(catalog, creator.name, creator.aliases)
        if creator.catalog_id is not None:
            entry = next(
                (
                    entry
                    for entry in catalog.directory
                    if entry.id == creator.catalog_id
                ),
                None,
            )
            if entry is None:
                raise CreatorConflict(
                    "The creator directory changed. Review the creator selection"
                )
            if any(match.id != entry.id for match in matches):
                raise CreatorConflict(
                    "Creator aliases match more than one directory entry. Correct the creator name or aliases"
                )
        elif len(matches) > 1:
            raise CreatorConflict(
                "Creator aliases match more than one directory entry. Correct the creator name or aliases"
            )
        elif matches:
            entry = matches[0]
        else:
            entry = CatalogEntry(
                id=f"{slug(creator.name)[:60]}-{uuid4().hex[:8]}", name=creator.name
            )
            catalog.creators.append(entry)
        for alias in [creator.name, *creator.aliases]:
            if alias.casefold() not in {
                name.casefold() for name in [entry.name, *entry.aliases]
            }:
                entry.aliases.append(alias)
        if entry.id not in ids:
            ids.append(entry.id)
    if creators:
        write_record(storage.root / "catalog.toml", catalog)
    return ids


def matching_entries(
    catalog: Catalog, name: str, aliases: list[str]
) -> list[CatalogEntry]:
    names = {normalized_name(value) for value in [name, *aliases]} - {""}
    return [
        entry
        for entry in catalog.directory
        if names.intersection(
            normalized_name(value) for value in [entry.name, *entry.aliases]
        )
    ]


def normalized_name(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold()
    value = re.sub(r"[^\w\s]", "", value)
    value = " ".join(value.split())
    return re.sub(r"\s+(?:gmbh|inc|incorporated|ltd|limited|llc)$", "", value)


def visible_catalog(storage: Storage, principal: Principal | None) -> Catalog:
    catalog = storage.catalog()
    if principal is not None and not principal.admin:
        visible_owners: set[str] = set()
        visible_creators: set[str] = set()
        for document in storage.list_documents():
            if principal.can_view(document):
                visible_owners.update(document.owner_ids)
                visible_creators.update(document.creator_ids)
        for scan in storage.list_scans():
            if principal.can_view_source(scan) and scan.proposal:
                for proposal in scan.proposal.documents:
                    visible_owners.update(proposal.owner_ids)
                    visible_creators.update(
                        creator.catalog_id
                        for creator in proposal.creators
                        if creator.catalog_id
                    )
        catalog.owners = [
            owner
            for owner in catalog.owners
            if owner.id in visible_owners | visible_creators
        ]
        catalog.creators = [
            entry for entry in catalog.creators if entry.id in visible_creators
        ]
    return catalog
