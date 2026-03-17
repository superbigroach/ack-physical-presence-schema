import { generateIssuerKey, issueCredential, type ActivityData } from "./issue-credential";
import { verifyCredential } from "./verify-credential";

// ============================================================
// ACK Physical Presence Credential — Demo
// ============================================================

function separator(title: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`  ${title}`);
  console.log("=".repeat(60) + "\n");
}

function main() {
  separator("1. Generate Issuer Keys");

  const issuerKey = generateIssuerKey("did:ack:issuer:demo-fitness-app");
  console.log(`Issuer DID:    ${issuerKey.issuerDid}`);
  console.log(`Public Key:    ${Buffer.from(issuerKey.publicKey).toString("hex").slice(0, 32)}...`);
  console.log(`Key ID:        ${issuerKey.keyId}`);

  // ----------------------------------------------------------
  separator("2. Define Activity Data");

  // Validation implementation is application-specific. This demo provides
  // pre-computed validation results. The confidenceScore was determined by
  // the issuer's own validation pipeline — this schema does not define
  // how it is calculated.
  const activity: ActivityData = {
    subjectDid: "did:ack:user:demo-user-001",
    activityType: "walking",
    metrics: {
      stepCount: 10342,
      distanceMeters: 7850.5,
      durationSeconds: 5400,
      caloriesBurned: 420.0,
    },
    location: {
      geohash: "dpz83d",
      precision: "neighborhood",
      method: "device-gps",
    },
    validation: {
      method: "multi-source",
      sources: ["accelerometer", "gps", "health-api"],
      confidenceScore: 0.92, // Pre-computed by issuer's validation pipeline
    },
    campaign: {
      id: "campaign:walk-to-earn-demo",
      sponsor: "Demo Wellness Corp",
    },
    device: {
      attestation: "android-key-attestation",
      type: "smartphone",
    },
  };

  console.log(`Subject:       ${activity.subjectDid}`);
  console.log(`Activity:      ${activity.activityType}`);
  console.log(`Steps:         ${activity.metrics.stepCount}`);
  console.log(`Distance:      ${activity.metrics.distanceMeters}m`);
  console.log(`Duration:      ${activity.metrics.durationSeconds}s`);
  console.log(`Location:      ${activity.location.geohash} (${activity.location.precision})`);
  console.log(`Confidence:    ${activity.validation.confidenceScore}`);
  console.log(`Campaign:      ${activity.campaign.id}`);

  // ----------------------------------------------------------
  separator("3. Issue Credential");

  const credential = issueCredential(activity, issuerKey);

  console.log(`Credential ID: ${credential.id}`);
  console.log(`Type:          ${credential.type.join(", ")}`);
  console.log(`Issuer:        ${credential.issuer}`);
  console.log(`Issued:        ${credential.issuanceDate}`);
  console.log(`Expires:       ${credential.expirationDate}`);
  console.log(`Proof Type:    ${credential.proof.type}`);
  console.log(`Signature:     ${credential.proof.proofValue.slice(0, 40)}...`);

  console.log("\nFull credential JSON:");
  console.log(JSON.stringify(credential, null, 2));

  // ----------------------------------------------------------
  separator("4. Verify Credential");

  const result = verifyCredential(credential, issuerKey.publicKey);

  console.log(`Valid:         ${result.valid ? "YES" : "NO"}`);
  console.log(`  Schema:      ${result.checks.schema ? "PASS" : "FAIL"}`);
  console.log(`  Expiry:      ${result.checks.expiry ? "PASS" : "FAIL"}`);
  console.log(`  Signature:   ${result.checks.signature ? "PASS" : "FAIL"}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors:`);
    result.errors.forEach((e) => console.log(`  - ${e}`));
  }

  // ----------------------------------------------------------
  separator("5. Tamper Detection");

  console.log("Modifying credential stepCount from 10342 to 99999...\n");
  const tampered = JSON.parse(JSON.stringify(credential));
  tampered.credentialSubject.metrics.stepCount = 99999;

  const tamperedResult = verifyCredential(tampered, issuerKey.publicKey);

  console.log(`Valid:         ${tamperedResult.valid ? "YES" : "NO"}`);
  console.log(`  Schema:      ${tamperedResult.checks.schema ? "PASS" : "FAIL"}`);
  console.log(`  Expiry:      ${tamperedResult.checks.expiry ? "PASS" : "FAIL"}`);
  console.log(`  Signature:   ${tamperedResult.checks.signature ? "PASS" : "FAIL"}`);

  if (tamperedResult.errors.length > 0) {
    console.log(`\nErrors:`);
    tamperedResult.errors.forEach((e) => console.log(`  - ${e}`));
  }

  // ----------------------------------------------------------
  separator("6. Trust Chain Summary");

  console.log("ACK-ID (who):");
  console.log(`  Subject:     ${credential.credentialSubject.id}`);
  console.log(`  Issuer:      ${credential.issuer}`);
  console.log("");
  console.log("PhysicalPresenceCredential (what happened):");
  console.log(`  Activity:    ${credential.credentialSubject.activityType}`);
  console.log(`  Steps:       ${credential.credentialSubject.metrics.stepCount}`);
  console.log(`  Confidence:  ${credential.credentialSubject.validation.confidenceScore}`);
  console.log(`  Credential:  ${credential.id}`);
  console.log("");
  console.log("ACK-Pay (payment proof):");
  console.log(`  Campaign:    ${credential.credentialSubject.campaign?.id}`);
  console.log(`  Sponsor:     ${credential.credentialSubject.campaign?.sponsor}`);
  console.log(`  -> Payment would reference this credential ID on-chain`);

  separator("Demo Complete");
}

main();
