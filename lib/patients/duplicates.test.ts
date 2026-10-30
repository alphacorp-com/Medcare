import { test } from "node:test";
import assert from "node:assert/strict";
import { duplicateReasons, normalizeName, normalizePhone, type DuplicateCandidate } from "./duplicates";

const existing: DuplicateCandidate = {
  id: "p1",
  ipp: "100000001",
  firstName: "Marie-Claire",
  lastName: "NGONO",
  birthDate: new Date("1990-04-12"),
  nss: "NSS-001",
  phone: "+237 6 99 12 34 56",
};
const born = new Date("1990-04-12");

test("names and phones are normalised", () => {
  assert.equal(normalizeName("  Marie-Claire   ÉLOUNDOU "), "marie claire eloundou");
  assert.equal(normalizePhone("+237 699 12 34 56"), "699123456");
  assert.equal(normalizePhone("00237699123456"), "699123456");
  assert.equal(normalizePhone("1234"), "", "too short to compare");
});

test("same name and birth date: case, accents, hyphens and swapped names do not hide it", () => {
  assert.deepEqual(duplicateReasons({ firstName: "marie claire", lastName: "Ngono", birthDate: born }, existing), ["name_birth_date"]);
  assert.deepEqual(duplicateReasons({ firstName: "NGONO", lastName: "Marie Claire", birthDate: born }, existing), ["name_birth_date"], "swapped");
  assert.deepEqual(duplicateReasons({ firstName: "Marie", lastName: "Ngono", birthDate: born }, existing), ["name_birth_date"], "short first name");
  assert.deepEqual(duplicateReasons({ firstName: "Marius", lastName: "Ngono", birthDate: born }, { ...existing, firstName: "Mari" }), [], "a prefix inside a word is not a match");
});

test("same name, another birth date: not a duplicate by name", () => {
  assert.deepEqual(duplicateReasons({ firstName: "Marie-Claire", lastName: "Ngono", birthDate: new Date("1991-04-12") }, existing), []);
});

test("same NSS is always a duplicate", () => {
  assert.deepEqual(duplicateReasons({ firstName: "Paul", lastName: "Biya", birthDate: new Date("2000-01-01"), nss: "nss-001" }, existing), ["nss"]);
});

test("same phone counts with the same birth date or the same last name", () => {
  const phone = "699123456";
  assert.deepEqual(duplicateReasons({ firstName: "Jeanne", lastName: "Ngono", birthDate: new Date("2015-01-01"), phone }, existing), ["phone"], "family member? flagged for review");
  assert.deepEqual(duplicateReasons({ firstName: "Jean", lastName: "Atangana", birthDate: new Date("2015-01-01"), phone }, existing), [], "shared phone of another family");
});
