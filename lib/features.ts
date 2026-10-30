// Deployment switches read from the environment at run time (not NEXT_PUBLIC_*: those are frozen
// into the build, and an on-premise Docker image is configured after it is built). Unit-tested
// in features.test.ts.

// "true" / "1" / "yes" / "on" → true, "false" / "0" / "no" / "off" → false, anything else → the default.
export function readBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  const v = value?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return defaultValue;
}

// Settings → Integrations → Mobile Money. Shown unless MOBILE_MONEY_SETTINGS_ENABLED says
// otherwise (existing installations keep it). Hiding it closes the settings routes too; the
// payments already configured keep working.
export function isMobileMoneySettingsEnabled(): boolean {
  return readBooleanEnv(process.env.MOBILE_MONEY_SETTINGS_ENABLED, true);
}

// What the browser may know about these switches.
export function clientFeatures() {
  return { mobileMoneySettings: isMobileMoneySettingsEnabled() };
}
