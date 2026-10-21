import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "@/lib/csv";

describe("csvCell", () => {
  it("leaves plain values unquoted", () => {
    assert.equal(csvCell("Dr Ada"), "Dr Ada");
    assert.equal(csvCell(42), "42");
    assert.equal(csvCell(null), "");
  });

  it("quotes separators, quotes and line breaks", () => {
    assert.equal(csvCell("a,b"), '"a,b"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  });

  it("neutralises spreadsheet formulas in text", () => {
    assert.equal(csvCell("=HYPERLINK(\"http://x\")"), "\"'=HYPERLINK(\"\"http://x\"\")\"");
    assert.equal(csvCell("+33 6 00"), "'+33 6 00");
    assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  });

  it("keeps negative numbers as numbers", () => {
    assert.equal(csvCell(-5), "-5");
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF", () => {
    assert.equal(toCsv([["a", "b"], ["c", null]]), "a,b\r\nc,");
  });
});
