import { Header } from "@/components/layout/header";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { ForceLight } from "@/components/providers/force-light";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
