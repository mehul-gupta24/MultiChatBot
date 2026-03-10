"""
MultiChatBot API — Production-Grade Backend
SSE token streaming, async OpenRouter via httpx, structured logging,
retry logic, global error handling, and health checks.
"""

import asyncio
import json
import logging
import os
import random
import time
import traceback
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, AsyncGenerator, Callable, DefaultDict, Dict, List, Optional, Union

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from groq import Groq
from pydantic import BaseModel, Field, validator

from file_analyzer import FileAnalyzer
from tools import tool_registry

# ─── Configuration ────────────────────────────────────────────────────────────

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")

if not GROQ_API_KEY or not OPENROUTER_API_KEY:
    raise ValueError("Missing GROQ_API_KEY or OPENROUTER_API_KEY in .env")
if not TAVILY_API_KEY:
    raise ValueError("Missing TAVILY_API_KEY in .env")

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("multichatbot")

# ─── FastAPI App ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="MultiChatBot API",
    description="Production-grade multifunctional chatbot with SSE streaming",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Clients ──────────────────────────────────────────────────────────────────

groq_client = Groq(api_key=GROQ_API_KEY)
httpx_client = httpx.AsyncClient(timeout=120.0)
file_analyzer = FileAnalyzer(GROQ_API_KEY, tavily_api_key=TAVILY_API_KEY)

START_TIME = time.time()

# ─── Model Mapping ────────────────────────────────────────────────────────────

MODEL_MAPPING = {
    "chat":       {"provider": "groq",       "model": "llama-3.1-8b-instant"},
    "code":       {"provider": "groq",       "model": "qwen/qwen3-32b"},
    "write":      {"provider": "openrouter", "model": "liquid/lfm-2.5-1.2b-thinking:free"},
    "brainstorm": {"provider": "openrouter", "model": "qwen/qwen3-vl-30b-a3b-thinking"},
    "math":       {"provider": "openrouter", "model": "qwen/qwen3-vl-30b-a3b-thinking"},
    "research":   {"provider": "openrouter", "model": "qwen/qwen3-vl-30b-a3b-thinking"},
    "email":      {"provider": "openrouter", "model": "qwen/qwen3-vl-30b-a3b-thinking"},
    "analyze":    {"provider": "groq",       "model": "llama-3.1-8b-instant"},
    "moderate":   {"provider": "groq",       "model": "llama-guard-4-12b"},
    "file-chat":  {"provider": "groq",       "model": "llama-3.1-8b-instant"},
}

# ─── System Prompts ───────────────────────────────────────────────────────────

