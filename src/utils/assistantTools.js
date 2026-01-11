export const TOOL_RISK = {
  READ: "read",
  WRITE: "write",
  DESTRUCTIVE: "destructive"
};

export const TOOL_REGISTRY = [
  {
    name: "workflow_create",
    description: "Create nodes and edges in the current workflow.",
    risk: TOOL_RISK.WRITE,
    parameters: {
      type: "object",
      properties: {
        replace: {
          type: "boolean",
          description: "If true, clear the existing workflow before adding new nodes."
        },
        nodes: {
          type: "array",
          description: "Nodes to create.",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Unique node id. Use short, stable ids."
              },
              type: {
                type: "string",
                description: "Node type id (example: text, image)."
              },
              label: {
                type: "string",
                description: "Optional display label for the node."
              },
              position: {
                type: "object",
                description: "Optional canvas position.",
                properties: {
                  x: { type: "number" },
                  y: { type: "number" }
                },
                required: ["x", "y"]
              },
              data: {
                type: "object",
                description:
                  "Optional node data overrides (use node schema field keys like systemPrompt, temperature, maxTokens)."
              }
            },
            required: ["id", "type"]
          }
        },
        edges: {
          type: "array",
          description: "Edges to create between nodes.",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              sourceHandle: { type: "string" },
              target: { type: "string" },
              targetHandle: { type: "string" },
              dataType: {
                type: "string",
                description: "Optional data type hint (text, image, video, audio, model)."
              }
            },
            required: ["source", "target"]
          }
        }
      },
      required: ["nodes"]
    }
  },
  {
    name: "workflow_connect",
    description: "Connect existing nodes with edges.",
    risk: TOOL_RISK.WRITE,
    parameters: {
      type: "object",
      properties: {
        connections: {
          type: "array",
          description: "Edges to add.",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              sourceHandle: { type: "string" },
              target: { type: "string" },
              targetHandle: { type: "string" },
              dataType: {
                type: "string",
                description: "Optional data type hint (text, image, video, audio, model)."
              }
            },
            required: ["source", "target"]
          }
        }
      },
      required: ["connections"]
    }
  },
  {
    name: "workflow_validate",
    description: "Validate the current workflow connections and report issues.",
    risk: TOOL_RISK.READ,
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "workflow_run",
    description: "Run/activate the current workflow.",
    risk: TOOL_RISK.WRITE,
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "text_node_set_prompts",
    description:
      "Update the user prompt and/or system prompt for a Text (text) node. DEPRECATED: Use workflow_update_node instead for general updates.",
    risk: TOOL_RISK.WRITE,
    parameters: {
      type: "object",
      properties: {
        nodeId: {
          type: "string",
          description:
            "Text node id to update. If omitted, the only Text node will be used."
        },
        prompt: {
          type: "string",
          description: "User prompt to set on the Text node."
        },
        systemPrompt: {
          type: "string",
          description: "Optional system prompt to set on the Text node."
        }
      }
    }
  },
  // Phase 1: Read/Query Tools
  {
    name: "workflow_get_state",
    description: "Get the current workflow state including all nodes and edges. Use this before making changes to understand what already exists.",
    risk: TOOL_RISK.READ,
    parameters: {
      type: "object",
      properties: {
        include_data: {
          type: "boolean",
          description: "If true, include full node data. If false, return only ids and types for a compact overview."
        }
      }
    }
  },
  {
    name: "workflow_get_node",
    description: "Get detailed information about a specific node including its configuration, current data values, and connections.",
    risk: TOOL_RISK.READ,
    parameters: {
      type: "object",
      properties: {
        nodeId: {
          type: "string",
          description: "The ID of the node to inspect."
        }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "workflow_get_outputs",
    description: "Get the output values from nodes after running the workflow. Use this to see results and verify the workflow worked correctly.",
    risk: TOOL_RISK.READ,
    parameters: {
      type: "object",
      properties: {
        nodeIds: {
          type: "array",
          items: { type: "string" },
          description: "List of node IDs to get outputs from. If empty or omitted, returns outputs from all nodes that have them."
        }
      }
    }
  },
  // Phase 2: Mutation Tools
  {
    name: "workflow_update_node",
    description: "Update data fields on any node. Use this to modify settings like model, prompt, temperature, dimensions, etc.",
    risk: TOOL_RISK.WRITE,
    parameters: {
      type: "object",
      properties: {
        nodeId: {
          type: "string",
          description: "The ID of the node to update."
        },
        data: {
          type: "object",
          description: "Object containing the fields to update. Only specified fields will be changed."
        },
        label: {
          type: "string",
          description: "Optional new label/title for the node."
        }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "workflow_delete_nodes",
    description: "Delete one or more nodes from the workflow. Connected edges will be automatically removed.",
    risk: TOOL_RISK.WRITE,
    parameters: {
      type: "object",
      properties: {
        nodeIds: {
          type: "array",
          items: { type: "string" },
          description: "List of node IDs to delete."
        }
      },
      required: ["nodeIds"]
    }
  },
  {
    name: "workflow_delete_edges",
    description: "Delete specific edges/connections between nodes without removing the nodes themselves.",
    risk: TOOL_RISK.WRITE,
    parameters: {
      type: "object",
      properties: {
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              target: { type: "string" },
              sourceHandle: { type: "string" },
              targetHandle: { type: "string" }
            },
            required: ["source", "target"]
          },
          description: "List of edges to delete. Specify source/target, optionally with handles for precision."
        }
      },
      required: ["edges"]
    }
  },
  {
    name: "workflow_clear",
    description: "Clear the entire workflow, removing all nodes and edges. Use with caution.",
    risk: TOOL_RISK.DESTRUCTIVE,
    parameters: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Must be true to confirm clearing the workflow."
        }
      },
      required: ["confirm"]
    }
  }
];

export const getOpenRouterTools = () =>
  TOOL_REGISTRY.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));

export const getToolDefinition = (name) =>
  TOOL_REGISTRY.find((tool) => tool.name === name) || null;
