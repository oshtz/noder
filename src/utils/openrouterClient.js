const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const buildHeaders = (apiKey) => {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  if (typeof window !== "undefined" && window.location?.origin) {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "noder";
  }

  return headers;
};

export const callOpenRouter = async ({
  apiKey,
  model,
  messages,
  tools = [],
  toolChoice = "auto",
  signal
}) => {
  if (!apiKey) {
    throw new Error("Missing OpenRouter API key.");
  }

  const body = {
    model,
    messages
  };

  if (tools.length) {
    body.tools = tools;
    body.tool_choice = toolChoice;
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
    signal
  });

  const responseText = await response.text();
  let data = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    const message = data?.error?.message || response.statusText || "Bad Request";
    const details = data?.error?.details || responseText;
    const suffix = details ? ` (${details})` : "";
    throw new Error(`OpenRouter error: ${message}${suffix}`);
  }

  return data;
};