SYSTEM_PROMPTS = {
    "chat": """You are a friendly, helpful, and knowledgeable assistant. Provide clear, concise answers. 
When you don't know something or when the question is about recent events, use the 'web_search' tool to find current information.
When asked to run code, use the 'execute_code_online' tool.""",

    "code": """You are an expert software engineer and programming assistant. Your responsibilities:
- Write clean, well-documented, production-quality code
- Follow best practices and design patterns for the requested language
- When debugging, analyze the problem step-by-step before suggesting fixes
- Suggest optimizations and improvements when reviewing code
- Include error handling, edge cases, and type hints where applicable
- Explain complex logic with inline comments
- When asked to run or test code, use the 'execute_code_online' tool
- If the user's question is ambiguous, ask clarifying questions before writing code""",

    "write": """You are a professional creative writer and editor. Your responsibilities:
- Adapt your writing style to match the user's request (formal, casual, narrative, persuasive, etc.)
- Focus on structure, tone, narrative flow, and engaging prose
- Provide multiple variations or drafts when asked
- Offer constructive revision suggestions
- Use vivid language, strong verbs, and varied sentence structure
- For blog posts: include SEO-friendly headings and engaging hooks
- For stories: develop compelling characters, settings, and plot arcs
- For essays: build clear arguments with supporting evidence""",

    "brainstorm": """You are a creative ideation specialist. Your responsibilities:
- Generate diverse, innovative ideas using structured brainstorming techniques
- Use methods like: Mind Mapping, SCAMPER, Six Thinking Hats, Reverse Brainstorming, and "What If" scenarios
- Organize ideas by categories: feasibility, impact, novelty, and cost
- Build on initial ideas to create more refined concepts
- Challenge assumptions and explore unconventional approaches
- Present ideas in a structured format with clear headings and bullet points
- Provide a summary ranking the top 3-5 most promising ideas with justification""",

    "math": """You are an expert mathematician and problem-solving tutor. Your responsibilities:
- Solve problems step-by-step, showing ALL intermediate work
- Explain the reasoning behind each step clearly
- Verify your answer using an alternative method when possible
- Use proper mathematical notation (formatted in LaTeX/markdown)
- Identify the type of problem and relevant mathematical concepts
- If a problem has multiple approaches, present the most elegant one first
- When asked to compute, use the 'execute_code_online' tool with Python for numerical verification
- Highlight common mistakes students make on similar problems""",

    "research": """You are a thorough research analyst. Your responsibilities:
- ALWAYS use the 'web_search' tool FIRST to find current, accurate information before answering
- Search multiple angles of the topic for comprehensive coverage
- Use 'tavily_extract' to get detailed content from specific URLs when needed
- Synthesize information from multiple sources into a coherent analysis
- Cite your sources with URLs
- Present findings in a structured format: Overview → Key Findings → Detailed Analysis → Conclusion
- Distinguish between facts, expert opinions, and your own analysis
- Note any conflicting information found across sources
- Provide a balanced, unbiased perspective
- Suggest areas for further research if applicable""",

    "email": """You are a professional email drafting specialist. Your responsibilities:
- Draft emails with proper structure: Subject Line → Greeting → Body → Call to Action → Sign-off
- Adapt tone based on context: formal (business), semi-formal (professional), casual (personal)
- Keep emails concise and action-oriented
- Use proper email etiquette and formatting
- Include a clear, compelling subject line
- Structure the body with short paragraphs for readability
- End with a specific call to action when appropriate
- If the user provides minimal context, ask clarifying questions about:
  - Recipient relationship (boss, colleague, client, friend)
  - Purpose (request, follow-up, introduction, complaint, thank you)
  - Desired tone (formal, friendly, urgent)
- Provide 2-3 subject line options when drafting new emails""",

    "analyze": """You are a document analysis specialist. When a file has been uploaded:
- Provide a clear summary of the document's contents
- Identify key themes, data points, and important sections
- Answer questions about the document accurately based on the extracted text
- Suggest actionable insights from the document
- If no file context is provided, ask the user to upload a file first.""",

    "moderate": """You are a content safety evaluator. Analyze the provided content for:
- Hate speech or discrimination
- Violence or threats
- Sexual content
- Misinformation or harmful advice
- Personal information exposure
- Spam or scam indicators
Provide a clear safety assessment with specific concerns noted.""",
}

# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    mode: str = Field(..., description="Chat mode")
    message: str = Field(..., min_length=1, description="User message")
    conversation_history: Optional[List[Dict[str, str]]] = []
    file_context: Optional[Dict[str, Any]] = None
    use_tools: Optional[bool] = True
    selected_tools: Optional[List[str]] = None
    consistency_check: Optional[bool] = False
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=4096, ge=1, le=8192)

    @validator("mode")
    def validate_mode(cls, v):
        valid = set(MODEL_MAPPING.keys()) - {"file-chat"}
        if v.lower() not in valid:
            raise ValueError(f"Invalid mode '{v}'. Options: {sorted(valid)}")
        return v.lower()

class ChatResponse(BaseModel):
    response: str
    processing_time: float
    token_count: Optional[Dict[str, int]] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_results: Optional[List[Dict[str, Any]]] = None
    consistency_info: Optional[Dict[str, Any]] = None

