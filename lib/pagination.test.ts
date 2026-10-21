import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, parsePagination } from "@/lib/pagination";

const parse = (qs: string) => parsePagination(new URLSearchParams(qs));

describe("parsePagination", () => {
  it("defaults to the first page", () => {
    assert.deepEqual(parse(""), { page: 1, pageSize: DEFAULT_PAGE_SIZE, skip: 0, take: DEFAULT_PAGE_SIZE });
  });

  it("computes skip/take from page and pageSize", () => {
    assert.deepEqual(parse("page=3&pageSize=50"), { page: 3, pageSize: 50, skip: 100, take: 50 });
  });

  it("caps the page size so a client can't request the whole table", () => {
    assert.equal(parse("pageSize=100000").pageSize, MAX_PAGE_SIZE);
  });

  it("falls back to defaults on invalid values", () => {
    for (const qs of ["page=0", "page=-2", "page=abc", "page=1.5", "pageSize=0", "pageSize=x"]) {
      const p = parse(qs);
      assert.ok(p.page >= 1 && p.pageSize >= 1 && p.pageSize <= MAX_PAGE_SIZE, qs);
      assert.equal(p.skip, (p.page - 1) * p.pageSize, qs);
    }
  });
});
