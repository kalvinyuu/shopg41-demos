import type { ShopG41Client } from "../../client"
import type { AgentChatInput, AgentChatResponse } from "../../types"

export class AdminAgentResource {
  constructor(private client: ShopG41Client) {}

  /**
   * Run the store agent. Read answers are grounded in live store data; any
   * change is returned as a pendingAction and is NOT applied until approved
   * via the matching order/product admin routes.
   */
  async chat(input: AgentChatInput): Promise<AgentChatResponse> {
    return this.client.request("/api/admin/ai/agent", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }
}