class FileAnalysisResponse(BaseModel):
    file_type: str
    metadata: Dict[str, Any]
    extracted_text: Optional[str] = None
    ai_analysis: Optional[str] = None
    processing_time: float

class FileChatRequest(BaseModel):
    session_id: str
    message: str
    mode: Optional[str] = "chat"
    conversation_history: Optional[List[Dict[str, str]]] = []

class FileChatResponse(BaseModel):
    response: str
    file_context: Optional[Dict[str, Any]] = None
    processing_time: float
    token_count: Optional[Dict[str, int]] = None

# ─── Global Error Handlers ────────────────────────────────────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "message": exc.detail, "code": exc.status_code},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": "Internal server error", "code": 500},
    )

# ─── File Session Management ─────────────────────────────────────────────────

class FileSession:
    def __init__(self):
        self.file_content: Dict[str, Any] = {}
        self.last_accessed: datetime = datetime.now()

    def update_content(self, content: Dict[str, Any]):
        self.file_content = content
        self.last_accessed = datetime.now()

    def get_content(self) -> Dict[str, Any]:
        self.last_accessed = datetime.now()
        return self.file_content

    def is_expired(self, ttl_minutes: int = 30) -> bool:
        return datetime.now() - self.last_accessed > timedelta(minutes=ttl_minutes)

file_sessions: DefaultDict[str, FileSession] = defaultdict(FileSession)

def cleanup_sessions():
    expired = [sid for sid, s in file_sessions.items() if s.is_expired()]
    for sid in expired:
        del file_sessions[sid]
    if expired:
        logger.info(f"Cleaned up {len(expired)} expired file sessions")

# ─── Lifecycle ────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    logger.info("🚀 MultiChatBot API starting up...")

    async def periodic_cleanup():
        while True:
            await asyncio.sleep(300)
            cleanup_sessions()

    asyncio.create_task(periodic_cleanup())
    logger.info("✅ Background session cleanup scheduled")

@app.on_event("shutdown")
async def shutdown_event():
    await httpx_client.aclose()
    logger.info("🛑 MultiChatBot API shut down")

# ─── Helpers ──────────────────────────────────────────────────────────────────

def build_messages(prompt: str, mode: str, conversation_history: Optional[List[Dict]], file_context: Optional[Dict] = None, max_history: int = 10) -> List[Dict]:
    """Build the messages array for the LLM call."""
    system_prompt = SYSTEM_PROMPTS.get(mode, SYSTEM_PROMPTS["chat"])
    messages = [{"role": "system", "content": system_prompt}]

    if conversation_history:
        messages.extend(conversation_history[-max_history:])

    # Inject file context for analyze mode
    if mode == "analyze" and file_context:
        extracted = file_context.get("extracted_text", "")
        if len(extracted) > 4000:
            extracted = extracted[:4000] + "\n... (truncated)"
        prompt = (
            f"Document: {file_context.get('file_name', 'Unknown')}\n"
            f"Type: {file_context.get('file_type', '')}\n\n"
            f"Content:\n{extracted}\n\n"
            f"User question: {prompt}"
        )

    messages.append({"role": "user", "content": prompt})
    return messages


async def retry_async(fn, max_retries: int = 2, backoff: float = 1.0):
    """Retry an async function with exponential backoff on 429/5xx errors."""
    last_exc = None
    for attempt in range(max_retries + 1):
        try:
            return await fn()
        except httpx.HTTPStatusError as e:
            last_exc = e
            if e.response.status_code == 429 or e.response.status_code >= 500:
                wait = backoff * (2 ** attempt)
                logger.warning(f"Retry {attempt+1}/{max_retries} after {e.response.status_code}, waiting {wait:.1f}s")
                await asyncio.sleep(wait)
            else:
                raise
        except Exception as e:
            last_exc = e
            if attempt < max_retries:
                wait = backoff * (2 ** attempt)
                logger.warning(f"Retry {attempt+1}/{max_retries} after error: {e}, waiting {wait:.1f}s")
                await asyncio.sleep(wait)
            else:
                raise
    raise last_exc


