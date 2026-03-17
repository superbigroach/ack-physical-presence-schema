import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { v4 as uuidv4 } from "uuid";

// Enable synchronous Ed25519 operations
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

// --- Types ---

export interface ActivityMetrics {
  stepCount?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  caloriesBurned?: number;
  [key: string]: number | undefined;
}

export interface ActivityLocation {
  geohash: string;
  precision: "exact" | "street" | "neighborhood" | "city" | "region";
  method: string;
}

export interface ActivityValidation {
  method: string;
  sources: string[];
  // Validation implementation is application-specific. This function accepts
  // pre-computed validation results. The confidenceScore is determined by the
  // issuer's own validation pipeline — this schema does not define how it is
  // calculated.
  confidenceScore: number;
}

export interface CampaignInfo {
  id: string;
  sponsor: string;
}

export interface DeviceInfo {
  attestation: string;
  type: string;
}

export interface ActivityData {
  subjectDid: string;
  activityType: string;
  metrics: ActivityMetrics;
  location: ActivityLocation;
  validation: ActivityValidation;
  campaign?: CampaignInfo;
  device?: DeviceInfo;
}

export interface IssuerKey {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  issuerDid: string;
  keyId: string;
}

export interface PhysicalPresenceCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate: string;
  credentialSubject: {
    id: string;
    activityType: string;
    metrics: ActivityMetrics;
    location: ActivityLocation;
    validation: ActivityValidation;
    campaign?: CampaignInfo;
    device?: DeviceInfo;
  };
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
  };
}

// --- Key Generation ---

export function generateIssuerKey(issuerDid: string, keyId: string = "key-1"): IssuerKey {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return { privateKey, publicKey, issuerDid, keyId };
}

// --- Credential Issuance ---

/**
 * Issues a PhysicalPresenceCredential as a W3C Verifiable Credential.
 *
 * This function creates and signs a credential attesting that a physical
 * activity occurred. It does NOT perform validation of the activity data.
 *
 * Validation implementation is application-specific. This function accepts
 * pre-computed validation results. The confidenceScore, validation method,
 * and validation sources are provided by the caller — this function simply
 * packages them into a signed credential.
 *
 * @param activity - The activity data including pre-computed validation results
 * @param issuerKey - The issuer's Ed25519 signing key
 * @param expiresInDays - Number of days until the credential expires (default: 30)
 * @returns A signed PhysicalPresenceCredential
 */
export function issueCredential(
  activity: ActivityData,
  issuerKey: IssuerKey,
  expiresInDays: number = 30
): PhysicalPresenceCredential {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + expiresInDays);

  const credential: PhysicalPresenceCredential = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://ack-protocol.github.io/ack-physical-presence-schema/v1",
    ],
    id: `urn:uuid:${uuidv4()}`,
    type: ["VerifiableCredential", "PhysicalPresenceCredential"],
    issuer: issuerKey.issuerDid,
    issuanceDate: now.toISOString(),
    expirationDate: expiry.toISOString(),
    credentialSubject: {
      id: activity.subjectDid,
      activityType: activity.activityType,
      metrics: activity.metrics,
      location: activity.location,
      validation: activity.validation,
    },
    proof: {
      type: "Ed25519Signature2020",
      created: now.toISOString(),
      verificationMethod: `${issuerKey.issuerDid}#${issuerKey.keyId}`,
      proofPurpose: "assertionMethod",
      proofValue: "", // will be filled below
    },
  };

  // Attach optional fields
  if (activity.campaign) {
    credential.credentialSubject.campaign = activity.campaign;
  }
  if (activity.device) {
    credential.credentialSubject.device = activity.device;
  }

  // Sign the credential (proof.proofValue is excluded from the signed payload)
  const payloadToSign = { ...credential, proof: { ...credential.proof, proofValue: undefined } };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadToSign));
  const signature = ed.sign(payloadBytes, issuerKey.privateKey);
  credential.proof.proofValue = Buffer.from(signature).toString("base64url");

  return credential;
}
