// Tests d'intégration de bout en bout MedCare → DHIS2, contre une VRAIE instance DHIS2 locale
// (dhis2-local/) et une base MedCare jetable. Ils ne sont pas lancés par `npm test` : voir
// `npm run test:dhis2-e2e` et dhis2-local/README.md.
//
// Principe : chaque test prépare des données FICTIVES dans la base jetable, appelle le code réel
// de MedCare (config, proposition de correspondances, envoi, envoi automatique, journal), puis
// RELIT DHIS2 avec un compte administrateur indépendant pour vérifier ce qui y est réellement
// enregistré. Un code HTTP 200 n'est jamais considéré comme une preuve.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// ── Garde-fous : ne jamais écrire dans la base réelle ni dans le DHIS2 national ─────────────
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name} (utilisez dhis2-local/scripts/run-e2e.mjs)`);
  return value;
}
const isLoopback = (host: string) => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
const dbHost = new URL(requireEnv("DATABASE_URL")).hostname;
const dhisBase = requireEnv("DHIS2_E2E_BASE_URL").replace(/\/+$/, "");
if (!isLoopback(dbHost)) throw new Error(`Refus : DATABASE_URL (${dbHost}) n'est pas une base locale jetable.`);
if (!isLoopback(new URL(dhisBase).hostname)) throw new Error(`Refus : DHIS2_E2E_BASE_URL (${dhisBase}) n'est pas une instance locale.`);
process.env.NEXTAUTH_SECRET ??= randomUUID() + randomUUID();

const ADMIN_USER = process.env.DHIS2_E2E_ADMIN_USER ?? "admin";
const ADMIN_PASSWORD = requireEnv("DHIS2_E2E_ADMIN_PASSWORD");
const API_USER = requireEnv("DHIS2_E2E_API_USER");
const API_PASSWORD = requireEnv("DHIS2_E2E_API_PASSWORD");
const MAPPING_CSV = requireEnv("DHIS2_E2E_MAPPING_CSV");
const ids = JSON.parse(readFileSync(requireEnv("DHIS2_E2E_IDS_FILE"), "utf8")) as {
  dataSetId: string;
  facilities: Record<string, { id: string; name: string; inDataSet: boolean; inScope: boolean }>;
};
const facility = (prefix: string) => {
  const f = Object.values(ids.facilities).find((x) => x.name.startsWith(prefix));
  if (!f) throw new Error(`Formation de démo introuvable : ${prefix}`);
  return f.id;
};
const MENDONG = facility("CSI de Mendong");
const BONABERI = facility("CSI de Bonabéri");
const NOT_IN_DATASET = facility("CSI Hors-jeu");
const OUT_OF_SCOPE = facility("CSI Hors-périmètre");
const TAMDJA = facility("CMA de Tamdja");