def process_tool_calls(tool_calls_raw: List[Dict], mode: str) -> tuple:
    """Execute tool calls and return (tool_calls, tool_results, tool_messages)."""
    tool_calls = []
    tool_results = []
    tool_messages = []

    for tc in tool_calls_raw:
        if not tc.get("id"):
            continue
        tool_calls.append(tc)
        fn_name = tc["function"]["name"]
        try:
            fn_args = json.loads(tc["function"].get("arguments", "{}"))
        except json.JSONDecodeError:
            fn_args = {}

        logger.info(f"Executing tool: {fn_name}({json.dumps(fn_args)[:200]})")
        try:
            result = tool_registry.execute_tool(fn_name, fn_args)
            tool_results.append({"tool_call_id": tc["id"], "name": fn_name, "result": result})
        except Exception as e:
            logger.error(f"Tool execution error: {fn_name} — {e}")
            tool_results.append({"tool_call_id": tc["id"], "name": fn_name, "error": str(e)})

    # Build messages for the follow-up call
    tool_messages.append({
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": tc["id"],
                "type": "function",
                "function": {
                    "name": tc["function"]["name"],
                    "arguments": tc["function"].get("arguments", "{}"),
                },
            }
            for tc in tool_calls
        ],
    })
    for tr in tool_results:
        tool_messages.append({
            "role": "tool",
            "tool_call_id": tr["tool_call_id"],
            "content": str(tr.get("result", tr.get("error", ""))),
        })

    return tool_calls, tool_results, tool_messages

# ─── SSE Streaming: Groq ──────────────────────────────────────────────────────

