import type {
  ApiErrorDto,
  CardDto,
  CreateManualCardCommand,
  DeleteCardResponseDto,
  ListCardsResponseDto,
  UpdateCardCommand,
} from "@/types";

export type ApiError = {
  status: number;
  code?: ApiErrorDto["error"]["code"];
  message: string;
  details?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function parseApiError(res: Response): Promise<ApiError> {
  const fallback: ApiError = {
    status: res.status,
    message: res.statusText || "Request failed",
  };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return fallback;
  }

  if (!isObject(json) || !isObject(json.error)) {
    return fallback;
  }

  const err = json as ApiErrorDto;

  return {
    status: res.status,
    code: err.error.code,
    message: err.error.message ?? fallback.message,
    details: err.error.details,
  };
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw await parseApiError(res);
  }

  // Some endpoints (DELETE) may return empty body in the future.
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const asString = String(value);
    if (!asString) continue;
    sp.set(key, asString);
  }

  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export async function listCards(params: {
  page: number;
  pageSize: number;
  q?: string;
  sort?: string;
}): Promise<ListCardsResponseDto> {
  const qs = buildQuery({
    page: params.page,
    pageSize: params.pageSize,
    q: params.q,
    sort: params.sort,
  });

  return requestJson<ListCardsResponseDto>(`/api/cards${qs}`, { method: "GET" });
}

export async function createCard(command: CreateManualCardCommand): Promise<CardDto> {
  return requestJson<CardDto>("/api/cards", {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function getCard(cardId: string): Promise<CardDto> {
  return requestJson<CardDto>(`/api/cards/${encodeURIComponent(cardId)}`, {
    method: "GET",
  });
}

export async function updateCard(cardId: string, patch: UpdateCardCommand): Promise<CardDto> {
  return requestJson<CardDto>(`/api/cards/${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteCard(cardId: string): Promise<void> {
  const res = await requestJson<DeleteCardResponseDto>(`/api/cards/${encodeURIComponent(cardId)}`, {
    method: "DELETE",
  });

  if (!res?.ok) {
    throw {
      status: 500,
      message: "Unexpected delete response",
    } satisfies ApiError;
  }
}
