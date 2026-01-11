import React, { useMemo, useRef, useState, useEffect } from "react";
import { FaPaperPlane, FaTrashAlt, FaTimes } from "react-icons/fa";
import appIcon from "../../appICON.png";
import { callOpenRouter } from "../utils/openrouterClient";
import { getOpenRouterTools } from "../utils/assistantTools";
import { on } from "../utils/eventBus";
import "./AssistantPanel.css";

const normalizeToolCalls = (toolCalls = []) =>
  toolCalls.map((call, index) => {
    const id = call.id || `toolcall-${Date.now()}-${index}`;
    const name = call.function?.name || call.name || "unknown";
    const rawArgs = call.function?.arguments || call.arguments || "{}";
    const args =
      typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs || {});
    return {
      id,
      type: call.type || "function",
      function: {
        name,
        arguments: args
      }
    };
  });

const normalizeAssistantMessage = (message) => {
  if (!message) return null;
  return {
    role: message.role || "assistant",
    content: message.content || "",
    tool_calls: normalizeToolCalls(message.tool_calls || [])
  };
};

const normalizeMessagesForTools = (messages) => {
  const toolCallIds = new Set();
  const toolMessagesById = new Map();
  const toolCallNamesById = new Map();

  messages.forEach((message) => {
    if (message.role === "assistant" && message.tool_calls?.length) {
      message.tool_calls.forEach((call) => {
        if (call?.id) {
          toolCallIds.add(call.id);
          if (call.function?.name) {
            toolCallNamesById.set(call.id, call.function.name);
          }
        }
      });
    }
    if (message.role === "tool" && message.tool_call_id) {
      toolMessagesById.set(message.tool_call_id, message);
    }
  });

  const normalized = [];
  const consumed = new Set();

  messages.forEach((message) => {
    if (message.role === "tool" && toolCallIds.has(message.tool_call_id)) {
      return;
    }

    normalized.push(message);

    if (message.role === "assistant" && message.tool_calls?.length) {
      message.tool_calls.forEach((call) => {
        if (call?.id && !consumed.has(call.id)) {
          const toolMessage = toolMessagesById.get(call.id);
          if (toolMessage) {
            normalized.push(toolMessage);
            consumed.add(call.id);
            return;
          }

          normalized.push({
            role: "tool",
            tool_call_id: call.id,
            name: toolCallNamesById.get(call.id),
            content: JSON.stringify({
              error: "Missing tool output. Auto-inserted placeholder."
            })
          });
          consumed.add(call.id);
        }
      });
    }
  });

  return normalized;
};

const findMissingToolOutputs = (messages) => {
  const missing = new Set();
  let pendingIds = [];

  messages.forEach((message) => {
    if (pendingIds.length > 0) {
      if (message.role === "tool") {
        const idx = pendingIds.indexOf(message.tool_call_id);
        if (idx >= 0) {
          pendingIds.splice(idx, 1);
        }
        return;
      }

      if (message.role === "assistant" || message.role === "user") {
        pendingIds.forEach((id) => missing.add(id));
        pendingIds = [];
      }
    }

    if (
      pendingIds.length === 0 &&
      message.role === "assistant" &&
      message.tool_calls?.length
    ) {
      pendingIds = message.tool_calls
        .map((call) => call.id)
        .filter(Boolean);
    }
  });

  pendingIds.forEach((id) => missing.add(id));
  return Array.from(missing);
};

const buildRequestMessages = (systemPrompt, messages) => {
  const trimmed = systemPrompt?.trim();
  const system = trimmed ? [{ role: "system", content: trimmed }] : [];
  return [...system, ...messages];
};