// ── Accès DHIS2 indépendant (vérification) ─────────────────────────────────────────────────
async function dhis(method: string, path: string, body?: unknown, user = ADMIN_USER, password = ADMIN_PASSWORD) {
  const res = await fetch(dhisBase + path, {
    method,
    headers: { Authorization: "Basic " + Buffer.from(`${user}:${password}`).toString("base64"), Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  return { status: res.status, json: text ? (JSON.parse(text) as any) : null };
}

// Valeurs réellement stockées dans DHIS2 pour (formation, mois), sous la forme "CODE|combinaison" → valeur.
let elementCode = new Map<string, string>();
let comboName = new Map<string, string>();
async function loadMetadataNames() {
  const de = await dhis("GET", "/api/dataElements?fields=id,code&paging=false");
  elementCode = new Map(de.json.dataElements.map((d: any) => [d.id, d.code]));
  const coc = await dhis("GET", "/api/categoryOptionCombos?fields=id,name&paging=false");
  comboName = new Map(coc.json.categoryOptionCombos.map((c: any) => [c.id, c.name]));
}
async function stored(orgUnit: string, period: string): Promise<Map<string, string>> {
  const r = await dhis("GET", `/api/dataValueSets.json?dataSet=${ids.dataSetId}&orgUnit=${orgUnit}&period=${period}`);
  assert.equal(r.status, 200);
  const out = new Map<string, string>();
  for (const v of r.json?.dataValues ?? []) out.set(`${elementCode.get(v.dataElement) ?? v.dataElement}|${comboName.get(v.categoryOptionCombo) ?? v.categoryOptionCombo}`, v.value);
  return out;
}

// ── Jeu de données fictif du formulaire mensuel (agrégats, aucune donnée patient) ───────────
interface Cell { code: string; key: string; value: number; dhisElement: string; dhisCombo: string }
const cell = (code: string, key: string, value: number, dhisCombo: string): Cell => ({ code, key, value, dhisElement: `RMA3-${code}`, dhisCombo });
const FIXTURE: Cell[] = [
  cell("II.1.5-005", "", 12, "default"),
  cell("III.4-007", "", 4, "default"),
  cell("II.1.2-002", "age10to14", 1, "10-14 ans"),
  cell("II.1.2-002", "age15to19", 6, "15-19 ans"),
  cell("II.1.2-002", "age20plus", 14, "> 19 ans"),
  cell("II.1.4-002", "M", 9, "M"),
  cell("II.1.4-002", "F", 11, "F"),
  cell("III.1-003", "planned", 5, "Planifiées"),
  cell("III.1-003", "held", 4, "Réalisées"),
  cell("IV.2.1-003", "rank1", 20, "TPI1"),
  cell("IV.2.1-003", "rank2", 15, "TPI2"),
  cell("IV.2.1-003", "rank3", 10, "TPI3"),
  cell("IV.2.1-003", "rank4plus", 2, "TPI4+"),
  cell("III.8-004", "age10to14_M", 3, "10-14 ans M"),
  cell("III.8-004", "age10to14_F", 2, "10-14 ans F"),
];
const expectedStored = (cells: readonly Cell[]) => new Map(cells.map((c) => [`${c.dhisElement}|${c.dhisCombo}`, String(c.value)]));

// ── Accès MedCare (importés après la définition de l'environnement) ─────────────────────────
type Prisma = typeof import("@/lib/prisma").default;
let prisma: Prisma;
let sync: typeof import("@/lib/dhis2/rma3-sync");
let auto: typeof import("@/lib/dhis2/sync");
let config: typeof import("@/lib/dhis2/config");
let crypto: typeof import("@/lib/dhis2/crypto");
let client: typeof import("@/lib/dhis2/client");
const cleanup: { orgUnit: string; period: string }[] = [];
const USER_ID = randomUUID();

async function newTenant() {
  const tenant = await prisma.tenant.create({ data: { slug: `e2e-${randomUUID().slice(0, 8)}`, name: "Formation fictive e2e", type: "clinic", dbSchema: `e2e_${randomUUID().slice(0, 8)}` } });
  return tenant.id;
}
async function seedPeriod(tenantId: string, period: string, cells: readonly Pick<Cell, "code" | "key" | "value">[], status: "draft" | "validated" = "validated") {
  const row = await prisma.rma3ManualPeriod.create({ data: { tenantId, period, status, validatedAt: status === "validated" ? new Date() : null } });
  for (const c of cells) await prisma.rma3ManualValue.create({ data: { tenantId, periodId: row.id, indicatorCode: c.code, breakdownKey: c.key, value: c.value, updatedById: USER_ID } });
}
async function setConfig(tenantId: string, orgUnitId: string, over: { password?: string; baseUrl?: string; username?: string; enabled?: boolean } = {}) {
  await config.saveDhis2Config(tenantId, {
    baseUrl: over.baseUrl ?? dhisBase,
    username: over.username ?? API_USER,
    encryptedPassword: crypto.encryptSecret(over.password ?? API_PASSWORD),
    orgUnitId,
    dataSetId: ids.dataSetId,
    enabled: over.enabled ?? false,
  });
}
// Le flux réel de l'administrateur : « Proposer depuis DHIS2 » puis application des propositions.
async function proposeAndApply(tenantId: string, period: string) {
  const proposed = await sync.proposeRma3Mappings(tenantId, period);
  // Tests ciblés : seules les cellules du formulaire mensuel sont reliées (le RMA3 complet a son propre test).
  const manual = proposed.proposals.filter((p) => p.tableKey.startsWith("manual:"));
  await sync.saveRma3Mappings(tenantId, USER_ID, manual, "dhis2");
  return { ...proposed, proposals: manual };
}
async function audit(tenantId: string) {
  return prisma.auditLog.findMany({ where: { tenantId, action: "dhis2.rma3_push" }, orderBy: { createdAt: "asc" } });
}
const track = (orgUnit: string, period: string) => cleanup.push({ orgUnit, period });

before(async () => {
  prisma = (await import("@/lib/prisma")).default;
  sync = await import("@/lib/dhis2/rma3-sync");
  auto = await import("@/lib/dhis2/sync");
  config = await import("@/lib/dhis2/config");
  crypto = await import("@/lib/dhis2/crypto");
  client = await import("@/lib/dhis2/client");
  await loadMetadataNames();
});

after(async () => {
  // Retire de DHIS2 ce que les tests y ont écrit (stratégie DELETE officielle), puis ferme la base.
  for (const { orgUnit, period } of cleanup) {
    const values = (await dhis("GET", `/api/dataValueSets.json?dataSet=${ids.dataSetId}&orgUnit=${orgUnit}&period=${period}`)).json?.dataValues ?? [];
    if (values.length) await dhis("POST", "/api/dataValueSets?importStrategy=DELETE", { dataSet: ids.dataSetId, orgUnit, period, dataValues: values.map((v: any) => ({ dataElement: v.dataElement, categoryOptionCombo: v.categoryOptionCombo, value: v.value })) });
  }
  await prisma.$disconnect();
});

const TOO_BIG = 99_999_999_999_999;

describe("DHIS2 réel — prérequis", () => {
  test("l'instance répond et le compte technique MedCare est reconnu", async () => {
    const me = await dhis("GET", "/api/me?fields=username,authorities", undefined, API_USER, API_PASSWORD);
    assert.equal(me.status, 200);
    assert.equal(me.json.username, API_USER);
    assert.ok(!me.json.authorities.includes("ALL"), "le compte technique ne doit pas être super-administrateur");
    const test = await client.testConnection({ baseUrl: dhisBase, username: API_USER, password: API_PASSWORD });
    assert.equal(test.ok, true);
  });
});

describe("Scénario de bout en bout : succès, idempotence, mise à jour", () => {
  const period = "202601";
  let tenantId: string;
  before(async () => {
    tenantId = await newTenant();
    track(MENDONG, period);
    await seedPeriod(tenantId, period, FIXTURE);
    await setConfig(tenantId, MENDONG);
  });

  test("la proposition de correspondances depuis DHIS2 couvre exactement les 15 cellules saisies", async () => {
    const proposed = await proposeAndApply(tenantId, period);
    assert.equal(proposed.proposals.length, FIXTURE.length);
  });

  test("simulation : DHIS2 valide et compte, mais n'enregistre rien", async () => {
    const result = await sync.pushRma3(tenantId, period, { dryRun: true });
    assert.equal(result.ok, true);
    assert.equal(result.sent, FIXTURE.length);
    assert.equal(result.importCount.imported, FIXTURE.length);
    assert.equal((await stored(MENDONG, period)).size, 0, "une simulation ne doit rien écrire dans DHIS2");
  });

  test("envoi réel : les 15 valeurs sont enregistrées dans DHIS2, dans les bonnes cellules", async () => {
    const result = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.partial, false);
    assert.equal(result.importCount.imported, FIXTURE.length);
    assert.deepEqual(await stored(MENDONG, period), expectedStored(FIXTURE));
  });

  test("renvoi à l'identique : idempotent, aucun doublon, rien de modifié", async () => {
    const before = await stored(MENDONG, period);
    const result = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(result.ok, true);
    assert.equal(result.importCount.imported, 0);
    assert.equal(result.importCount.updated, 0);
    assert.equal(result.importCount.ignored, FIXTURE.length);
    assert.deepEqual(await stored(MENDONG, period), before);
  });

  test("valeur corrigée puis renvoyée : une seule valeur mise à jour dans DHIS2", async () => {
    await prisma.rma3ManualValue.updateMany({ where: { tenantId, indicatorCode: "II.1.4-002", breakdownKey: "F" }, data: { value: 13 } });
    const result = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(result.ok, true);
    assert.equal(result.importCount.updated, 1);
    const expected = expectedStored(FIXTURE);
    expected.set("RMA3-II.1.4-002|F", "13");
    assert.deepEqual(await stored(MENDONG, period), expected);
  });

  test("un mois non validé ne peut pas être envoyé pour de vrai (409) et DHIS2 n'est pas touché", async () => {
    const draft = "202602";
    track(MENDONG, draft);
    await seedPeriod(tenantId, draft, FIXTURE.slice(0, 2), "draft");
    await proposeAndApply(tenantId, draft);
    await assert.rejects(sync.pushRma3(tenantId, draft, { dryRun: false }), (e: any) => e.code === "rma3_period_not_validated" && e.status === 409);
    assert.equal((await stored(MENDONG, draft)).size, 0);
  });

  test("période invalide refusée avant tout appel à DHIS2", () => {
    assert.throws(() => sync.assertPeriod("202613"), (e: any) => e.code === "invalid_period");
    assert.throws(() => sync.assertPeriod("2026"), (e: any) => e.code === "invalid_period");
  });
});

describe("Erreurs et données invalides", () => {
  test("authentification incorrecte : échec explicite (401), rien d'enregistré", async () => {
    const tenantId = await newTenant();
    const period = "202603";
    track(MENDONG, period);
    await seedPeriod(tenantId, period, FIXTURE.slice(0, 3));
    await setConfig(tenantId, MENDONG);
    await proposeAndApply(tenantId, period);
    await setConfig(tenantId, MENDONG, { password: "Mauvais-mot-de-passe-1!" });
    const result = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /401|Unauthorized/i);
    assert.equal((await stored(MENDONG, period)).size, 0);
  });

  test("DHIS2 indisponible : échec propre (pas d'exception), puis nouvelle tentative réussie", async () => {
    const tenantId = await newTenant();
    const period = "202604";
    track(MENDONG, period);
    const cells = FIXTURE.slice(0, 5);
    await seedPeriod(tenantId, period, cells);
    await setConfig(tenantId, MENDONG);
    await proposeAndApply(tenantId, period);

    await setConfig(tenantId, MENDONG, { baseUrl: "http://127.0.0.1:9" }); // port fermé
    const down = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(down.ok, false);
    assert.ok(down.error && down.error.length > 0);
    assert.equal(down.importCount.imported, 0);
    assert.equal((await stored(MENDONG, period)).size, 0);

    await setConfig(tenantId, MENDONG); // DHIS2 « revient »
    const retry = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(retry.ok, true, retry.error);
    assert.deepEqual(await stored(MENDONG, period), expectedStored(cells));
  });

  test("élément de données inexistant dans DHIS2 : rejeté avec un code d'erreur lisible", async () => {
    const tenantId = await newTenant();
    const period = "202605";
    track(MENDONG, period);
    await seedPeriod(tenantId, period, [FIXTURE[0]]);
    await setConfig(tenantId, MENDONG);
    await sync.saveRma3Mappings(tenantId, USER_ID, [{ indicatorCode: "RMA3-II.1.5-005", tableKey: "manual:II.1.5", cellKey: "", dataElementId: "AbCdEfGhIjK", categoryOptionComboId: null }], "manual");
    const result = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(result.ok, false);
    assert.equal(result.partial, false);
    assert.match(result.error ?? "", /E7610/);
    assert.equal(result.importCount.ignored, 1);
    assert.equal((await stored(MENDONG, period)).size, 0);
  });

  test("élément de données existant mais hors du jeu de données : rejeté, pas stocké en silence", async () => {
    const outside = "TestOutDe01";
    const def = (await dhis("GET", "/api/categoryCombos?filter=name:eq:default&fields=id")).json.categoryCombos[0].id;
    const created = await dhis("POST", "/api/metadata", { dataElements: [{ id: outside, name: "E2E hors jeu de données", shortName: "E2E hors jeu", code: "E2E-OUT", valueType: "INTEGER_ZERO_OR_POSITIVE", aggregationType: "SUM", domainType: "AGGREGATE", categoryCombo: { id: def } }] });
    assert.equal(created.status, 200);
    try {
      const tenantId = await newTenant();
      const period = "202605";
      track(MENDONG, period);
      await seedPeriod(tenantId, period, [FIXTURE[0]]);
      await setConfig(tenantId, MENDONG);
      await sync.saveRma3Mappings(tenantId, USER_ID, [{ indicatorCode: "RMA3-II.1.5-005", tableKey: "manual:II.1.5", cellKey: "", dataElementId: outside, categoryOptionComboId: null }], "manual");
      const result = await sync.pushRma3(tenantId, period, { dryRun: false });
      assert.equal(result.ok, false);
      assert.match(result.error ?? "", /E7633|E7632/); // hors jeu de données (E7633) ou période sans type pour cet élément (E7632)
      assert.equal((await stored(MENDONG, period)).size, 0);
    } finally {
      await dhis("DELETE", `/api/dataElements/${outside}`);
    }
  });

  test("élément ventilé envoyé sans combinaison de catégories : rejeté (E7634), rien dans la cellule « default »", async () => {
    const tenantId = await newTenant();
    const period = "202606";
    track(MENDONG, period);
    await seedPeriod(tenantId, period, [{ code: "II.1.4-002", key: "M", value: 9 }]);
    await setConfig(tenantId, MENDONG);
    const deId = (await dhis("GET", "/api/dataElements?filter=code:eq:RMA3-II.1.4-002&fields=id")).json.dataElements[0].id;
    await sync.saveRma3Mappings(tenantId, USER_ID, [{ indicatorCode: "RMA3-II.1.4-002", tableKey: "manual:II.1.4", cellKey: "M", dataElementId: deId, categoryOptionComboId: null }], "manual");
    const result = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /E7634/);
    assert.equal((await stored(MENDONG, period)).size, 0, "la valeur ne doit pas atterrir dans la cellule default");
  });

  // MedCare interdit déjà les valeurs négatives (contrainte SQL) ; une valeur hors des bornes d'un
  // entier DHIS2 passe la base de MedCare mais pas la validation DHIS2.

  test("valeur invalide pour DHIS2 (hors bornes d'un entier) : rejetée (E7619) et signalée", async () => {
    const tenantId = await newTenant();
    const period = "202607";
    track(MENDONG, period);
    await seedPeriod(tenantId, period, [{ code: "III.4-007", key: "", value: TOO_BIG }]);
    await setConfig(tenantId, MENDONG);
    await proposeAndApply(tenantId, period);
    const result = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /E7619/);
    assert.equal((await stored(MENDONG, period)).size, 0);
  });

  for (const [label, orgUnit, code] of [
    ["unité d'organisation inexistante", "AbCdEfGhIjK", /E7603/],
    ["unité d'organisation non rattachée au jeu de données", NOT_IN_DATASET, /E7636/],
    ["unité d'organisation hors du périmètre du compte technique", OUT_OF_SCOPE, /E7617/],
  ] as const) {
    test(`${label} : rejeté, rien d'enregistré`, async () => {
      const tenantId = await newTenant();
      const period = "202608";
      track(orgUnit, period);
      await seedPeriod(tenantId, period, [FIXTURE[0]]);
      await setConfig(tenantId, MENDONG);
      await proposeAndApply(tenantId, period);
      await setConfig(tenantId, orgUnit);
      const result = await sync.pushRma3(tenantId, period, { dryRun: false });
      assert.equal(result.ok, false);
      assert.match(result.error ?? "", code);
      if (orgUnit !== "AbCdEfGhIjK") assert.equal((await stored(orgUnit, period)).size, 0);
    });
  }

  test("période non mensuelle envoyée au niveau du client : rejetée par DHIS2 (strictPeriods)", async () => {
    const de = (await dhis("GET", "/api/dataElements?filter=code:eq:RMA3-II.1.5-005&fields=id")).json.dataElements[0].id;
    const result = await client.submitDataValueSet({ baseUrl: dhisBase, username: API_USER, password: API_PASSWORD }, { dataSetId: ids.dataSetId, orgUnitId: MENDONG, period: "2026", dataValues: [{ dataElement: de, value: "1" }] });
    assert.equal(result.ok, false);
    assert.equal(result.importCount?.imported, 0);
  });
});

