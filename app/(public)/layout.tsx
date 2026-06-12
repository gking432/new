import { DemoGuideWidget } from "@/components/demo/DemoGuideWidget";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DemoGuideWidget audience="public" />
    </>
  );
}
