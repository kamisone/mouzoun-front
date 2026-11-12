/**
 * WebAuthn helpers: JSON options from the API ⇄ browser credentials. Uses the native
 * `parse…FromJSON` / `toJSON` when present, a small fallback otherwise.
 */

export function b64urlToBuffer(value: string): ArrayBuffer {
  const pad = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes.buffer
}

export function bufferToB64url(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

type Pkc = typeof PublicKeyCredential & {
  parseCreationOptionsFromJSON?: (o: PublicKeyCredentialCreationOptionsJSON) => PublicKeyCredentialCreationOptions
  parseRequestOptionsFromJSON?: (o: PublicKeyCredentialRequestOptionsJSON) => PublicKeyCredentialRequestOptions
}

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!navigator.credentials
}

/** Passkeys offered by the browser's autofill on the email field ("conditional UI"). */
export async function conditionalSupported(): Promise<boolean> {
  if (!passkeysSupported()) return false
  const pkc = PublicKeyCredential as typeof PublicKeyCredential & { isConditionalMediationAvailable?: () => Promise<boolean> }
  return (await pkc.isConditionalMediationAvailable?.().catch(() => false)) ?? false
}

function creationOptions(json: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
  const pkc = PublicKeyCredential as Pkc
  if (pkc.parseCreationOptionsFromJSON) return pkc.parseCreationOptionsFromJSON(json)
  return {
    ...json,
    challenge: b64urlToBuffer(json.challenge),
    user: { ...json.user, id: b64urlToBuffer(json.user.id) },
    excludeCredentials: json.excludeCredentials?.map(c => ({ ...c, id: b64urlToBuffer(c.id) })) as PublicKeyCredentialDescriptor[],
  } as PublicKeyCredentialCreationOptions
}

function requestOptions(json: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
  const pkc = PublicKeyCredential as Pkc
  if (pkc.parseRequestOptionsFromJSON) return pkc.parseRequestOptionsFromJSON(json)
  return {
    ...json,
    challenge: b64urlToBuffer(json.challenge),
    allowCredentials: json.allowCredentials?.map(c => ({ ...c, id: b64urlToBuffer(c.id) })) as PublicKeyCredentialDescriptor[],
  } as PublicKeyCredentialRequestOptions
}

function toJSON(credential: PublicKeyCredential): unknown {
  const c = credential as PublicKeyCredential & { toJSON?: () => unknown }
  if (typeof c.toJSON === 'function') return c.toJSON()
  const r = credential.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse
  const response: Record<string, unknown> = { clientDataJSON: bufferToB64url(r.clientDataJSON) }
  if ('getPublicKey' in r && typeof r.getPublicKey === 'function') {
    const key = r.getPublicKey()
    response.authenticatorData = bufferToB64url(r.getAuthenticatorData())
    response.publicKey = key ? bufferToB64url(key) : null
    response.publicKeyAlgorithm = r.getPublicKeyAlgorithm()
    response.transports = r.getTransports?.() ?? []
  }
  else {
    response.authenticatorData = bufferToB64url(r.authenticatorData)
    response.signature = bufferToB64url(r.signature)
    if (r.userHandle) response.userHandle = bufferToB64url(r.userHandle)
  }
  return { id: credential.id, rawId: bufferToB64url(credential.rawId), type: credential.type, response }
}

export async function createPasskey(json: PublicKeyCredentialCreationOptionsJSON): Promise<unknown> {
  const credential = await navigator.credentials.create({ publicKey: creationOptions(json) })
  if (!credential) throw new Error('cancelled')
  return toJSON(credential as PublicKeyCredential)
}

export async function getPasskey(
  json: PublicKeyCredentialRequestOptionsJSON,
  opts: { conditional?: boolean, signal?: AbortSignal } = {},
): Promise<unknown> {
  const credential = await navigator.credentials.get({
    publicKey: requestOptions(json),
    mediation: opts.conditional ? 'conditional' as CredentialMediationRequirement : undefined,
    signal: opts.signal,
  })
  if (!credential) throw new Error('cancelled')
  return toJSON(credential as PublicKeyCredential)
}
