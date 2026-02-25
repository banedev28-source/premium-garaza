import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { ForceLight } from "@/components/providers/force-light";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <ForceLight />
      <Header />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-3 sm:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
