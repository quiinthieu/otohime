/** Evidence copied from browser events; no message-text-only exemptions. */
export type ResourceResponse = { url: string; status: number; method: string; resourceType: string };
export type ConsoleError = { text: string; url: string; line: number; column: number; args: number };
export interface BrowserErrors {
  response(value: ResourceResponse): void;
  console(value: ConsoleError): void;
  pageError(message: string): void;
  readonly unexpected: string[];
}

export function collectBrowserErrors(origin: string, expectedRequests: readonly ResourceResponse[] = []): BrowserErrors {
  const endpoint = new URL("/api/ghosts", origin).href;
  const rules = [{ url: endpoint, status: 404, method: "GET", resourceType: "fetch" }, ...expectedRequests];
  const errors: { text: string; candidate: number }[] = [];
  const responses = rules.map(() => 0);
  return {
    response(value) {
      const index = rules.findIndex(rule => value.url === rule.url && value.status === rule.status && value.method === rule.method && value.resourceType === rule.resourceType);
      if (index >= 0) responses[index]++;
    },
    console(value) {
      const reasons: Record<number, string> = { 400: "Bad Request", 404: "Not Found" };
      errors.push({ text: value.text, candidate: rules.findIndex(rule => value.url === rule.url && value.args === 0 && value.line === 0 && value.column === 0 &&
        (value.text === `Failed to load resource: the server responded with a status of ${rule.status} (${reasons[rule.status]})` ||
          value.text === `Failed to load resource: the server responded with a status of ${rule.status} ()`)) });
    },
    pageError(message) { errors.push({ text: message, candidate: -1 }); },
    get unexpected() {
      // Response and console notifications may arrive in either order. Match one for one;
      // a failed request without a response can never earn an exemption.
      const remaining = [...responses];
      return errors.filter(error => !(error.candidate >= 0 && remaining[error.candidate]-- > 0)).map(error => error.text);
    },
  };
}
