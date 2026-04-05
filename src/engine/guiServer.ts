import { AnalyzeResponse, HealthResponse } from "../types/analyze";

export const GUI_SERVER_STORAGE_KEY = "space-innovation.gui-server-base-url";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const validateHealthResponse = (value: unknown): HealthResponse => {
  if (!isRecord(value)) {
    throw new Error("응답 형식이 올바르지 않습니다.");
  }

  const ok =
    typeof value.ok === "boolean"
      ? value.ok
      : typeof value.status === "string"
        ? value.status.toLowerCase() === "ok"
        : false;

  if (!ok) {
    throw new Error("GUI 서버 상태 확인에 실패했습니다.");
  }

  return {
    ok,
    version: typeof value.version === "string" ? value.version : undefined
  };
};

const validateAnalyzeResponse = (value: unknown): AnalyzeResponse => {
  if (!isRecord(value)) {
    throw new Error("응답 형식이 올바르지 않습니다.");
  }

  const { score, summary, suggestions, issues } = value;

  if (typeof score !== "number" || typeof summary !== "string" || !Array.isArray(suggestions) || !Array.isArray(issues)) {
    throw new Error("응답 형식이 올바르지 않습니다.");
  }

  return {
    score,
    subscores:
      isRecord(value.subscores)
        ? {
            pathway: typeof value.subscores.pathway === "number" ? value.subscores.pathway : undefined,
            access: typeof value.subscores.access === "number" ? value.subscores.access : undefined,
            density: typeof value.subscores.density === "number" ? value.subscores.density : undefined,
            alignment: typeof value.subscores.alignment === "number" ? value.subscores.alignment : undefined
          }
        : undefined,
    summary,
    suggestions: suggestions.filter((item): item is string => typeof item === "string"),
    issues: issues
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map((issue) => ({
        id:
          typeof issue.id === "string"
            ? issue.id
            : typeof issue.type === "string"
              ? issue.type
              : `issue-${Math.random().toString(36).slice(2, 8)}`,
        title:
          typeof issue.title === "string"
            ? issue.title
            : typeof issue.type === "string"
              ? issue.type
              : "문제 구역",
        severity:
          issue.severity === "high" ||
          issue.severity === "critical" ||
          issue.severity === "medium" ||
          issue.severity === "major" ||
          issue.severity === "low" ||
          issue.severity === "minor" ||
          issue.severity === "warning" ||
          issue.severity === "error" ||
          issue.severity === "info"
            ? issue.severity
            : "minor",
        message: typeof issue.message === "string" ? issue.message : "",
        region: isRecord(issue.region)
          ? ((issue.region.type === "rect" ||
              (typeof issue.region.x === "number" &&
                typeof issue.region.y === "number" &&
                typeof issue.region.w === "number" &&
                typeof issue.region.h === "number")) &&
            typeof issue.region.x === "number" &&
            typeof issue.region.y === "number" &&
            typeof issue.region.w === "number" &&
            typeof issue.region.h === "number")
            ? {
                type: "rect" as const,
                x: issue.region.x,
                y: issue.region.y,
                width: issue.region.w,
                height: issue.region.h
              }
            : issue.region.type === "polygon" && Array.isArray(issue.region.points)
              ? {
                  type: "polygon" as const,
                  points: issue.region.points
                    .filter((point): point is Record<string, unknown> => isRecord(point))
                    .map((point) => ({
                      x: typeof point.x === "number" ? point.x : 0,
                      y: typeof point.y === "number" ? point.y : 0
                    }))
              }
              : undefined
          : undefined,
        relatedElementIds: Array.isArray(issue.relatedElementIds)
          ? issue.relatedElementIds.filter((item): item is string => typeof item === "string")
          : Array.isArray(issue.related_ids)
            ? issue.related_ids.filter((item): item is string => typeof item === "string")
          : []
      }))
  };
};

const parseJsonResponse = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    throw new Error("응답 형식이 올바르지 않습니다.");
  }
};

export const normalizeApiBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

export const loadSavedApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(GUI_SERVER_STORAGE_KEY) ?? "";
};

export const loadInitialApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  const paramValue = params.get("server") ?? params.get("api") ?? "";
  return normalizeApiBaseUrl(paramValue || loadSavedApiBaseUrl());
};

export const saveApiBaseUrl = (value: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeApiBaseUrl(value);

  if (!normalized) {
    window.localStorage.removeItem(GUI_SERVER_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(GUI_SERVER_STORAGE_KEY, normalized);
};

export const validateApiBaseUrl = (value: string) => {
  const normalized = normalizeApiBaseUrl(value);

  if (!normalized) {
    throw new Error("GUI 서버 주소를 입력해주세요.");
  }

  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error("http:// 또는 https://가 포함된 주소를 입력해주세요.");
  }

  return normalized;
};

export const checkGuiServerHealth = async (apiBaseUrl: string) => {
  const normalized = validateApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${normalized}/health`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error(`서버 상태 확인에 실패했습니다. (${response.status})`);
  }

  return validateHealthResponse(await parseJsonResponse(response));
};

export const analyzeWithGuiServer = async (apiBaseUrl: string, payload: unknown) => {
  const normalized = validateApiBaseUrl(apiBaseUrl);
  const response = await fetch(`${normalized}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`배치 분석에 실패했습니다. (${response.status})`);
  }

  return validateAnalyzeResponse(await parseJsonResponse(response));
};
