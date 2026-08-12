import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { NextAuthProvider } from "@/components/providers/session-provider";

export default async function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "admin") {
    redirect("/console-9af3e589/sign-in");
  }

  return <NextAuthProvider>{children}</NextAuthProvider>;
}
