from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from app.models.chat import ChatRequest, ConversationContext, UserContext
from app.services.openai_service import OpenAIService


ROOT_DIR = Path(__file__).resolve().parent
CASE_FILE = ROOT_DIR / "chat_eval_cases.json"


def load_cases() -> list[dict[str, Any]]:
    return json.loads(CASE_FILE.read_text(encoding="utf-8"))


def build_payload(case: dict[str, Any]) -> ChatRequest:
    screen_label = case.get("screen_label") or "Home"
    return ChatRequest(
        message=case["message"],
        session_id="eval-session",
        backend_auth_token="eval-token" if case.get("auth_required") else None,
        user=UserContext(
            user_id="eval-user",
            phone="+910000000000",
            display_name="Eval User",
            subscription_plan="premium" if case.get("auth_required") else "free",
            subscription_status="active" if case.get("auth_required") else "inactive",
        ),
        metadata={
            "source": "eval-suite",
            "current_screen": {
                "label": screen_label,
                "hint": f"Evaluation context for {screen_label}.",
            },
            "visible_screen_label": screen_label,
        },
        conversation=ConversationContext(
            id="eval-conversation",
            title="Eval Conversation",
            summary=case.get("conversation_summary"),
            recent_messages=[],
        ),
        memory=[],
    )


def evaluate_case(case: dict[str, Any], observed_tools: list[str]) -> dict[str, Any]:
    expected_tools = case.get("expected_tools_any", [])
    forbidden_tools = case.get("forbidden_tools", [])

    expected_ok = True
    if expected_tools:
        expected_ok = any(tool in observed_tools for tool in expected_tools)
    else:
        expected_ok = len(observed_tools) == 0

    forbidden_hits = [tool for tool in forbidden_tools if tool in observed_tools]
    passed = expected_ok and not forbidden_hits

    return {
        "id": case["id"],
        "category": case["category"],
        "message": case["message"],
        "expected_tools_any": expected_tools,
        "forbidden_tools": forbidden_tools,
        "observed_tools": observed_tools,
        "passed": passed,
        "notes": case.get("notes"),
        "failure_reason": None if passed else build_failure_reason(expected_ok, forbidden_hits, observed_tools, expected_tools),
    }


def build_failure_reason(
    expected_ok: bool,
    forbidden_hits: list[str],
    observed_tools: list[str],
    expected_tools: list[str],
) -> str:
    if forbidden_hits:
        return f"Forbidden tool(s) selected: {', '.join(forbidden_hits)}"
    if not expected_ok and expected_tools:
        return f"Expected one of {expected_tools}, observed {observed_tools or ['no tools']}"
    return f"Expected no tools, observed {observed_tools}"


def run_live_cases(case_id: str | None = None) -> list[dict[str, Any]]:
    service = OpenAIService()
    selected_cases = [
        case for case in load_cases()
        if case_id is None or case["id"] == case_id
    ]
    results: list[dict[str, Any]] = []

    for case in selected_cases:
        payload = build_payload(case)
        response = service.create_initial_response(payload)
        observed_tools = [
            item.name
            for item in response.output
            if getattr(item, "type", None) == "function_call"
        ]
        results.append(evaluate_case(case, observed_tools))

    return results


def run_catalog(case_id: str | None = None) -> list[dict[str, Any]]:
    selected_cases = [
        case for case in load_cases()
        if case_id is None or case["id"] == case_id
    ]
    return [
        {
            "id": case["id"],
            "category": case["category"],
            "message": case["message"],
            "expected_tools_any": case.get("expected_tools_any", []),
            "forbidden_tools": case.get("forbidden_tools", []),
            "auth_required": case.get("auth_required", False),
            "notes": case.get("notes"),
        }
        for case in selected_cases
    ]


def print_summary(results: list[dict[str, Any]], *, live: bool) -> None:
    if not live:
        print(f"Loaded {len(results)} evaluation case(s).")
        for item in results:
            print(f"- {item['id']}: expect {item['expected_tools_any'] or 'direct answer'}")
        return

    passed = sum(1 for item in results if item["passed"])
    total = len(results)
    print(f"Passed {passed}/{total} evaluation case(s).")
    for item in results:
        status = "PASS" if item["passed"] else "FAIL"
        observed = item["observed_tools"] or ["no tools"]
        print(f"- [{status}] {item['id']} -> {observed}")
        if item["failure_reason"]:
            print(f"  {item['failure_reason']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run ParamSukh AI chat evaluation cases.")
    parser.add_argument("--live", action="store_true", help="Call the configured OpenAI model and inspect tool selection.")
    parser.add_argument("--case", dest="case_id", help="Run or inspect only one case id.")
    parser.add_argument("--json", action="store_true", help="Print JSON instead of the text summary.")
    args = parser.parse_args()

    results = run_live_cases(args.case_id) if args.live else run_catalog(args.case_id)

    if args.json:
        print(json.dumps(results, indent=2))
        return

    print_summary(results, live=args.live)


if __name__ == "__main__":
    main()
