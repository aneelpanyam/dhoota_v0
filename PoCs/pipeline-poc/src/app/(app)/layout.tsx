export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-screen flex">{children}</div>;
}
