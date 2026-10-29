import { test } from "node:test";
import assert from "node:assert/strict";
import { safeExternalUrl, MAX_EXTERNAL_URL_LENGTH } from "./safe-url";

test("http(s) URLs are kept", () => {
  assert.equal(safeExternalUrl("https://pacs.local/study/1"), "https://pacs.local/study/1");
  assert.equal(safeExternalUrl("  http://10.0.0.5/viewer?id=2 "), "http://10.0.0.5/viewer?id=2");
});

test("script-running and malformed URLs are refused", () => {
  for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>x</script>", "vbscript:x", "file:///etc/passwd", "not a url", "", null, undefined]) {
    assert.equal(safeExternalUrl(bad), null, String(bad));
  }
});

test("over-long URLs are refused", () => {
  assert.equal(safeExternalUrl(`https://x.org/${"a".repeat(MAX_EXTERNAL_URL_LENGTH)}`), null);
});