const MAX_TOOL_ROUNDS = 8;
const MAX_RECENT_MODELS = 6;
const PANEL_OPEN_STORAGE_KEY = "assistant-panel-open";
const MODEL_CATALOG = [
  {
    id: "openrouter/auto",
    label: "Auto Router",
    provider: "OpenRouter",
    tags: ["auto"],
    featured: true
  },
  {
    id: "openai/gpt-5.2",
    label: "GPT-5.2",
    provider: "OpenAI",
    tags: ["reasoning", "tools"],
    featured: true
  },
  {
    id: "openai/gpt-4.1",
    label: "GPT-4.1",
    provider: "OpenAI",
    tags: ["general", "tools"],
    featured: true
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    tags: ["multimodal", "tools"],
    featured: true
  },
  {
    id: "anthropic/claude-3.7-sonnet",
    label: "Claude 3.7 Sonnet",
    provider: "Anthropic",
    tags: ["reasoning", "tools"],
    featured: true
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    tags: ["general", "tools"],
    featured: true
  },
  {
    id: "anthropic/claude-3-haiku",
    label: "Claude 3 Haiku",
    provider: "Anthropic",
    tags: ["fast"],
    featured: false
  },
  {
    id: "google/gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "Google",
    tags: ["multimodal", "fast"],
    featured: true
  },
  {
    id: "google/gemini-2.0-pro",
    label: "Gemini 2.0 Pro",
    provider: "Google",
    tags: ["multimodal", "reasoning"],
    featured: true
  },
  {
    id: "google/gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    provider: "Google",
    tags: ["multimodal"],
    featured: false
  },
  {
    id: "google/gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    provider: "Google",
    tags: ["fast"],
    featured: false
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    label: "Llama 3.1 70B Instruct",
    provider: "Meta",
    tags: ["open", "reasoning"],
    featured: true
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct",
    label: "Llama 3.1 8B Instruct",
    provider: "Meta",
    tags: ["open", "fast"],
    featured: false
  },
  {
    id: "mistralai/mistral-large",
    label: "Mistral Large",
    provider: "Mistral",
    tags: ["general"],
    featured: true
  },
  {
    id: "mistralai/mistral-small",
    label: "Mistral Small",
    provider: "Mistral",
    tags: ["fast"],
    featured: false
  },
  {
    id: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    provider: "DeepSeek",
    tags: ["reasoning"],
    featured: true
  },
  {
    id: "deepseek/deepseek-v3",
    label: "DeepSeek V3",
    provider: "DeepSeek",
    tags: ["general"],
    featured: false
  },
  {
    id: "qwen/qwen-2.5-72b-instruct",
    label: "Qwen 2.5 72B Instruct",
    provider: "Qwen",
    tags: ["open", "reasoning"],
    featured: true
  },
  {
    id: "qwen/qwen-2.5-32b-instruct",
    label: "Qwen 2.5 32B Instruct",
    provider: "Qwen",
    tags: ["open"],
    featured: false
  },
  // Ollama (Local) models
  {
    id: "ollama/llama3.2",
    label: "Llama 3.2",
    provider: "Ollama",
    tags: ["local", "open"],
    featured: true
  },
  {
    id: "ollama/llama3.1",
    label: "Llama 3.1",
    provider: "Ollama",
    tags: ["local", "open"],
    featured: false
  },
  {
    id: "ollama/mistral",
    label: "Mistral",
    provider: "Ollama",
    tags: ["local", "open"],
    featured: false
  },
  {
    id: "ollama/codellama",
    label: "Code Llama",
    provider: "Ollama",
    tags: ["local", "code"],
    featured: false
  },
  {
    id: "ollama/gemma2",
    label: "Gemma 2",
    provider: "Ollama",
    tags: ["local", "open"],
    featured: false
  },
  {
    id: "ollama/qwen2.5",
    label: "Qwen 2.5",
    provider: "Ollama",
    tags: ["local", "open"],
    featured: false
  },
  {
    id: "ollama/deepseek-r1",
    label: "DeepSeek R1",
    provider: "Ollama",
    tags: ["local", "reasoning"],
    featured: true
  },
  // LM Studio (Local) models
  {
    id: "lmstudio/local-model",
    label: "Local Model",
    provider: "LM Studio",
    tags: ["local"],
    featured: true
  }
];

