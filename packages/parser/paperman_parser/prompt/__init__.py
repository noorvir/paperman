from dataclasses import dataclass


@dataclass(frozen=True)
class Prompt:
    instructions: str
    text: str
    images: list[bytes]
