import { Header } from "@/components/layout/header";
import { BuyerNav } from "@/components/layout/buyer-nav";

export default function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Header />
      <BuyerNav />
      <main className="container p-4 pb-20 md:p-6 md:pb-6">{children}</main>
    </div>
  );
}
