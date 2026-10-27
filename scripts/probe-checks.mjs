// Keep the first failures beside the final counts: verify-runner retains only a 4KiB output tail.
export function createProbeChecks(log = console.log) {
  let ok = 0;
  let failed = 0;
  const failures = [];
  const bounded = (value) => {
    let text = "";
    for (const point of value.replace(/[\r\n]/g, " ")) {
      if (Buffer.byteLength(text + point) > 550) return text + "…";
      text += point;
    }
    return text;
  };
  return {
    check(name, pass, detail = "") {
      const line = `${pass ? "ok" : "not ok"} - ${name}${!pass && detail ? `: ${detail}` : ""}`;
      if (pass) ok++;
      else {
        failed++;
        if (failures.length < 5) failures.push(bounded(line));
      }
      log(line);
    },
    finish() {
      if (failed) {
        log("# Failure recap (first 5, bounded for the verifier tail)");
        for (const failure of failures) log(failure);
        if (failed > failures.length) log(`# ${failed - failures.length} more failures; see the full probe output`);
      }
      log(`probe: ${ok} ok, ${failed} failed`);
      return failed ? 1 : 0;
    },
  };
}