describe("Import partiellement réussi et nouvelle tentative", () => {
  test("une cellule invalide n'empêche pas les autres d'être stockées, l'envoi est marqué partiel puis corrigé au renvoi", async () => {
    const tenantId = await newTenant();
    const period = "202609";
    track(MENDONG, period);
    const cells = FIXTURE.slice(5, 9); // M, F, planned, held
    await seedPeriod(tenantId, period, cells);
    await setConfig(tenantId, MENDONG);
    await proposeAndApply(tenantId, period);
    // Une cellule devient invalide pour DHIS2 entre deux envois.
    await prisma.rma3ManualValue.updateMany({ where: { tenantId, indicatorCode: "III.1-003", breakdownKey: "held" }, data: { value: TOO_BIG } });

    const first = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(first.ok, false);
    assert.equal(first.partial, true, "DHIS2 a stocké 3 valeurs sur 4 : envoi partiel");
    assert.equal(first.importCount.imported, 3);
    assert.equal(first.importCount.ignored, 1);
    assert.match(first.error ?? "", /E7619/);
    assert.deepEqual(await stored(MENDONG, period), expectedStored(cells.filter((c) => c.key !== "held")));

    // Correction puis nouvelle tentative : seule la cellule manquante est ajoutée (pas de doublon).
    await prisma.rma3ManualValue.updateMany({ where: { tenantId, indicatorCode: "III.1-003", breakdownKey: "held" }, data: { value: 4 } });
    const retry = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(retry.ok, true, retry.error);
    assert.equal(retry.importCount.imported, 1);
    assert.equal(retry.importCount.ignored, 3);
    assert.deepEqual(await stored(MENDONG, period), expectedStored(cells));
  });
});

