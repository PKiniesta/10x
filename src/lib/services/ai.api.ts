import type {
  StartAiGenerationCommand,
  StartAiGenerationResponseDto,
  AcceptAiProposalCommand,
  AcceptAiProposalResponseDto,
  TodayLimitsDto,
} from "@/types";

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let error;
    try {
      error = await res.json();
    } catch {
      throw new Error(res.statusText || "Request failed");
    }
    throw error;
  }

  return res.json() as Promise<T>;
}

export async function getTodayLimits(): Promise<TodayLimitsDto> {
  return requestJson<TodayLimitsDto>("/api/limits/today", { method: "GET" });
}

export async function startGeneration(command: StartAiGenerationCommand): Promise<StartAiGenerationResponseDto> {
  return requestJson<StartAiGenerationResponseDto>("/api/ai/generations", {
    method: "POST",
    body: JSON.stringify(command),
  });
}

export async function acceptProposal(
  generationId: string,
  proposalIndex: number,
  command: AcceptAiProposalCommand
): Promise<AcceptAiProposalResponseDto> {
  return requestJson<AcceptAiProposalResponseDto>(
    `/api/ai/generations/${generationId}/proposals/${proposalIndex}/accept`,
    {
      method: "POST",
      body: JSON.stringify(command),
    }
  );
}

export async function rejectProposal(
  generationId: string,
  proposalIndex: number,
  reviewToken: string
): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(`/api/ai/generations/${generationId}/proposals/${proposalIndex}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewToken }),
  });
}
