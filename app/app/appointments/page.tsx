import { AppointmentsView } from "@/components/appointments/AppointmentsView";
import { AvailabilityEditor } from "@/components/appointments/AvailabilityEditor";
import { getAvailableSlots } from "@/lib/integrations/calendar/internalCalendar";
import { getProfiles } from "@/lib/db/queries";
import {
  getAppointments,
  getAvailabilityWindows,
  getLeadsForPicker,
} from "@/lib/db/queries-phase2";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const [appointments, windows, leads, slots, profiles] = await Promise.all([
    getAppointments(supabase),
    getAvailabilityWindows(supabase),
    getLeadsForPicker(supabase),
    getAvailableSlots(supabase, 7, 10),
    getProfiles(supabase),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Appointments</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The internal inspection calendar the AI call assistant books against. Set each
          estimator&apos;s weekly availability below; the assistant only ever offers open slots.
        </p>
      </div>
      <AppointmentsView
        appointments={appointments}
        slots={slots.map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          label: s.label,
        }))}
        leads={leads.filter((l) => !["won", "lost"].includes(l.stage))}
      />
      <AvailabilityEditor windows={windows} profiles={profiles} />
    </div>
  );
}
