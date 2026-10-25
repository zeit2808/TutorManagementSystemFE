import { apiRequest } from "./http";
import type { EmailOverview, OutboxEmail } from "./types";

/** Platform admin: is real email going out? (the Worker sends; this reads the outbox). */
export const platformEmailApi = {
  overview() {
    return apiRequest<EmailOverview>("/platform/email");
  },
  sendTest(to: string | null) {
    return apiRequest<OutboxEmail>("/platform/email/test", { method: "POST", body: { to } });
  },
};
