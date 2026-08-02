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
import { isLocalDemoMode } from "@/lib/demo/mode";
import {
  getLocalAppointments,
  getLocalAvailabilityWindows,
  getLocalAvailableSlots,
  getLocalLeads,
  getLocalProfiles,
} from "@/lib/demo/localData";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ estimator?: string; slot?: string }>;
}) {
  const { estimator, slot } = await searchParams;
  const [appointments, windows, leads, slots, profiles] = isLocalDemoMode()
    ? await Promise.all([
        getLocalAppointments(),
        getLocalAvailabilityWindows(),
        getLocalLeads(),
        getLocalAvailableSlots(7, 10),
        getLocalProfiles(),
      ])
    : await (async () => {
        const supabase = await createClient();
        return Promise.all([
          getAppointments(supabase),
          getAvailabilityWindows(supabase),
          getLeadsForPicker(supabase),
          getAvailableSlots(supabase, 7, 10),
          getProfiles(supabase),
        ]);
      })();

  const normalizedEstimator = estimator?.toLowerCase();
  const jessEstimator = profiles.find((profile) => profile.full_name.toLowerCase() === "jess romero");
  const nextBookedEstimatorId =
    appointments.find(
      (appointment) =>
        appointment.assigned_to &&
        appointment.status !== "cancelled" &&
        new Date(appointment.end_time) >= new Date()
    )?.assigned_to ?? null;
  const initialEstimator =
    profiles.find((profile) => profile.id === estimator) ??
    profiles.find((profile) => profile.full_name.toLowerCase().replace(/\s+/g, "-") === normalizedEstimator) ??
    profiles.find((profile) => profile.full_name.toLowerCase() === normalizedEstimator) ??
    profiles.find((profile) => profile.id === nextBookedEstimatorId) ??
    jessEstimator ??
    null;

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
      <AvailabilityEditor
        windows={windows}
        profiles={profiles}
        appointments={appointments}
        initialEstimatorId={initialEstimator?.id ?? null}
        highlightedSlotStart={slot ?? null}
      />
    </div>
  );
}
