import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import type { PhysicalPresenceCredential } from "./issue-credential";

// Enable synchronous Ed25519 operations
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// --- Types ---

export interface VerificationResult {
  valid: boolean;
  checks: {
    signature: boolean;
    schema: boolean;
    expiry: boolean;
  };
  errors: string[];
}

// --- Schema Validation ---

const REQUIRED_CONTEXT = "https://www.w3.org/2018/credentials/v1";
const REQUIRED_TYPE = "PhysicalPresenceCredential";
const REQUIRED_VC_TYPE = "VerifiableCredential";

function validateSchema(credential: PhysicalPresenceCredential): string[] {
  const errors: string[] = [];

  // Check @context
  if (!credential["@context"] || !Array.isArray(credential["@context"])) {
    errors.push("Missing or invalid @context");
  } else if (!credential["@context"].includes(REQUIRED_CONTEXT)) {
    errors.push(`@context must include "${REQUIRED_CONTEXT}"`);
  }

  // Check type
  if (!credential.type || !Array.isArray(credential.type)) {
    errors.push("Missing or invalid type");
  } else {
    if (!credential.type.includes(REQUIRED_VC_TYPE)) {
      errors.push(`type must include "${REQUIRED_VC_TYPE}"`);
    }
    if (!credential.type.includes(REQUIRED_TYPE)) {
      errors.push(`type must include "${REQUIRED_TYPE}"`);
    }
  }

  // Check required top-level fields
  if (!credential.id) errors.push("Missing credential id");
  if (!credential.issuer) errors.push("Missing issuer");
  if (!credential.issuanceDate) errors.push("Missing issuanceDate");
  if (!credential.expirationDate) errors.push("Missing expirationDate");

  // Check credentialSubject
  const subject = credential.credentialSubject;
  if (!subject) {
    errors.push("Missing credentialSubject");
    return errors;
  }

  if (!subject.id) errors.push("Missing credentialSubject.id");
  if (!subject.activityType) errors.push("Missing credentialSubject.activityType");

  // Check metrics
  if (!subject.metrics) {
    errors.push("Missing credentialSubject.metrics");
  }

  // Check location
  if (!subject.location) {
    errors.push("Missing credentialSubject.location");
  } else {
    if (!subject.location.geohash) errors.push("Missing location.geohash");
    if (!subject.location.precision) errors.push("Missing location.precision");
    if (!subject.location.method) errors.push("Missing location.method");
  }

  // Check validation
  if (!subject.validation) {
    errors.push("Missing credentialSubject.validation");
  } else {
    if (!subject.validation.method) errors.push("Missing validation.method");
    if (!subject.validation.sources || !Array.isArray(subject.validation.sources)) {
      errors.push("Missing or invalid validation.sources");
    }
    if (typeof subject.validation.confidenceScore !== "number") {
      errors.push("Missing or invalid validation.confidenceScore");
    } else if (subject.validation.confidenceScore < 0 || subject.validation.confidenceScore > 1) {
      errors.push("validation.confidenceScore must be between 0 and 1");
    }
  }

  // Check proof
  if (!credential.proof) {
    errors.push("Missing proof");
  } else {
    if (!credential.proof.type) errors.push("Missing proof.type");
    if (!credential.proof.created) errors.push("Missing proof.created");
    if (!credential.proof.verificationMethod) errors.push("Missing proof.verificationMethod");
    if (!credential.proof.proofPurpose) errors.push("Missing proof.proofPurpose");
    if (!credential.proof.proofValue) errors.push("Missing proof.proofValue");
  }

  return errors;
}

// --- Expiry Check ---

function checkExpiry(credential: PhysicalPresenceCredential): string | null {
  const expiry = new Date(credential.expirationDate);
  if (isNaN(expiry.getTime())) {
    return "Invalid expirationDate format";
  }
  if (expiry < new Date()) {
    return `Credential expired on ${credential.expirationDate}`;
  }
  return null;
}

// --- Signature Verification ---

function verifySignature(
  credential: PhysicalPresenceCredential,
  publicKey: Uint8Array
): boolean {
  try {
    const signatureB64 = credential.proof.proofValue;
    const signature = Uint8Array.from(Buffer.from(signatureB64, "base64url"));

    // Reconstruct the payload that was signed (proof.proofValue excluded)
    const payloadToVerify = {
      ...credential,
      proof: { ...credential.proof, proofValue: undefined },
    };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadToVerify));

    return ed.verify(signature, payloadBytes, publicKey);
  } catch {
    return false;
  }
}

// --- Main Verification ---

/**
 * Verifies a PhysicalPresenceCredential:
 * 1. Schema validation — checks all required fields are present and well-formed
 * 2. Expiry check — ensures the credential has not expired
 * 3. Signature check — verifies the Ed25519 signature against the issuer's public key
 *
 * Note: This function does NOT validate the activity data itself. The
 * confidenceScore and validation fields are taken at face value — the
 * verifier trusts the issuer's validation process.
 *
 * @param credential - The credential to verify
 * @param issuerPublicKey - The issuer's Ed25519 public key
 * @returns VerificationResult with detailed check results
 */
export function verifyCredential(
  credential: PhysicalPresenceCredential,
  issuerPublicKey: Uint8Array
): VerificationResult {
  const result: VerificationResult = {
    valid: false,
    checks: {
      signature: false,
      schema: false,
      expiry: false,
    },
    errors: [],
  };

  // 1. Schema validation
  const schemaErrors = validateSchema(credential);
  result.checks.schema = schemaErrors.length === 0;
  result.errors.push(...schemaErrors);

  // 2. Expiry check
  const expiryError = checkExpiry(credential);
  result.checks.expiry = expiryError === null;
  if (expiryError) {
    result.errors.push(expiryError);
  }

  // 3. Signature verification
  if (result.checks.schema) {
    result.checks.signature = verifySignature(credential, issuerPublicKey);
    if (!result.checks.signature) {
      result.errors.push("Signature verification failed");
    }
  } else {
    result.errors.push("Skipped signature check due to schema errors");
  }

  // Overall result
  result.valid = result.checks.schema && result.checks.expiry && result.checks.signature;

  return result;
}
