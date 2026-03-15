export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-screen flex overflow-x-hidden max-w-full">{children}</div>;
}
