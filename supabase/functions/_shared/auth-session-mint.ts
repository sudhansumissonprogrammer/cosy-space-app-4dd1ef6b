type SessionTokens = {
  access_token: string;
  refresh_token: string;
};

/**
 * Mint one session at a time for a user. Generating a second magic link before
 * the first is exchanged invalidates the first token, so the database lease
 * must cover both generateLink and verifyOtp.
 */
export async function mintUserSession(
  admin: any,
  anon: any,
  userId: string,
  email: string,
  logLabel: string,
): Promise<SessionTokens | null> {
  const owner = crypto.randomUUID();
  let claimed = false;

  try {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const { data, error } = await admin.rpc("claim_auth_session_mint", {
        _user_id: userId,
        _owner: owner,
      });
      if (!error && data === true) {
        claimed = true;
        break;
      }
      if (error) {
        console.warn(`[${logLabel}] session lease failed:`, error.message);
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 + Math.floor(Math.random() * 100)));
    }

    if (!claimed) {
      console.warn(`[${logLabel}] session lease timed out`);
      return null;
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.warn(`[${logLabel}] generateLink failed:`, linkError?.message);
      return null;
    }

    const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (verifyError || !verified?.session) {
      console.warn(`[${logLabel}] verifyOtp failed:`, verifyError?.message);
      return null;
    }

    return {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    };
  } catch (error) {
    console.warn(`[${logLabel}] session mint failed:`, error instanceof Error ? error.message : error);
    return null;
  } finally {
    if (claimed) {
      const { error } = await admin.rpc("release_auth_session_mint", {
        _user_id: userId,
        _owner: owner,
      });
      if (error) console.warn(`[${logLabel}] session lease release failed:`, error.message);
    }
  }
}