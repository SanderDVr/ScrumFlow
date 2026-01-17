import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// DELETE: Remove the GitHub account record to force re-authorization
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  try {
    // Delete the GitHub account record
    const deleted = await prisma.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: 'github',
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: `Deleted ${deleted.count} GitHub account record(s). Please sign out and sign back in.` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Show current account info
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: 'github',
    },
  });

  if (!account) {
    return NextResponse.json({ error: 'No GitHub account found' }, { status: 404 });
  }

  return NextResponse.json({
    id: account.id,
    provider: account.provider,
    scope: account.scope,
    tokenType: account.token_type,
    hasAccessToken: !!account.access_token,
    hasRefreshToken: !!account.refresh_token,
    expiresAt: account.expires_at 
      ? new Date(account.expires_at * 1000).toISOString() 
      : null,
    createdInfo: 'Check the scope field - it should contain "repo"',
  });
}