describe("Envoi automatique (cron) et journal", () => {
  test("échec puis nouvelle tentative le lendemain ; un mois envoyé n'est pas renvoyé ; le journal trace chaque tentative", async () => {
    const tenantId = await newTenant();
    const period = "202610";
    track(BONABERI, period);
    const cells = FIXTURE.slice(0, 4);
    await seedPeriod(tenantId, period, cells);
    await setConfig(tenantId, BONABERI, { enabled: true });
    await proposeAndApply(tenantId, period);

    const day1 = new Date();
    await setConfig(tenantId, BONABERI, { enabled: true, password: "Mauvais-mot-de-passe-1!" });
    const run1 = await auto.runRma3AutoSend(tenantId, day1);
    assert.equal(run1.length, 1);
    assert.equal(run1[0].ok, false);
    assert.equal((await stored(BONABERI, period)).size, 0);

    // Même jour : pas de martèlement de DHIS2.
    assert.equal((await auto.runRma3AutoSend(tenantId, new Date(day1.getTime() + 60 * 60 * 1000))).length, 0, "pas de nouvelle tentative une heure après l'échec");

    // Le lendemain, identifiants corrigés : l'échec est retenté.
    await setConfig(tenantId, BONABERI, { enabled: true });
    const day2 = new Date(day1.getTime() + 24 * 60 * 60 * 1000);
    const run2 = await auto.runRma3AutoSend(tenantId, day2);
    assert.equal(run2.length, 1, "l'envoi échoué doit être retenté au passage suivant");
    assert.equal(run2[0].ok, true);
    assert.deepEqual(await stored(BONABERI, period), expectedStored(cells));

    // Mois envoyé avec succès : plus jamais renvoyé automatiquement.
    assert.equal((await auto.runRma3AutoSend(tenantId, new Date(day2.getTime() + 24 * 60 * 60 * 1000))).length, 0);

    const log = await audit(tenantId);
    assert.deepEqual(log.map((l) => (l.payload as any).ok), [false, true]);
    assert.ok(log.every((l) => (l.payload as any).trigger === "auto" && l.actorType === "system"));
    assert.equal(JSON.stringify(log).includes(API_PASSWORD), false, "le journal ne doit contenir aucun secret");
  });
});

