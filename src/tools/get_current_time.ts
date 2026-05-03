export const get_current_time = {
  name: "get_current_time",
  description: "Get the current date and time in ISO format.",
  parameters: {
    type: "object",
    properties: {},
    required: []
  },
  execute: async () => {
    return new Date().toISOString();
  }
};
