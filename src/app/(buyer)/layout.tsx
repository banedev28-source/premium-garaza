import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BuyerNav } from "@/components/layout/buyer-nav";

export default async function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <Header />
      <BuyerNav />
      <main className="container p-4 pb-20 md:p-6 md:pb-6">{children}</main>
    </div>
  );
}
