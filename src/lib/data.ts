import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DoseRow, Medication, PlannedDose, Schedule } from "./pastillero";

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("No has iniciado sesión.");
  return data.user.id;
}

export type Profile = {
  id: string;
  name: string;
  timezone: string;
  text_size: string;
  notification_preferences: { in_app?: boolean; browser?: boolean } | null;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, timezone, text_size, notification_preferences")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Profile | null;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, "id">>) => {
      const userId = await requireUserId();
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useMedications() {
  return useQuery({
    queryKey: ["medications"],
    queryFn: async (): Promise<Medication[]> => {
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Medication[];
    },
  });
}

export function useSchedules() {
  return useQuery({
    queryKey: ["schedules"],
    queryFn: async (): Promise<Schedule[]> => {
      const { data, error } = await supabase
        .from("medication_schedules")
        .select("*")
        .order("time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Schedule[];
    },
  });
}

export function useDoses(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["doses", fromDate, toDate],
    queryFn: async (): Promise<DoseRow[]> => {
      const { data, error } = await supabase
        .from("doses")
        .select("*")
        .gte("scheduled_date", fromDate)
        .lte("scheduled_date", toDate);
      if (error) throw error;
      return (data ?? []) as unknown as DoseRow[];
    },
  });
}

async function upsertDose(dose: PlannedDose, patch: Partial<DoseRow>) {
  const userId = await requireUserId();
  const { error } = await supabase.from("doses").upsert(
    {
      user_id: userId,
      medication_id: dose.medication.id,
      schedule_id: dose.scheduleId || null,
      scheduled_date: dose.date,
      scheduled_time: dose.time,
      ...patch,
    } as never,
    { onConflict: "user_id,medication_id,scheduled_date,scheduled_time" },
  );
  if (error) throw error;
}

export function useMarkTaken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dose: PlannedDose) =>
      upsertDose(dose, { status: "taken", taken_at: new Date().toISOString(), snoozed_until: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doses"] }),
  });
}

export function useSnooze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ dose, minutes }: { dose: PlannedDose; minutes: number }) =>
      upsertDose(dose, {
        status: "snoozed",
        snoozed_until: new Date(Date.now() + minutes * 60000).toISOString(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doses"] }),
  });
}

export type ScheduleInput = { time: string };

export type MedicationInput = {
  name: string;
  dosage: string;
  description: string;
  start_date: string;
  end_date: string | null;
  notes: string;
  frequency: string;
  days_of_week: number[];
  times: string[];
};

export function useSaveMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: MedicationInput }) => {
      const userId = await requireUserId();
      const base = {
        user_id: userId,
        name: input.name.trim(),
        dosage: input.dosage.trim(),
        description: input.description.trim() || null,
        start_date: input.start_date,
        end_date: input.end_date,
        notes: input.notes.trim() || null,
      };

      let medId = id;
      if (medId) {
        const { error } = await supabase.from("medications").update(base).eq("id", medId);
        if (error) throw error;
        const { error: delError } = await supabase
          .from("medication_schedules")
          .delete()
          .eq("medication_id", medId);
        if (delError) throw delError;
      } else {
        const { data, error } = await supabase
          .from("medications")
          .insert({ ...base, status: "active" })
          .select("id")
          .single();
        if (error) throw error;
        medId = (data as { id: string }).id;
      }

      const rows = input.times.map((t) => ({
        medication_id: medId!,
        user_id: userId,
        time: t.length === 5 ? `${t}:00` : t,
        frequency: input.frequency,
        days_of_week: input.days_of_week,
        active: true,
      }));
      const { error: schedError } = await supabase.from("medication_schedules").insert(rows);
      if (schedError) throw schedError;
      return medId!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medications"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["doses"] });
    },
  });
}

export function useSetMedicationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" }) => {
      const { error } = await supabase.from("medications").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medications"] });
      qc.invalidateQueries({ queryKey: ["doses"] });
    },
  });
}

export function useDeleteMedication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medications"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      qc.invalidateQueries({ queryKey: ["doses"] });
    },
  });
}
