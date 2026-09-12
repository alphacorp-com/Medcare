// Default public key baked into the build. Public keys aren't secret, so
// committing this is safe and avoids a "forgot to set the env var" failure
// mode at client sites — a fresh install can verify licenses out of the box.
// ONPREM_LICENSE_PUBLIC_KEY_PEM overrides it, for a future key rotation
// without needing a redeploy at every client site.
//
// Must match the private key AlphaCorp holds in LICENSE_SIGNING_PRIVATE_KEY_PEM
// (generated together by alphacorp/scripts/generate-license-keypair.ts).
const DEFAULT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAp83JAqz+ZL9tbwxjdfhumV4sllXOeQ3rVdo+OWzLi8A=
-----END PUBLIC KEY-----`;

export function getLicensePublicKeyPem(): string {
  return process.env.ONPREM_LICENSE_PUBLIC_KEY_PEM?.trim() || DEFAULT_PUBLIC_KEY_PEM;
}
