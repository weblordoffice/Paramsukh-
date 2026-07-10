from typing import Any

from pydantic import BaseModel, Field


class UserContext(BaseModel):
    user_id: str
    phone: str | None = None
    display_name: str | None = None
    subscription_plan: str | None = None
    subscription_status: str | None = None


class ConversationMessage(BaseModel):
    id: str | None = None
    role: str
    content: str
    toolName: str | None = None
    toolPayload: dict[str, Any] | None = None
    screenContext: dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    createdAt: str | None = None


class MemoryItem(BaseModel):
    id: str | None = None
    category: str = "other"
    key: str
    value: str
    confidence: float = 0.75
    isActive: bool = True


class ConversationContext(BaseModel):
    id: str | None = None
    title: str | None = None
    summary: str | None = None
    recent_messages: list[ConversationMessage] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: str | None = None
    user: UserContext
    metadata: dict[str, Any] = Field(default_factory=dict)
    backend_auth_token: str | None = None
    conversation: ConversationContext | None = None
    memory: list[MemoryItem] = Field(default_factory=list)


class ToolExecution(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    success: bool = True


class ResponseNarrative(BaseModel):
    intro: str | None = None
    outro: str | None = None


class ChatResponse(BaseModel):
    answer: str
    model: str
    session_id: str | None = None
    tools_used: list[ToolExecution] = Field(default_factory=list)
    memory_items: list[MemoryItem] = Field(default_factory=list)
    conversation_summary: str | None = None
    response_narrative: ResponseNarrative | None = None


class SuggestedAction(BaseModel):
    label: str
    action_type: str
    action_payload: dict[str, Any] | None = None


class ResultSection(BaseModel):
    model_config = {"extra": "allow"}
    section_title: str | None = None
    kind: str
    items: list[Any] = Field(default_factory=list)
    empty_state_message: str | None = None


class EnrichedChatResponse(ChatResponse):
    result_sections: list[ResultSection] = Field(default_factory=list)
    follow_up: str | None = None
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)
    clarification_prompt: str | None = None


class StreamEvent(BaseModel):
    event: str
    data: dict[str, Any]
