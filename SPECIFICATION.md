# PhysicalPresenceCredential Specification

**Version:** 0.1.0 (Draft)
**Status:** Proposal
**Authors:** ACK Protocol Contributors

## 1. Introduction

The PhysicalPresenceCredential is a W3C Verifiable Credential type that attests a real-world physical activity occurred at a specific location and time, validated by application-specific methods.

This specification defines the **data format** only. It does not define validation algorithms, fraud detection methods, or scoring formulas. Those are implementation details left to each issuer.

## 2. Conformance

A conforming PhysicalPresenceCredential MUST:
- Be a valid W3C Verifiable Credential per [VC Data Model 1.1](https://www.w3.org/TR/vc-data-model/)
- Include `"PhysicalPresenceCredential"` in its `type` array
- Include the PhysicalPresenceCredential JSON-LD context in its `@context` array
- Contain all required fields as defined in Section 4

## 3. Terminology

| Term | Definition |
|------|-----------|
| **Issuer** | The entity that validates the activity and issues the credential (e.g., a fitness app, a logistics platform) |
| **Subject** | The entity that performed the activity (identified by a DID) |
| **Verifier** | Any party that checks the credential's authenticity (e.g., a payment system, an insurer) |
| **Confidence Score** | An issuer-determined value between 0 and 1 indicating how confident the issuer is that the activity occurred as described. The calculation method is application-specific. |

## 4. Credential Structure

### 4.1 Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `@context` | string[] | REQUIRED | Must include `"https://www.w3.org/2018/credentials/v1"` and the PhysicalPresenceCredential context |
| `id` | string | REQUIRED | Unique credential identifier (URN or URL) |
| `type` | string[] | REQUIRED | Must include `"VerifiableCredential"` and `"PhysicalPresenceCredential"` |
| `issuer` | string | REQUIRED | DID of the issuing entity |
| `issuanceDate` | string (ISO 8601) | REQUIRED | When the credential was issued |
| `expirationDate` | string (ISO 8601) | REQUIRED | When the credential expires |
| `credentialSubject` | object | REQUIRED | The activity attestation (see 4.2) |
| `proof` | object | REQUIRED | Cryptographic proof (see 4.7) |

### 4.2 credentialSubject

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | REQUIRED | DID of the subject who performed the activity |
| `activityType` | string | REQUIRED | Type of activity (see 4.3) |
| `metrics` | object | REQUIRED | Quantitative measurements (see 4.4). At least one metric must be present. |
| `location` | object | REQUIRED | Where the activity occurred (see 4.5) |
| `validation` | object | REQUIRED | How the activity was validated (see 4.6) |
| `campaign` | object | OPTIONAL | Associated reward campaign |
| `device` | object | OPTIONAL | Device attestation information |

### 4.3 activityType

A string identifying the type of physical activity. Common values include:

| Value | Description |
|-------|-------------|
| `walking` | Walking activity |
| `running` | Running activity |
| `cycling` | Cycling activity |
| `gym-visit` | Visiting a gym or fitness facility |
| `delivery` | Delivering a package or goods |
| `store-visit` | Visiting a retail location |
| `event-attendance` | Attending an event |
| `commute` | Commuting (e.g., transit or bike) |

This list is not exhaustive. Issuers MAY use custom activity types. It is RECOMMENDED to use lowercase, hyphenated strings.

### 4.4 metrics

Quantitative measurements of the activity. At least one field must be present.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stepCount` | integer | OPTIONAL | Number of steps taken |
| `distanceMeters` | float | OPTIONAL | Distance traveled in meters |
| `durationSeconds` | integer | OPTIONAL | Duration of the activity in seconds |
| `caloriesBurned` | float | OPTIONAL | Estimated calories burned |

Issuers MAY include additional custom metric fields. Verifiers SHOULD ignore fields they do not recognize.

### 4.5 location

Approximate location where the activity occurred. Uses geohash encoding to support privacy-preserving precision levels.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `geohash` | string | REQUIRED | Geohash-encoded location |
| `precision` | string | REQUIRED | Human-readable precision level (see below) |
| `method` | string | REQUIRED | How the location was determined |

**Precision levels:**

| Value | Approx. Area | Use Case |
|-------|-------------|----------|
| `exact` | < 5m | Delivery drop-off, indoor positioning |
| `street` | ~75m | Street-level verification |
| `neighborhood` | ~600m | Neighborhood-level activity |
| `city` | ~5km | City-level presence |
| `region` | ~40km+ | Regional presence |

**Location methods** (examples, not exhaustive):

| Value | Description |
|-------|-------------|
| `device-gps` | GPS from the user's device |
| `wifi-proximity` | Wi-Fi network proximity |
| `ble-beacon` | Bluetooth Low Energy beacon |
| `nfc-tap` | NFC tag interaction |
| `cell-tower` | Cell tower triangulation |

### 4.6 validation

Describes what validation was performed and the issuer's confidence in the result. **This schema defines the fields but not how validation is implemented.**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | string | REQUIRED | High-level description of the validation approach |
| `sources` | string[] | REQUIRED | List of data sources that were consulted |
| `confidenceScore` | float | REQUIRED | Value between 0 and 1 (inclusive) representing the issuer's confidence |

**Important design notes:**

- The `confidenceScore` is **application-specific**. Different issuers will compute it differently. A score of 0.9 from one issuer is not directly comparable to 0.9 from another issuer. Verifiers should consider the issuer's reputation and methodology when interpreting scores.

- The `method` field describes **what approach** was used (e.g., `"multi-source"`, `"single-source"`, `"attestation-only"`), not the specific algorithm.

- The `sources` field lists **what data was consulted** (e.g., `["accelerometer", "gps"]`), not how that data was processed.

- This schema intentionally does NOT specify:
  - How to calculate the confidence score
  - Minimum acceptable confidence thresholds
  - How to weight different data sources
  - Anti-spoofing or fraud detection techniques
  - Sensor fusion algorithms

  These are implementation details that belong to each issuer's validation pipeline.

### 4.7 proof

Standard W3C VC proof object. This specification recommends Ed25519Signature2020.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | REQUIRED | Signature type (e.g., `"Ed25519Signature2020"`) |
| `created` | string (ISO 8601) | REQUIRED | When the proof was created |
| `verificationMethod` | string | REQUIRED | DID URL of the verification key |
| `proofPurpose` | string | REQUIRED | Must be `"assertionMethod"` |
| `proofValue` | string | REQUIRED | Base64url-encoded signature |

### 4.8 campaign (Optional)

Associates the credential with a reward campaign.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | REQUIRED (if campaign present) | Campaign identifier |
| `sponsor` | string | REQUIRED (if campaign present) | Name or identifier of the sponsor |

### 4.9 device (Optional)

Information about the device used during the activity.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `attestation` | string | REQUIRED (if device present) | Device attestation method (e.g., `"android-key-attestation"`, `"ios-app-attest"`) |
| `type` | string | REQUIRED (if device present) | Device type (e.g., `"smartphone"`, `"wearable"`, `"iot-sensor"`) |

## 5. Privacy Considerations

### 5.1 Location Privacy

The use of geohash instead of raw GPS coordinates is a deliberate privacy design choice:

- **Geohash precision is controllable.** A 6-character geohash covers roughly 1.2km x 600m. A 4-character geohash covers roughly 40km x 20km. Issuers should choose the minimum precision necessary for the use case.

- **Raw GPS coordinates MUST NOT be included** in the credential. If exact coordinates are needed for the issuer's internal validation, they should be processed and discarded before credential issuance.

- **The `precision` field** makes the privacy trade-off explicit. A verifier can see that a credential attests to neighborhood-level presence, not exact location.

### 5.2 Subject Privacy

- Credentials should use pseudonymous DIDs. The subject's real identity should not be derivable from the credential alone.

- Issuers SHOULD support selective disclosure mechanisms (e.g., BBS+ signatures) where possible, allowing subjects to share only the fields a verifier needs.

### 5.3 Temporal Privacy

- The `issuanceDate` reveals when the activity was validated. For time-sensitive activities, this may reveal behavioral patterns.

- Issuers MAY batch credential issuance to reduce temporal precision (e.g., issuing all daily walking credentials at midnight).

### 5.4 Data Minimization

Issuers SHOULD include only the fields necessary for the credential's intended use:
- A loyalty program may only need `location` and `durationSeconds`
- A step challenge may only need `stepCount` and `validation`
- A delivery confirmation may need `location` at `street` precision

## 6. Extensibility

### 6.1 Custom Metrics

Issuers may add custom fields to the `metrics` object. Custom fields SHOULD be namespaced to avoid collisions:

```json
{
  "metrics": {
    "stepCount": 10000,
    "x-fitapp-heartRateAvg": 125,
    "x-fitapp-elevationGainMeters": 50
  }
}
```

### 6.2 Custom Activity Types

Activity types beyond those listed in Section 4.3 are permitted. Custom types SHOULD follow the `lowercase-hyphenated` convention.

### 6.3 Additional Context

Issuers may extend the `@context` array with additional JSON-LD contexts for domain-specific fields.

### 6.4 VerifiedActivityCredential

For activities that are not primarily about physical presence (e.g., online course completion, digital task verification), see the companion `VerifiedActivityCredential` schema which generalizes this pattern.

## 7. Security Considerations

- **Replay attacks:** Verifiers SHOULD check the credential `id` against a revocation list or use-once registry to prevent the same credential from being used multiple times.

- **Issuer trust:** The credential is only as trustworthy as the issuer. Verifiers MUST maintain a registry of trusted issuers and their public keys.

- **Clock skew:** Verifiers SHOULD allow a small tolerance (e.g., 5 minutes) when checking `issuanceDate` and `expirationDate`.

- **Key rotation:** Issuers SHOULD support key rotation and include the key version in the `verificationMethod` DID URL.

## 8. Relationship to ACK Ecosystem

This credential type is designed to work with:

- **ACK-ID:** Provides the DID infrastructure for subject and issuer identification
- **ACK-Pay:** References the credential ID in payment metadata, creating an auditable link between the physical event and the payment

The trust chain is: ACK-ID (who) -> PhysicalPresenceCredential (what happened) -> ACK-Pay (payment proof).