describe("RMA3 COMPLET : toutes les cellules que MedCare peut produire", () => {
  test("toutes les cellules sont reliées, envoyées, acceptées et stockées à la bonne place dans DHIS2", async () => {
    const period = "202601";
    const tenantId = await newTenant();
    track(TAMDJA, period);

    // Formulaire mensuel intégralement rempli (valeurs distinctes de 0), tables calculées à 0.
    const { RMA3_MANUAL_SECTIONS, BREAKDOWN_COLUMNS } = await import("@/lib/rma3-manual/catalog");
    const periodRow = await prisma.rma3ManualPeriod.create({ data: { tenantId, period, status: "validated", validatedAt: new Date() } });
    let n = 0;
    for (const section of RMA3_MANUAL_SECTIONS)
      for (const indicator of section.indicators)
        for (const column of BREAKDOWN_COLUMNS[indicator.breakdown])
          await prisma.rma3ManualValue.create({ data: { tenantId, periodId: periodRow.id, indicatorCode: indicator.code, breakdownKey: column.key, value: (n++ % 97) + 1, updatedById: USER_ID } });
    await setConfig(tenantId, TAMDJA);

    // Correspondances : le CSV généré depuis DHIS2 (scripts/build-mapping.mjs), importé comme par l'interface.
    const exported = await sync.buildRma3Export(tenantId, period);
    const parsed = (await import("@/lib/dhis2/rma3-export")).parseMappingCsv(readFileSync(MAPPING_CSV, "utf8"), exported.values);
    assert.deepEqual(parsed.errors, []);
    await sync.saveRma3Mappings(tenantId, USER_ID, parsed.mappings, "csv");

    const built = await sync.buildRma3Export(tenantId, period);
    const total = built.values.length;
    assert.ok(total >= 4000, `le RMA3 doit produire plus de 4000 cellules (${total})`);
    assert.equal(built.unmapped.length, 0, "aucune cellule non reliée");
    assert.equal(built.collisions.length, 0, "aucune collision de cible");
    assert.equal(built.dataValues.length, total);

    const dry = await sync.pushRma3(tenantId, period, { dryRun: true });
    assert.equal(dry.ok, true, dry.error);
    assert.equal(dry.importCount.imported, total);
    assert.equal((await stored(TAMDJA, period)).size, 0);

    const result = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(result.ok, true, result.error);
    assert.equal(result.partial, false);
    assert.equal(result.sent, total);
    assert.equal(result.importCount.imported, total);
    assert.equal(result.importCount.ignored, 0);

    // Relecture indépendante : chaque cellule, avec sa valeur, à son (élément, combinaison).
    const read = await dhis("GET", `/api/dataValueSets.json?dataSet=${ids.dataSetId}&orgUnit=${TAMDJA}&period=${period}`);
    const actual = new Map<string, string>(read.json.dataValues.map((v: any) => [`${v.dataElement}|${v.categoryOptionCombo}`, v.value]));
    assert.equal(actual.size, total, "DHIS2 doit contenir exactement une valeur par cellule");
    const defaultCombo = (await dhis("GET", "/api/categoryOptionCombos?filter=name:eq:default&fields=id")).json.categoryOptionCombos[0].id;
    const byCell = new Map(parsed.mappings.map((m) => [`${m.indicatorCode}|${m.tableKey}|${m.cellKey}`, m]));
    let wrong = 0;
    for (const v of built.values) {
      const m = byCell.get(`${v.indicatorCode}|${v.tableKey}|${v.cellKey}`)!;
      if (actual.get(`${m.dataElementId}|${m.categoryOptionComboId ?? defaultCombo}`) !== String(v.value)) wrong++;
    }
    assert.equal(wrong, 0, `${wrong} cellule(s) stockée(s) avec une valeur ou une place incorrecte`);

    // Renvoi : idempotent sur 4 000+ valeurs.
    const again = await sync.pushRma3(tenantId, period, { dryRun: false });
    assert.equal(again.ok, true);
    assert.equal(again.importCount.imported + again.importCount.updated, 0);
    assert.equal(again.importCount.ignored, total);
  });
});
