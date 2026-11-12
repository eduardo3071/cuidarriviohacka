from .base import StorageError


class MemoryStorage:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    def put(self, path: str, data: bytes, content_type: str) -> None:
        self.objects[path] = (data, content_type)

    def get(self, path: str) -> bytes:
        if path not in self.objects:
            raise StorageError(f"objeto ausente: {path}")
        return self.objects[path][0]

    def signed_url(self, path: str, expires_in: int = 600) -> str:
        if path not in self.objects:
            raise StorageError(f"objeto ausente: {path}")
        return f"memory://{path}?expires_in={expires_in}"