const buildModelSearchText = (entry) =>
  [entry.id, entry.label, entry.provider, ...(entry.tags || [])]
    .join(" ")
    .toLowerCase();

const AssistantPanel = ({
  openRouterApiKey,
  systemPrompt,
  executeToolCall,
  defaultModel = "openai/gpt-5.2"
}) => {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(PANEL_OPEN_STORAGE_KEY);
      if (stored !== null) {
        return stored === "true";
      }
    } catch (error) {
      // Ignore storage failures.
    }
    return false;
  });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelProvider, setModelProvider] = useState("All");
  const [recentModels, setRecentModels] = useState(() => {
    try {
      const stored = localStorage.getItem("assistant-recent-models");
      const parsed = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((entry) => typeof entry === "string");
    } catch (error) {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const messagesRef = useRef(messages);
  const messagesContainerRef = useRef(null);
  const panelRef = useRef(null);
  const modelPickerRef = useRef(null);
  messagesRef.current = messages;

  const tools = useMemo(() => getOpenRouterTools(), []);
  const providerOptions = useMemo(() => {
    const providers = MODEL_CATALOG.map((entry) => entry.provider);
    return ["All", ...Array.from(new Set(providers))];
  }, []);
  const featuredModels = useMemo(() => {
    return MODEL_CATALOG.filter((entry) => entry.featured);
  }, []);
  const filteredModels = useMemo(() => {
    const query = model.trim().toLowerCase();
    const providerFiltered =
      modelProvider === "All"
        ? MODEL_CATALOG
        : MODEL_CATALOG.filter((entry) => entry.provider === modelProvider);
    if (!query) return providerFiltered;
    return providerFiltered.filter((entry) =>
      buildModelSearchText(entry).includes(query)
    );
  }, [model, modelProvider]);
  const recentEntries = useMemo(() => {
    return recentModels.map((entry) => {
      const match = MODEL_CATALOG.find((modelEntry) => modelEntry.id === entry);
      return (
        match || {
          id: entry,
          label: entry,
          provider: "Custom",
          tags: ["custom"],
          featured: false
        }
      );
    });
  }, [recentModels]);
  const visibleMessages = useMemo(
    () =>
      messages.filter((message) => {
        if (message.role === "tool") return false;
        if (message.role === "assistant" && !message.content?.trim()) return false;
        return true;
      }),
    [messages]
  );

  useEffect(() => {
    const offOpen = on("assistantOpen", () => setIsOpen(true));
    const offClose = on("assistantClose", () => setIsOpen(false));
    const offToggle = on("assistantToggle", () => setIsOpen((prev) => !prev));

    return () => {
      offOpen();
      offClose();
      offToggle();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen || !isLoading) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [isLoading, isOpen]);

  useEffect(() => {
    if (!isOpen || !isLoading) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [isLoading, isOpen]);

  useEffect(() => {
    if (!isOpen || !isLoading) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [isLoading, isOpen]);

  useEffect(() => {
    if (!isOpen || !isLoading) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [isLoading, isOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PANEL_OPEN_STORAGE_KEY, String(isOpen));
    } catch (error) {
      // Ignore storage failures.
    }
  }, [isOpen]);

  useEffect(() => {
    const root = document.documentElement;
    const panel = panelRef.current;

    const updateOffset = () => {
      if (!isOpen || !panel) {
        root.style.setProperty("--assistant-panel-offset", "0px");
        return;
      }
      if (window.matchMedia && window.matchMedia("(max-width: 720px)").matches) {
        root.style.setProperty("--assistant-panel-offset", "0px");
        return;
      }
      const width = panel.getBoundingClientRect().width;
      root.style.setProperty(
        "--assistant-panel-offset",
        `${Math.max(0, Math.round(width))}px`
      );
    };

    updateOffset();

    if (!isOpen || !panel) {
      return () => {
        root.style.setProperty("--assistant-panel-offset", "0px");
      };
    }

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateOffset);
      observer.observe(panel);
    } else {
      window.addEventListener("resize", updateOffset);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", updateOffset);
      }
      root.style.setProperty("--assistant-panel-offset", "0px");
    };
  }, [isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "assistant-recent-models",
        JSON.stringify(recentModels.slice(0, MAX_RECENT_MODELS))
      );
    } catch (error) {
      // Ignore storage failures.
    }
  }, [recentModels]);

  useEffect(() => {
    if (!modelPickerOpen) return;
    const handleClick = (event) => {
      if (!modelPickerRef.current) return;
      if (!modelPickerRef.current.contains(event.target)) {
        setModelPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [modelPickerOpen]);

  const rememberModel = (modelId) => {
    const trimmed = modelId.trim();
    if (!trimmed) return;
    setRecentModels((prev) => {
      const next = [trimmed, ...prev.filter((entry) => entry !== trimmed)];
      return next.slice(0, MAX_RECENT_MODELS);
    });
  };

  const handleSelectModel = (modelId) => {
    setModel(modelId);
    setModelPickerOpen(false);
    rememberModel(modelId);
  };

  const handleModelInputChange = (event) => {
    setModel(event.target.value);
    if (!modelPickerOpen) {
      setModelPickerOpen(true);
    }
  };

  const modelQuery = model.trim();
  const hasVisibleMatch = filteredModels.some((entry) => entry.id === modelQuery);
  const showCustomOption = modelQuery.length > 0 && !hasVisibleMatch;
  const providerMatches = (entry) =>
    modelProvider === "All" || entry.provider === modelProvider;
  const activeModelId = model.trim();
  const renderModelOption = (entry) => (
    <button
      type="button"
      key={entry.id}
      className={`assistant-model-option ${
        activeModelId === entry.id ? "is-active" : ""
      }`}
      onClick={() => handleSelectModel(entry.id)}
    >
      <div className="assistant-model-main">
        <span className="assistant-model-label">{entry.label}</span>
        <span className="assistant-model-id">{entry.id}</span>
      </div>
      <span className="assistant-model-provider">{entry.provider}</span>
    </button>
  );

  const appendMessage = (message) => {
    const next = [...messagesRef.current, message];
    messagesRef.current = next;
    setMessages(next);
  };

  const executeToolCalls = async (toolCalls) => {
    let hadError = false;

    for (const call of toolCalls) {
      let toolResult = null;
      let toolError = null;

      try {
        toolResult = await executeToolCall(call);
      } catch (err) {
        toolError = err.message || "Tool execution failed.";
        toolResult = { error: toolError };
      }

      if (!toolError && toolResult?.error) {
        toolError = toolResult.error;
      }

      if (toolError) {
        hadError = true;
      }

      appendMessage({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(toolResult ?? { error: toolError }),
        name: call.function?.name
      });
    }

    return hadError;
  };

  const sendToOpenRouter = async (nextMessages, toolDepth = 0) => {
    const modelId = model.trim();
    if (!modelId) {
      throw new Error("Add a model id before sending.");
    }
    const normalizedMessages = normalizeMessagesForTools(nextMessages);
    const missingToolOutputs = findMissingToolOutputs(normalizedMessages);
    if (missingToolOutputs.length) {
      setError(
        `Recovered missing tool outputs for ${missingToolOutputs.join(
          ", "
        )}.`
      );
    }
    if (
      normalizedMessages.length !== nextMessages.length ||
      normalizedMessages.some((message, index) => message !== nextMessages[index])
    ) {
      messagesRef.current = normalizedMessages;
      setMessages(normalizedMessages);
    }

    // Add round awareness context for multi-step operations
    let messagesWithContext = normalizedMessages;
    if (toolDepth > 0) {
      const roundsRemaining = MAX_TOOL_ROUNDS - toolDepth;
      const roundContext = `[Tool round ${toolDepth + 1}/${MAX_TOOL_ROUNDS}. ${roundsRemaining} rounds remaining. Continue with the task.]`;
      messagesWithContext = [
        ...normalizedMessages,
        { role: "system", content: roundContext }
      ];
    }

    const requestMessages = buildRequestMessages(systemPrompt, messagesWithContext);
    const response = await callOpenRouter({
      apiKey: openRouterApiKey,
      model: modelId,
      messages: requestMessages,
      tools
    });

    const assistantMessage = normalizeAssistantMessage(
      response?.choices?.[0]?.message
    );

    if (!assistantMessage) {
      throw new Error("No assistant response received.");
    }

    appendMessage(assistantMessage);

    if (assistantMessage.tool_calls?.length) {
      if (toolDepth >= MAX_TOOL_ROUNDS) {
        setError(
          `Reached tool limit (${MAX_TOOL_ROUNDS} rounds). Type "continue" to proceed with more actions.`
        );
        return;
      }

      const hadError = await executeToolCalls(assistantMessage.tool_calls);
      if (hadError) {
        // Enhanced error recovery: add context for the assistant to retry
        const failedTools = assistantMessage.tool_calls
          .map((call) => call.function?.name)
          .join(", ");
        appendMessage({
          role: "system",
          content: `Some tool actions failed (${failedTools}). Consider using workflow_get_state to check current state and retry with corrected parameters.`
        });
      }

      await sendToOpenRouter(messagesRef.current, toolDepth + 1);
    }
  };

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed || isLoading) return;

    if (!openRouterApiKey) {
      setError("Add an OpenRouter API key in Settings to use the assistant.");
      return;
    }

    if (!model.trim()) {
      setError("Add a model id before sending.");
      return;
    }

    rememberModel(model);
    setError("");
    setDraft("");
    setIsLoading(true);

    // Check if user is continuing after hitting tool limit
    const isContinue = trimmed.toLowerCase() === "continue";
    const userMessage = {
      role: "user",
      content: isContinue
        ? "Continue with the previous task where you left off."
        : trimmed
    };
    appendMessage(userMessage);

    try {
      // Reset tool depth when continuing to allow more rounds
      await sendToOpenRouter(messagesRef.current, 0);
    } catch (err) {
      setError(err.message || "Failed to reach OpenRouter.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    messagesRef.current = [];
    setDraft("");
    setError("");
  };

  return (
    <div
      ref={panelRef}
      className={`assistant-panel ${isOpen ? "open" : "closed"} ${
        isLoading ? "loading" : ""
      }`}
    >
      <div className="assistant-header">
        <div>
          <div className="assistant-title" title="noder.bot">
            <button
              type="button"
              className="assistant-icon-button"
              onClick={() => setIsOpen((prev) => !prev)}
              title={isOpen ? "Collapse" : "Expand"}
              aria-label={isOpen ? "Collapse assistant panel" : "Expand assistant panel"}
            >
              <img src={appIcon} alt="noder.bot" className="assistant-app-icon" />
            </button>
            <span className="assistant-title-text">noder.bot</span>
          </div>
        </div>
        <button
          className="assistant-reset"
          onClick={handleReset}
          title="Clear chat"
          aria-label="Clear chat"
        >
          <FaTrashAlt />
        </button>
      </div>

      {isOpen && (
        <>
          <div className="assistant-config">
            <label htmlFor="assistant-model">Model</label>
            <div className="assistant-model-picker" ref={modelPickerRef}>
              <div className="assistant-model-input-row">
                <input
                  id="assistant-model"
                  type="text"
                  value={model}
                  onChange={handleModelInputChange}
                  onFocus={() => setModelPickerOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setModelPickerOpen(false);
                      return;
                    }
                    if (event.key === "ArrowDown") {
                      setModelPickerOpen(true);
                    }
                  }}
                  placeholder="Search or enter model id"
                  autoComplete="off"
                />
                {model && (
                  <button
                    type="button"
                    className="assistant-model-clear"
                    onClick={() => {
                      setModel("");
                      setModelPickerOpen(true);
                    }}
                    title="Clear model"
                    aria-label="Clear model"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>
              {modelPickerOpen && (
                <div className="assistant-model-menu">
                  <div className="assistant-model-filters">
                    {providerOptions.map((provider) => (
                      <button
                        key={provider}
                        type="button"
                        className={`assistant-model-filter ${
                          modelProvider === provider ? "is-active" : ""
                        }`}
                        onClick={() => setModelProvider(provider)}
                      >
                        {provider}
                      </button>
                    ))}
                  </div>

                  {modelQuery ? (
                    <div className="assistant-model-group">
                      <div className="assistant-model-group-title">
                        {filteredModels.length ? "Matches" : "No matches"}
                      </div>
                      {filteredModels.map((entry) => renderModelOption(entry))}
                      {showCustomOption && (
                        <button
                          type="button"
                          className="assistant-model-option is-custom"
                          onClick={() => handleSelectModel(modelQuery)}
                        >
                          <div className="assistant-model-main">
                            <span className="assistant-model-label">
                              Use custom model id
                            </span>
                            <span className="assistant-model-id">
                              {modelQuery}
                            </span>
                          </div>
                          <span className="assistant-model-provider">Custom</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {recentEntries.filter(providerMatches).length > 0 && (
                        <div className="assistant-model-group">
                          <div className="assistant-model-group-title">Recent</div>
                          {recentEntries
                            .filter(providerMatches)
                            .map((entry) => renderModelOption(entry))}
                        </div>
                      )}
                      {featuredModels.filter(providerMatches).length > 0 && (
                        <div className="assistant-model-group">
                          <div className="assistant-model-group-title">
                            Featured
                          </div>
                          {featuredModels
                            .filter(providerMatches)
                            .map((entry) => renderModelOption(entry))}
                        </div>
                      )}
                      <div className="assistant-model-group">
                        <div className="assistant-model-group-title">All models</div>
                        {filteredModels.length ? (
                          filteredModels.map((entry) => renderModelOption(entry))
                        ) : (
                          <div className="assistant-model-empty">
                            No models for this filter.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="assistant-body">
            {messages.length === 0 && (
              <div className="assistant-empty">
                Describe a workflow to build, like "Summarize text and display the
                result."
              </div>
            )}

            <div className="assistant-messages" ref={messagesContainerRef}>
              {visibleMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`assistant-message assistant-message-${message.role}`}
                >
                  <div className="assistant-message-role">{message.role}</div>
                  {message.content && message.role !== "tool" && (
                    <div className="assistant-message-content">
                      {message.content}
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div
                  className="assistant-message assistant-message-assistant assistant-message-typing"
                  role="status"
                  aria-label="Assistant is typing"
                >
                  <div className="assistant-message-role">assistant</div>
                  <div className="assistant-message-content">
                    <span className="assistant-typing-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="assistant-footer">
            <div className="assistant-composer">
              <textarea
                rows={2}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe a workflow..."
                disabled={isLoading}
              />
              <button
                type="button"
                className={`assistant-send ${isLoading ? "is-loading" : ""}`}
                onClick={handleSend}
                disabled={isLoading}
                aria-busy={isLoading}
                aria-label={isLoading ? "Sending message" : "Send message"}
                title={isLoading ? "Sending..." : "Send"}
              >
                <FaPaperPlane />
              </button>
            </div>
          </div>

          {error && <div className="assistant-error">{error}</div>}
        </>
      )}
    </div>
  );
};

export default AssistantPanel;