async def stream_groq(messages: List[Dict], model: str, mode: str, temperature: float, max_tokens: int, selected_tools: Optional[List[str]] = None) -> AsyncGenerator[str, None]:
    """Stream tokens from Groq via SSE. Handles tool calls mid-stream."""
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Groq stream start | model={model} mode={mode}")

    kwargs: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    tools_list = tool_registry.get_tool_descriptions(mode=mode, selected_tools=selected_tools)
    if tools_list:
        kwargs["tools"] = tools_list
        kwargs["tool_choice"] = "auto"

    # First streaming pass
    collected = ""
    tool_calls_raw: List[Dict] = []
    token_count = {}

    try:
        completion = groq_client.chat.completions.create(**kwargs)
        for chunk in completion:
            choice = chunk.choices[0] if chunk.choices else None
            if not choice:
                continue
            delta = choice.delta
            if delta and delta.content:
                collected += delta.content
                yield f"data: {json.dumps({'event': 'token', 'data': delta.content})}\n\n"
            if delta and delta.tool_calls:
                for tc in delta.tool_calls:
                    while len(tool_calls_raw) <= tc.index:
                        tool_calls_raw.append({"id": "", "function": {"name": "", "arguments": ""}})
                    if tc.id:
                        tool_calls_raw[tc.index]["id"] = tc.id
                    if tc.function:
                        if tc.function.name:
                            tool_calls_raw[tc.index]["function"]["name"] = tc.function.name
                        if tc.function.arguments:
                            tool_calls_raw[tc.index]["function"]["arguments"] += tc.function.arguments
            if hasattr(chunk, "x_groq") and chunk.x_groq and hasattr(chunk.x_groq, "usage") and chunk.x_groq.usage:
                token_count = {
                    "prompt_tokens": chunk.x_groq.usage.prompt_tokens,
                    "completion_tokens": chunk.x_groq.usage.completion_tokens,
                    "total_tokens": chunk.x_groq.usage.total_tokens,
                }
    except Exception as e:
        logger.error(f"[{request_id}] Groq stream error: {e}")
        yield f"data: {json.dumps({'event': 'error', 'data': str(e)})}\n\n"
        return

    # Handle tool calls
    if tool_calls_raw and tool_calls_raw[0].get("id"):
        yield f"data: {json.dumps({'event': 'tool_start', 'data': [tc['function']['name'] for tc in tool_calls_raw if tc.get('id')]})}\n\n"

        tool_calls, tool_results, tool_messages = process_tool_calls(tool_calls_raw, mode)

        yield f"data: {json.dumps({'event': 'tool_result', 'data': [{'name': tr['name'], 'has_result': bool(tr.get('result'))} for tr in tool_results]})}\n\n"

        # Follow-up call with tool results (stream the response)
        followup_messages = messages + tool_messages
        kwargs2: Dict[str, Any] = {
            "model": model,
            "messages": followup_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if tools_list:
            kwargs2["tools"] = tools_list
            kwargs2["tool_choice"] = "auto"

        try:
            completion2 = groq_client.chat.completions.create(**kwargs2)
            for chunk in completion2:
                choice = chunk.choices[0] if chunk.choices else None
                if not choice:
                    continue
                delta = choice.delta
                if delta and delta.content:
                    yield f"data: {json.dumps({'event': 'token', 'data': delta.content})}\n\n"
                if hasattr(chunk, "x_groq") and chunk.x_groq and hasattr(chunk.x_groq, "usage") and chunk.x_groq.usage:
                    token_count = {
                        "prompt_tokens": chunk.x_groq.usage.prompt_tokens,
                        "completion_tokens": chunk.x_groq.usage.completion_tokens,
                        "total_tokens": chunk.x_groq.usage.total_tokens,
                    }
        except Exception as e:
            logger.error(f"[{request_id}] Groq follow-up error: {e}")
            yield f"data: {json.dumps({'event': 'error', 'data': str(e)})}\n\n"
            return

        yield f"data: {json.dumps({'event': 'done', 'token_count': token_count, 'tool_calls': tool_calls, 'tool_results': tool_results})}\n\n"
    else:
        yield f"data: {json.dumps({'event': 'done', 'token_count': token_count})}\n\n"

    logger.info(f"[{request_id}] Groq stream complete | tokens={token_count}")

# ─── SSE Streaming: OpenRouter ────────────────────────────────────────────────

async def stream_openrouter(messages: List[Dict], model: str, mode: str, temperature: float, max_tokens: int, selected_tools: Optional[List[str]] = None) -> AsyncGenerator[str, None]:
    """Stream tokens from OpenRouter via SSE using httpx."""
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] OpenRouter stream start | model={model} mode={mode}")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://multichatbot.vercel.app",
        "X-Title": "MultiChatBot",
    }

    data: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    tools_list = tool_registry.get_tool_descriptions(mode=mode, selected_tools=selected_tools)
    if tools_list:
        data["tools"] = tools_list
        data["tool_choice"] = "auto"

    collected = ""
    tool_calls_raw: List[Dict] = []
    token_count = {}

    try:
        async with httpx_client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                error_msg = body.decode("utf-8", errors="replace")
                logger.error(f"[{request_id}] OpenRouter error {resp.status_code}: {error_msg}")
                yield f"data: {json.dumps({'event': 'error', 'data': error_msg})}\n\n"
                return

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:].strip()
                if payload == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                except json.JSONDecodeError:
                    continue

                choices = chunk.get("choices", [])
                if not choices:
                    # Usage-only chunk or empty chunk, skip to next
                    if chunk.get("usage"):
                        token_count = {
                            "prompt_tokens": chunk["usage"].get("prompt_tokens", 0),
                            "completion_tokens": chunk["usage"].get("completion_tokens", 0),
                            "total_tokens": chunk["usage"].get("total_tokens", 0),
                        }
                    continue

                choice = choices[0]
                delta = choice.get("delta", {})

                # Content tokens
                if delta.get("content"):
                    collected += delta["content"]
                    yield f"data: {json.dumps({'event': 'token', 'data': delta['content']})}\n\n"

                # Tool calls
                if delta.get("tool_calls"):
                    for tc in delta["tool_calls"]:
                        idx = tc.get("index", 0)
                        while len(tool_calls_raw) <= idx:
                            tool_calls_raw.append({"id": "", "function": {"name": "", "arguments": ""}})
                        if tc.get("id"):
                            tool_calls_raw[idx]["id"] = tc["id"]
                        fn = tc.get("function", {})
                        if fn.get("name"):
                            tool_calls_raw[idx]["function"]["name"] = fn["name"]
                        if fn.get("arguments"):
                            tool_calls_raw[idx]["function"]["arguments"] += fn["arguments"]

                # Usage
                if chunk.get("usage"):
                    token_count = {
                        "prompt_tokens": chunk["usage"].get("prompt_tokens", 0),
                        "completion_tokens": chunk["usage"].get("completion_tokens", 0),
                        "total_tokens": chunk["usage"].get("total_tokens", 0),
                    }

    except httpx.ReadTimeout:
        logger.error(f"[{request_id}] OpenRouter timeout")
        yield f"data: {json.dumps({'event': 'error', 'data': 'Request timed out'})}\n\n"
        return
    except Exception as e:
        logger.error(f"[{request_id}] OpenRouter stream error: {e}")
        yield f"data: {json.dumps({'event': 'error', 'data': str(e)})}\n\n"
        return

    # Handle tool calls
    if tool_calls_raw and tool_calls_raw[0].get("id"):
        yield f"data: {json.dumps({'event': 'tool_start', 'data': [tc['function']['name'] for tc in tool_calls_raw if tc.get('id')]})}\n\n"

        tool_calls, tool_results, tool_messages = process_tool_calls(tool_calls_raw, mode)

        yield f"data: {json.dumps({'event': 'tool_result', 'data': [{'name': tr['name'], 'has_result': bool(tr.get('result'))} for tr in tool_results]})}\n\n"

        # Follow-up (non-streaming for simplicity with OpenRouter tool results)
        followup_messages = messages + tool_messages
        followup_data = {
            "model": model,
            "messages": followup_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        try:
            async with httpx_client.stream("POST", "https://openrouter.ai/api/v1/chat/completions", headers=headers, json=followup_data) as resp2:
                if resp2.status_code != 200:
                    body = await resp2.aread()
                    yield f"data: {json.dumps({'event': 'error', 'data': body.decode()})}\n\n"
                    return
                async for line in resp2.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    choices = chunk.get("choices", [])
                    if not choices:
                        if chunk.get("usage"):
                            token_count = {
                                "prompt_tokens": chunk["usage"].get("prompt_tokens", 0),
                                "completion_tokens": chunk["usage"].get("completion_tokens", 0),
                                "total_tokens": chunk["usage"].get("total_tokens", 0),
                            }
                        continue
                    choice = choices[0]
                    delta = choice.get("delta", {})
                    if delta.get("content"):
                        yield f"data: {json.dumps({'event': 'token', 'data': delta['content']})}\n\n"
                    if chunk.get("usage"):
                        token_count = {
                            "prompt_tokens": chunk["usage"].get("prompt_tokens", 0),
                            "completion_tokens": chunk["usage"].get("completion_tokens", 0),
                            "total_tokens": chunk["usage"].get("total_tokens", 0),
                        }
        except Exception as e:
            logger.error(f"[{request_id}] OpenRouter follow-up error: {e}")
            yield f"data: {json.dumps({'event': 'error', 'data': str(e)})}\n\n"
            return

        yield f"data: {json.dumps({'event': 'done', 'token_count': token_count, 'tool_calls': tool_calls, 'tool_results': tool_results})}\n\n"
    else:
        yield f"data: {json.dumps({'event': 'done', 'token_count': token_count})}\n\n"

    logger.info(f"[{request_id}] OpenRouter stream complete | tokens={token_count}")

# ─── Non-streaming helpers (for consistency check, file-chat) ─────────────────

def get_groq_response_sync(messages: List[Dict], model: str, temperature: float = 0.7, max_tokens: int = 4096, mode: str = "chat", selected_tools: Optional[List[str]] = None) -> Dict:
    """Synchronous Groq call, collecting full response."""
    kwargs: Dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens, "stream": False}
    tools_list = tool_registry.get_tool_descriptions(mode=mode, selected_tools=selected_tools)
    if tools_list:
        kwargs["tools"] = tools_list
        kwargs["tool_choice"] = "auto"

    result = groq_client.chat.completions.create(**kwargs)
    msg = result.choices[0].message
    content = msg.content or ""
    tc = []
    tr = []

    if msg.tool_calls:
        raw = [{"id": t.id, "function": {"name": t.function.name, "arguments": t.function.arguments}} for t in msg.tool_calls]
        tc, tr, tool_msgs = process_tool_calls(raw, mode)
        followup = messages + tool_msgs
        result2 = groq_client.chat.completions.create(model=model, messages=followup, temperature=temperature, max_tokens=max_tokens, stream=False)
        content = result2.choices[0].message.content or ""

    usage = result.usage
    return {
        "response": content,
        "token_count": {"prompt_tokens": usage.prompt_tokens, "completion_tokens": usage.completion_tokens, "total_tokens": usage.total_tokens} if usage else {},
        "tool_calls": tc,
        "tool_results": tr,
    }


