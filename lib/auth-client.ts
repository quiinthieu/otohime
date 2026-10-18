import { adminClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { roles } from "./permissions";

export const authClient = createAuthClient({
  plugins: [adminClient({ roles })],
});
