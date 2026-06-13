import { LiveIntakeForm } from "@/components/calls/LiveIntakeForm";

export default function LiveCallPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Live intake</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          A homeowner is on the phone. Take the call and watch the lead record build itself from
          what they tell you — the form flags anything you still need to ask.
        </p>
      </div>
      <LiveIntakeForm />
    </div>
  );
}
