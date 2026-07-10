class AIServiceError(Exception):
    """Base application error for the AI service."""


class ConfigurationError(AIServiceError):
    """Raised when required runtime configuration is missing."""


class ToolExecutionError(AIServiceError):
    """Raised when a tool cannot complete successfully."""

    def __init__(self, tool_name: str, message: str, *, details: str | None = None) -> None:
        super().__init__(message)
        self.tool_name = tool_name
        self.details = details
