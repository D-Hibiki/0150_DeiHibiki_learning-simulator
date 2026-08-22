export const AGENT_APP_ORIGIN = "http://127.0.0.1:5173";

export function isAllowedAgentMutationOrigin(origin: string | undefined): boolean {
  return origin === AGENT_APP_ORIGIN;
}
