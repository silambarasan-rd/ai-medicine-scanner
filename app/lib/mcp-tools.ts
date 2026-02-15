// app/lib/mcp-tools.ts
// MCP Tool definitions for the AI chatbot

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  requiresConfirmation: boolean;
}

export const MCP_TOOLS: MCPTool[] = [
  // ========== MEDICINES (SCHEDULING) ==========
  {
    name: "list_medicines",
    description: "List all scheduled medicines for the user",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    requiresConfirmation: false
  },
  {
    name: "add_medicine",
    description: "Add a new scheduled medicine",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Medicine name" },
        pharmacy_medicine_id: { type: "string", description: "ID of the pharmacy medicine" },
        dosage: { type: "string", description: "Dosage (e.g., '500mg', '10ml')" },
        dose_unit: { type: "string", description: "Unit of measurement (mg, ml, tablet, capsule, etc)" },
        dose_amount: { type: "number", description: "Dose amount per intake (e.g., 1, 2, 0.5)" },
        occurrence: { 
          type: "string", 
          enum: ["once", "daily", "weekly", "monthly", "custom"],
          description: "Frequency of medication"
        },
        custom_occurrence: { type: "string", description: "Custom occurrence pattern (e.g., 'twice a week')" },
        scheduled_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
        timing: { type: "string", description: "Time to take (HH:MM format, e.g., '09:00', '14:30')" },
        meal_timing: { 
          type: "string",
          enum: ["before", "with", "after"],
          description: "When to take relative to meals"
        },
        notes: { type: "string", description: "Additional notes" },
        timezone: { type: "string", description: "User timezone (default UTC)" }
      },
      required: ["name", "pharmacy_medicine_id", "dose_unit", "occurrence", "scheduled_date", "timing", "meal_timing"]
    },
    requiresConfirmation: true
  },
  {
    name: "update_medicine",
    description: "Update a scheduled medicine",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Medicine ID" },
        name: { type: "string", description: "Medicine name" },
        dosage: { type: "string", description: "Dosage (e.g., '500mg')" },
        occurrence: { 
          type: "string",
          enum: ["once", "daily", "weekly", "monthly", "custom"],
          description: "Frequency of medication"
        },
        timing: { type: "string", description: "Time to take (HH:MM)" },
        meal_timing: { 
          type: "string",
          enum: ["before", "with", "after"],
          description: "When to take relative to meals"
        },
        notes: { type: "string", description: "Additional notes" }
      },
      required: ["id"]
    },
    requiresConfirmation: true
  },
  {
    name: "delete_medicine",
    description: "Delete a scheduled medicine",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Medicine ID to delete" }
      },
      required: ["id"]
    },
    requiresConfirmation: true
  },

  // ========== PHARMACY MEDICINES (INVENTORY) ==========
  {
    name: "list_pharmacy_medicines",
    description: "List all pharmacy medicines (digital pharmacy inventory)",
    inputSchema: {
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
        limit: { type: "number", description: "Number of results (default 50)" },
        offset: { type: "number", description: "Pagination offset" }
      },
      required: []
    },
    requiresConfirmation: false
  },
  {
    name: "add_pharmacy_medicine",
    description: "Add a new medicine to digital pharmacy inventory",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Medicine name" },
        dosage: { type: "string", description: "Dosage strength (e.g., 500mg, 10ml)" },
        description: { type: "string", description: "Description of the medicine" },
        category: { 
          type: "string", 
          enum: ["tablet", "capsule", "syrup", "injection", "ointment", "drops", "other"],
          description: "Category/form of medicine (REQUIRED)" 
        },
        safety_warnings: { type: "string", description: "Safety warnings or side effects" },
        image_url: { type: "string", description: "Image URL of the medicine" },
        available_stock: { type: "number", description: "Quantity in stock (default 0)" },
        stock_unit: { type: "string", description: "Unit of stock (tablet, ml, bottle, etc)" },
        tags: { 
          type: "array", 
          items: { type: "string" }, 
          description: "At least one tag for categorization (e.g., 'painkiller', 'antibiotic') - REQUIRED" 
        }
      },
      required: ["name", "category", "tags"]
    },
    requiresConfirmation: true
  },
  {
    name: "update_pharmacy_medicine",
    description: "Update a pharmacy medicine inventory entry",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Pharmacy medicine ID" },
        quantity: { type: "number", description: "Updated quantity" },
        expiry_date: { type: "string", description: "Expiry date (YYYY-MM-DD)" },
        storage_location: { type: "string", description: "Storage location" },
        notes: { type: "string", description: "Notes" },
        tags: { type: "array", items: { type: "string" }, description: "Tags" }
      },
      required: ["id"]
    },
    requiresConfirmation: true
  },
  {
    name: "delete_pharmacy_medicine",
    description: "Delete a pharmacy medicine from inventory",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Pharmacy medicine ID to delete" }
      },
      required: ["id"]
    },
    requiresConfirmation: true
  },

  // ========== CONFIRMATIONS ==========
  {
    name: "list_confirmations",
    description: "List recent medication confirmations (taken/skipped)",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Last N days (default 7)" },
        limit: { type: "number", description: "Number of results (default 50)" }
      },
      required: []
    },
    requiresConfirmation: false
  },
  {
    name: "record_confirmation",
    description: "Record that a medicine was taken or skipped",
    inputSchema: {
      type: "object",
      properties: {
        medicine_id: { type: "string", description: "Scheduled medicine ID" },
        date_take: { type: "string", description: "Date (YYYY-MM-DD)" },
        status: { 
          type: "string",
          enum: ["taken", "skipped"],
          description: "Whether medicine was taken or skipped"
        },
        notes: { type: "string", description: "Optional notes" }
      },
      required: ["medicine_id", "date_take", "status"]
    },
    requiresConfirmation: true
  },

  // ========== HOSPITALS ==========
  {
    name: "list_hospitals",
    description: "List hospitals directory",
    inputSchema: {
      type: "object",
      properties: {
        district: { type: "string", description: "Filter by district" },
        speciality: { type: "string", description: "Filter by speciality" },
        limit: { type: "number", description: "Number of results (default 50)" },
        offset: { type: "number", description: "Pagination offset" }
      },
      required: []
    },
    requiresConfirmation: false
  },

  // ========== PROFILE ==========
  {
    name: "get_profile",
    description: "Get user profile information",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    },
    requiresConfirmation: false
  },
  {
    name: "update_profile",
    description: "Update user profile information",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full name" },
        phone: { type: "string", description: "Phone number" },
        emergency_contact: { type: "string", description: "Emergency contact info" },
        medical_conditions: { type: "string", description: "Known medical conditions" }
      },
      required: []
    },
    requiresConfirmation: true
  },

  // ========== MEDICINE IDENTIFICATION ==========
  {
    name: "identify_medicine",
    description: "Identify a medicine from an image (requires image upload)",
    inputSchema: {
      type: "object",
      properties: {
        image: { type: "string", description: "Base64-encoded JPEG image of the medicine" }
      },
      required: ["image"]
    },
    requiresConfirmation: false
  }
];

export function findTool(name: string): MCPTool | undefined {
  return MCP_TOOLS.find(tool => tool.name === name);
}

export function getToolNames(): string[] {
  return MCP_TOOLS.map(tool => tool.name);
}
