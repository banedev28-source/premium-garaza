import { auth } from "@/lib/auth";
import { pusher } from "@/lib/pusher-server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const socketId = formData.get("socket_id") as string;
  const channel = formData.get("channel_name") as string;

  // Only allow known private channel patterns
  if (channel.startsWith("private-")) {
    // private-user-{id}: only allow own channel
    if (channel.startsWith("private-user-")) {
      const channelUserId = channel.replace("private-user-", "");
      if (channelUserId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      // Reject unknown private channel patterns
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const authResponse = pusher.authorizeChannel(socketId, channel, {
    user_id: session.user.id,
    user_info: {
      name: session.user.name || "",
      email: session.user.email,
    },
  });

  return NextResponse.json(authResponse);
}
