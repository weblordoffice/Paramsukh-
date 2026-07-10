# ParamSukh Tool Implementation Guide

This document defines how every AI tool should be designed, implemented, rendered, and maintained in ParamSukh.

The goal is not only to make tools technically correct, but to make the assistant feel premium, trustworthy, and useful for non-technical end users.

## Core Product Principle

ParamSukh AI must not behave like a plain text bot that dumps raw backend data.

It must behave like a modern AI product:

1. understand the user intent
2. choose the correct tool path
3. return structured results
4. present information in context-aware UI
5. guide the user through the next step clearly

## Tool Categories

All tools must belong to one of these categories:

### 1. Information Tools

These are read-only tools.

Examples:

- search events
- search courses
- recommend courses
- get my enrollments
- get membership plans
- search podcasts
- search support content

Rules:

- place them inside `app/tools/information_tools/`
- organize domain-heavy tools into nested domain folders, not large single files
- for example: `app/tools/information_tools/events/event_detail/event_details.py`
- split large domains by responsibility such as `event_list`, `event_detail`, `event_compare`, and `event_registrations`
- they must never change user state
- they should return normalized, structured JSON
- they should support strong UI rendering after the response

### 2. Action Tools

These tools change user state or trigger a user action flow.

Examples:

- register for event
- cancel event registration
- enroll in course
- start purchase flow
- create support request

Rules:

- place them inside `app/tools/action_tools/`
- organize domain-heavy action tools into nested domain folders, not one combined file
- for example: `app/tools/action_tools/events/register_for_event/register_for_event.py`
- keep each state-changing flow in its own folder, such as `register_for_event` and `cancel_event_registration`
- they must require clear validation
- they must fail safely
- they must use explicit user confirmation before execution when they affect real state
- they must support dedicated action-oriented UI instead of plain text-only output

## Folder Structure Standard

For scalable tool architecture, do not keep an entire domain inside one monolithic file once the domain has multiple behaviors.

Preferred structure:

- `app/tools/information_tools/<domain>/`
- `app/tools/action_tools/<domain>/`

Inside each domain package:

- add a focused subfolder per tool or capability
- keep shared helpers in a domain-level `shared.py`
- keep package `__init__.py` exports clean and explicit

Example for events:

- `app/tools/information_tools/events/event_list/search_events.py`
- `app/tools/information_tools/events/event_detail/event_details.py`
- `app/tools/information_tools/events/event_compare/compare_events.py`
- `app/tools/information_tools/events/event_registrations/get_my_event_registrations.py`
- `app/tools/information_tools/events/shared.py`
- `app/tools/action_tools/events/register_for_event/register_for_event.py`
- `app/tools/action_tools/events/cancel_event_registration/cancel_event_registration.py`
- `app/tools/action_tools/events/shared.py`

Structure rules:

- one tool flow should map to one focused implementation file
- domain-specific shared resolution logic should live in the domain `shared.py`
- avoid oversized files that mix discovery, comparison, detail, and state-change behavior together
- if compatibility exports are needed during refactors, keep them lightweight and temporary

## Required Implementation Flow For Every Tool

Before implementing any tool:

1. identify whether it is an information tool or an action tool
2. confirm the backend API or service contract
3. define the tool schema strictly
4. define the normalized JSON response shape
5. define how the frontend should render the result
6. define all failure states in user-friendly wording
7. document the tool in `tools_implemented/`

## Tool Response Contract

Every tool should return structured JSON.

The assistant should not depend on fragile string parsing.

At minimum, a tool result should support:

- `success`
- `summary`
- `data`

When relevant, include:

- ids
- status
- access flags
- pricing
- dates
- locations
- progress
- payment information
- next-step URLs

## UI Rendering Standard

Tool output must not appear as a plain unreadable paragraph when the content is structured.

The frontend should render based on context.

### Information Tool UI

Use structured layouts such as:

- event list cards
- course list cards
- membership comparison cards
- podcast list cards
- support info cards
- status cards
- progress cards

When possible, show:

- title
- supporting description
- key metadata
- badges
- status
- pricing
- relevant dates

### Action Tool UI

Action tools must use a visibly different UI treatment from information tools.

Examples:

- success state card
- pending state card
- payment callout card
- confirmation-required state
- failure / blocked state card

Action tools should guide the user through what happens next.

Examples:

- event registered successfully
- payment still required
- confirmation needed before cancellation
- already enrolled

## Animation And Interaction Standard

Tool-related UI should feel alive and premium.

### During Tool Execution

The assistant should show:

- thinking state
- context-aware status text
- subtle live progress cues when possible

Examples:

- checking events
- reviewing course access
- preparing payment step

### After Tool Completion

The UI should shift based on tool type:

- information tools should reveal organized result sections
- action tools should reveal state-driven next-step UI
- payment flows should highlight the payment action clearly

### Future Direction

As the system evolves, action tools should support richer animations such as:

- payment processing states
- booking confirmation transitions
- status updates for long-running actions

## Error Handling Standard

All error handling must be designed for non-technical users first.

Never expose raw technical messages unless they are only used in internal logging.

### Good Error Behavior

- clear
- human-readable
- actionable
- safe
- consistent

Examples:

- "This event is no longer available for registration."
- "Payment has not been completed yet."
- "I could not load your enrolled courses right now. Please try again."
- "I need your confirmation before I register you for this event."

### Bad Error Behavior

- stack traces
- raw validation messages
- HTTP-only wording
- backend jargon
- internal identifiers without context

## Action Tool Safety Rules

Action tools are higher risk than information tools.

They must always:

1. validate required ids and inputs strictly
2. verify authentication context
3. require explicit confirmation when real user state changes
4. avoid claiming success before the backend actually confirms success
5. separate "action started" from "action completed"
6. represent payment-required flows honestly

For paid flows:

- never say the event or purchase is complete until payment is actually confirmed
- return a clear payment-next-step UI
- show the amount and payment action clearly

## Presentation Layer Requirement

For any tool that returns structured data, the backend and frontend should work together through a presentation contract.

This means:

1. tool output stays structured
2. assistant response includes presentation metadata when relevant
3. tool-backed assistant replies should support a narrative contract with:
   - intro text before the structured result
   - structured result UI in the middle
   - follow-up text or next-step guidance after the structured result
4. frontend renders sections by presentation kind

Examples of presentation kinds:

- `course_list`
- `event_list`
- `registration_list`
- `membership_list`
- `podcast_list`
- `support_list`
- `progress_card`
- `status_card`
- `action_status`
- `payment_card`

New tools should define how they map into one or more presentation kinds.

For premium tool-backed conversations, avoid the flat pattern of:

- one plain text answer
- then cards only

Prefer the more advanced response structure:

- concise intro answer
- rendered cards / status UI / comparison UI
- follow-up question, clarification prompt, or next-step suggestion

## Documentation Requirement

Whenever a tool is added or changed:

1. implement the tool code
2. update the registry
3. ensure it is placed in the correct nested domain folder when the domain is non-trivial
4. update `tools_implemented/<toolname>.md`
5. define or update the presentation behavior
6. verify user-facing errors

## Verification Checklist

Before considering a tool complete, confirm:

- schema is strict
- code is optimized and maintainable
- backend dependency is correct
- error handling is robust
- non-technical user messaging is clear
- UI rendering is context-aware
- action tool safety is satisfied
- documentation is updated

## Current Priority

For all existing tools and future tools:

1. keep information tools structured and highly readable
2. keep action tools state-aware and premium
3. make the UI feel like a modern AI product, not a plain chatbot
4. use this guide as the default standard before implementing any new tool
