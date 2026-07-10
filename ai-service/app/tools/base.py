from abc import ABC, abstractmethod
from typing import Any

from app.models.chat import ChatRequest


class BaseTool(ABC):
    name: str
    description: str
    parameters: dict[str, Any]

    def schema(self) -> dict[str, Any]:
        return {
            "type": "function",
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }

    @abstractmethod
    async def execute(self, arguments: dict[str, Any], payload: ChatRequest) -> dict[str, Any]:
        raise NotImplementedError
