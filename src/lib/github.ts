import { prisma } from './prisma';

interface GitHubTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Get a valid GitHub access token for a user, refreshing if necessary
 */
export async function getValidGitHubToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: {
      userId: userId,
      provider: 'github',
    },
  });

  if (!account) {
    console.log('No GitHub account found for user');
    return null;
  }

  if (!account.access_token) {
    console.log('No access token found for GitHub account');
    return null;
  }

  // Check if token is expired (expires_at is in seconds since epoch)
  const now = Math.floor(Date.now() / 1000);
  const isExpired = account.expires_at && account.expires_at < now;

  if (!isExpired) {
    // Token is still valid
    return account.access_token;
  }

  console.log('GitHub access token is expired, attempting to refresh...');

  // Token is expired, try to refresh
  if (!account.refresh_token) {
    console.log('No refresh token available, cannot refresh');
    return null;
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_ID,
        client_secret: process.env.GITHUB_SECRET,
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
      }),
    });

    const data = await response.json() as GitHubTokenResponse & { error?: string; error_description?: string };

    // GitHub returns 200 even on errors, check for error field
    if (data.error) {
      console.error('GitHub token refresh error:', data.error, data.error_description);
      return null;
    }

    if (!data.access_token) {
      console.error('No access token in refresh response:', data);
      return null;
    }

    // Calculate new expiration time
    const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    // Update the account with new tokens
    await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: 'github',
          providerAccountId: account.providerAccountId,
        },
      },
      data: {
        access_token: data.access_token,
        expires_at: expiresAt,
        refresh_token: data.refresh_token,
        refresh_token_expires_in: data.refresh_token_expires_in,
      },
    });

    console.log('Successfully refreshed GitHub access token');
    return data.access_token;
  } catch (error) {
    console.error('Error refreshing GitHub token:', error);
    return null;
  }
}
