-- Unit 02 (Authentication and accounts): add the session state to Account.
--
-- AUTH-001 (resolved 2026-10-01, concretized 2026-10-02): the session lasts a fixed
-- 24 hours from login, set once at login and never refreshed on activity. The expiry
-- column is on the approved data model (`data-model.md`, Account) and was only omitted
-- from `0_init` because I-16 was still open at that time (the schema carried a comment
-- saying so). The session token is the opaque value the client stores and sends back;
-- it is part of Unit 02's session mechanism (the transport is an implementation
-- detail), stored so logout and the one-active-device check can resolve a caller.
ALTER TABLE "Account" ADD COLUMN "sessionExpiresAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN "sessionToken" TEXT;
CREATE UNIQUE INDEX "Account_sessionToken_key" ON "Account"("sessionToken");

