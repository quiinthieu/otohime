/** Evidence copied from browser events; no message-text-only exemptions. */
export type ResourceResponse = { url: string; status: number; method: string; resourceType: string };
export type ConsoleError = { text: string; url: string; line: number; column: number; args: number };
export interface BrowserErrors {
  response(value: ResourceResponse): void;
  console(value: ConsoleError): void;
  pageError(message: string): void;
  /** Register an explicitly asserted response from a deliberate negative case. */
  expectResourceError(value: ResourceResponse): void;
  readonly unexpected: string[];
}

export function collectBrowserErrors(origin: string): BrowserErrors {
  const endpoint = new URL("/api/ghosts", origin).href;
  const errors: { text: string; resource?: ConsoleError }[] = [];
  const expected: ResourceResponse[] = [];
  return {
    response(value) {
      if (value.url === endpoint && value.status === 404 && value.method === "GET" && value.resourceType === "fetch") expected.push(value);
    },
    console(value) {
      errors.push({ text: value.text, resource: value });
    },
    pageError(message) { errors.push({ text: message }); },
    expectResourceError(value) { expected.push(value); },
    get unexpected() {
      // Response and console notifications may arrive in either order. Match one for one;
      // a failed request without a response can never earn an exemption.
      const remaining = [...expected];
      return errors.filter(error => {
        const resource = error.resource;
        if (!resource || resource.args !== 0 || resource.line !== 0 || resource.column !== 0) return true;
        const match = remaining.findIndex(response => resource.url === response.url && (
          resource.text === `Failed to load resource: the server responded with a status of ${response.status} ()` ||
          (response.status === 400 && resource.text === "Failed to load resource: the server responded with a status of 400 (Bad Request)") ||
          (response.status === 404 && resource.text === "Failed to load resource: the server responded with a status of 404 (Not Found)")
        ));
        if (match < 0) return true;
        remaining.splice(match, 1);
        return false;
      }).map(error => error.text);
    },
  };
}