async def get_openrouter_response_async(messages: List[Dict], model: str, temperature: float = 0.7, max_tokens: int = 4096, mode: str = "chat", selected_tools: Optional[List[str]] = None) -> Dict:
    """Async OpenRouter call, collecting full response."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://multichatbot.vercel.app",
        "X-Title": "MultiChatBot",
    }
    data: Dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    tools_list = tool_registry.get_tool_descriptions(mode=mode, selected_tools=selected_tools)
    if tools_list:
        data["tools"] = tools_list
        data["tool_choice"] = "auto"

    async def _call():
        resp = await httpx_client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
        resp.raise_for_status()
        return resp.json()

    result = await retry_async(_call)
    msg = result["choices"][0]["message"]
    content = msg.get("content", "")
    tc = msg.get("tool_calls", [])
    tr = []

    if tc:
        raw = [{"id": t["id"], "function": t["function"]} for t in tc]
        tc, tr, tool_msgs = process_tool_calls(raw, mode)
        followup_data = {**data, "messages": messages + tool_msgs}

        async def _followup():
            resp = await httpx_client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=followup_data)
            resp.raise_for_status()
            return resp.json()

        result2 = await retry_async(_followup)
        content = result2["choices"][0]["message"].get("content", "")

    return {
        "response": content,
        "token_count": {
            "prompt_tokens": result.get("usage", {}).get("prompt_tokens", 0),
            "completion_tokens": result.get("usage", {}).get("completion_tokens", 0),
            "total_tokens": result.get("usage", {}).get("total_tokens", 0),
        },
        "tool_calls": tc,
        "tool_results": tr,
    }

# ─── API Routes ───────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "MultiChatBot API v2.0", "status": "running"}

@app.get("/health")
async def health():
    uptime = time.time() - START_TIME
    return {
        "status": "healthy",
        "uptime_seconds": round(uptime, 1),
        "uptime_human": f"{int(uptime // 3600)}h {int((uptime % 3600) // 60)}m",
        "providers": {
            "groq": bool(GROQ_API_KEY),
            "openrouter": bool(OPENROUTER_API_KEY),
            "tavily": bool(TAVILY_API_KEY),
        },
        "models": {k: v["model"] for k, v in MODEL_MAPPING.items()},
    }

# ─── Streaming Chat Endpoint ─────────────────────────────────────────────────

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """SSE streaming chat endpoint. Returns text/event-stream."""
    mode = request.mode
    model_info = MODEL_MAPPING[mode]
    provider = model_info["provider"]
    model = model_info["model"]

    messages = build_messages(
        request.message, mode, request.conversation_history,
        file_context=request.file_context,
    )

    logger.info(f"Stream request | mode={mode} provider={provider} model={model}")

    if provider == "groq":
        generator = stream_groq(messages, model, mode, request.temperature, request.max_tokens, request.selected_tools)
    else:
        generator = stream_openrouter(messages, model, mode, request.temperature, request.max_tokens, request.selected_tools)

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

# ─── Non-Streaming Chat Endpoint (fallback) ──────────────────────────────────

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Non-streaming chat endpoint (fallback)."""
    start_time = time.time()
    mode = request.mode
    model_info = MODEL_MAPPING[mode]
    provider = model_info["provider"]
    model = model_info["model"]

    messages = build_messages(
        request.message, mode, request.conversation_history,
        file_context=request.file_context,
    )

    logger.info(f"Chat request | mode={mode} provider={provider} model={model}")

    try:
        if provider == "groq":
            result = get_groq_response_sync(messages, model, request.temperature, request.max_tokens, mode, request.selected_tools)
        else:
            result = await get_openrouter_response_async(messages, model, request.temperature, request.max_tokens, mode, request.selected_tools)

        # Consistency check
        consistency_info = None
        final_response = result["response"]

        if request.consistency_check and final_response:
            reflection_msgs = build_messages(
                f"Reflect on this response to '{request.message}': {final_response[:500]}. Is it accurate and complete?",
                mode, []
            )
            if provider == "groq":
                ref = get_groq_response_sync(reflection_msgs, model, mode=mode)
            else:
                ref = await get_openrouter_response_async(reflection_msgs, model, mode=mode)
            consistency_info = {"method": "self_reflection", "reflection": ref["response"][:200], "is_consistent": True}

        return ChatResponse(
            response=final_response,
            processing_time=round(time.time() - start_time, 3),
            token_count=result.get("token_count"),
            tool_calls=result.get("tool_calls"),
            tool_results=result.get("tool_results"),
            consistency_info=consistency_info,
        )
    except Exception as e:
        logger.error(f"Chat error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── File Endpoints ───────────────────────────────────────────────────────────

@app.post("/analyze-file", response_model=FileAnalysisResponse)
async def analyze_file(file: UploadFile = File(...)):
    try:
        result = await file_analyzer.analyze_file(file)
        return result
    except Exception as e:
        logger.error(f"File analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-file-with-chat", response_model=FileAnalysisResponse)
async def analyze_file_with_chat(file: UploadFile = File(...), session_id: str = Form(...)):
    try:
        result = await file_analyzer.analyze_file(file)
        file_sessions[session_id].update_content({
            "file_type": result["file_type"],
            "metadata": result["metadata"],
            "extracted_text": result["extracted_text"],
            "ai_analysis": result["ai_analysis"],
            "filename": file.filename,
        })
        return result
    except Exception as e:
        logger.error(f"File analysis+chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/file-chat", response_model=FileChatResponse)
async def chat_about_file(request: FileChatRequest):
    start_time = time.time()
    if request.session_id not in file_sessions:
        raise HTTPException(status_code=404, detail="File session not found")

    try:
        fc = file_sessions[request.session_id].get_content()
        prompt = f"File: {fc.get('filename')}\nType: {fc.get('file_type')}\nContent: {fc.get('extracted_text', '')}\n\nUser question: {request.message}"
        messages = build_messages(prompt, "analyze", request.conversation_history)

        model_info = MODEL_MAPPING.get("file-chat", MODEL_MAPPING["chat"])
        if model_info["provider"] == "groq":
            result = get_groq_response_sync(messages, model_info["model"], mode="analyze")
        else:
            result = await get_openrouter_response_async(messages, model_info["model"], mode="analyze")

        return FileChatResponse(
            response=result["response"],
            file_context={"filename": fc.get("filename"), "file_type": fc.get("file_type")},
            processing_time=round(time.time() - start_time, 3),
            token_count=result.get("token_count"),
        )
    except Exception as e:
        logger.error(f"File chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models")
async def get_models():
    return MODEL_MAPPING

# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)