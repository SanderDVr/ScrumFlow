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

interface GitHubIssueEvent {
  id: number;
  event: string;
  created_at: string;
  actor: {
    login: string;
    id: number;
  };
  issue: {
    number: number;
    title: string;
    html_url: string;
    state: string;
  };
}

interface ClosedIssue {
  issueNumber: number;
  title: string;
  htmlUrl: string;
  closedAt: string;
  closedBy: string;
}

/**
 * Get issues closed by a specific user recently (yesterday and today) from a GitHub repository
 */
export async function getIssuesClosedByUserYesterday(
  accessToken: string,
  owner: string,
  repo: string,
  githubUsername: string
): Promise<ClosedIssue[]> {
  try {
    // Calculate date range: from yesterday 00:00 UTC to now
    const now = new Date();
    
    // Yesterday start: yesterday at 00:00:00 UTC
    const yesterdayStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1,
      0, 0, 0, 0
    ));

    // Fetch issue events from the repository
    // We use the issues/events endpoint to get all events
    const eventsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/events?per_page=100`;
    
    const response = await fetch(eventsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API error: ${response.status} - ${errorText}`);
      return [];
    }

    const events: GitHubIssueEvent[] = await response.json();

    // Filter for closed events by the user since yesterday (includes today)
    const closedIssues: ClosedIssue[] = events
      .filter((event) => {
        if (event.event !== 'closed') return false;
        
        const usernameMatch = event.actor.login.toLowerCase() === githubUsername.toLowerCase();
        if (!usernameMatch) {
          return false;
        }
        
        const eventDate = new Date(event.created_at);
        // Include issues closed from yesterday 00:00 UTC until now
        const isInRange = eventDate >= yesterdayStart;
        
        return isInRange;
      })
      .map((event) => ({
        issueNumber: event.issue.number,
        title: event.issue.title,
        htmlUrl: event.issue.html_url,
        closedAt: event.created_at,
        closedBy: event.actor.login,
      }));

    // Remove duplicates (in case same issue was reopened and closed)
    const uniqueIssues = closedIssues.reduce((acc, issue) => {
      if (!acc.find((i) => i.issueNumber === issue.issueNumber)) {
        acc.push(issue);
      }
      return acc;
    }, [] as ClosedIssue[]);

    return uniqueIssues;
  } catch (error) {
    console.error('Error fetching closed issues:', error);
    return [];
  }
}

/**
 * Get the GitHub username for a user from their account
 */
export async function getGitHubUsername(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: {
      userId: userId,
      provider: 'github',
    },
  });

  if (!account || !account.access_token) {
    return null;
  }

  try {
    const token = await getValidGitHubToken(userId);
    if (!token) return null;

    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return user.login;
  } catch (error) {
    console.error('Error fetching GitHub username:', error);
    return null;
  }
}
