from app.core.exceptions import ConfigurationError, ToolExecutionError
from app.models.chat import ChatRequest
from app.tools.base import BaseTool


class AppTool(BaseTool):
    def require_auth_token(self, payload: ChatRequest) -> str:
        token = payload.backend_auth_token
        if not token:
            raise ConfigurationError(
                f"{self.name} requires backend_auth_token. The Node backend should forward the authenticated user token."
            )
        return token

    def tool_error(self, message: str, *, details: str | None = None) -> ToolExecutionError:
        return ToolExecutionError(self.name, message, details=details)
