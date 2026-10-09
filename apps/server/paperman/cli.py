import argparse
import asyncio
import json
import logging
from pathlib import Path
from tempfile import TemporaryDirectory

import uvicorn

from paperman.config import Settings


class Arguments(argparse.Namespace):
    command: str = ""
    host: str = "127.0.0.1"
    port: int = 3000


def main() -> None:
    parser = argparse.ArgumentParser(prog="paperman")
    parser.add_argument(
        "command", choices=["serve", "worker", "schema", "index", "rename-documents"]
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3000)
    args = parser.parse_args(namespace=Arguments())
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )
    if args.command == "serve":
        uvicorn.run(
            "paperman.api:create_app",
            factory=True,
            host=str(args.host),
            port=int(args.port),
        )
    elif args.command == "worker":
        from paperman.worker import run_worker

        asyncio.run(run_worker(Settings()))
    elif args.command == "schema":
        from paperman.api import create_app
        from paperman.auth import AuthSettings

        with TemporaryDirectory(prefix="paperman-schema-") as directory:
            app = create_app(
                Settings(data_dir=Path(directory)), AuthSettings(auth_enabled=False)
            )
            Path("openapi.json").write_text(json.dumps(app.openapi(), indent=2) + "\n")
    elif args.command == "rename-documents":
        from paperman.document_names import rename_documents
        from paperman.storage import FileStorage

        count = rename_documents(FileStorage(Settings().data_dir))
        print(f"Renamed {count} processed documents")
    else:
        from paperman.storage import FileStorage

        store = FileStorage(Settings().data_dir)
        with store.transaction():
            store.rebuild_index()
