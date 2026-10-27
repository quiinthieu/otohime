/** Evidence copied from browser events; no message-text-only exemptions. */
export type ResourceResponse = { url: string; status: number; method: string; resourceType: string };
export type ConsoleError = { text: string; url: string; line: number; column: number; args: number };
export interface BrowserErrors {
  response(value: ResourceResponse): void;
  console(value: ConsoleError): void;
  pageError(message: string): void;
  readonly unexpected: string[];
}

export function collectBrowserErrors(origin: string): BrowserErrors {
  const endpoint = new URL("/api/ghosts", origin).href;
  const errors: { text: string; candidate: boolean }[] = [];
  let disabledResponses = 0;
  return {
    response(value) {
      if (value.url === endpoint && value.status === 404 && value.method === "GET" && value.resourceType === "fetch") disabledResponses++;
    },
    console(value) {
      errors.push({ text: value.text, candidate: value.url === endpoint && value.args === 0 && value.line === 0 && value.column === 0 &&
        value.text === "Failed to load resource: the server responded with a status of 404 (Not Found)" });
    },
    pageError(message) { errors.push({ text: message, candidate: false }); },
    get unexpected() {
      // Response and console notifications may arrive in either order. Match one for one;
      // a failed request without a response can never earn an exemption.
      let remaining = disabledResponses;
      return errors.filter(error => !(error.candidate && remaining-- > 0)).map(error => error.text);
    },
  };
}
