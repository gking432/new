import { z } from "zod";

export const FEEDBACK_SOURCES = [
  "google_review",
  "survey",
  "call_note",
  "email",
  "other",
] as const;

export const feedbackFormSchema = z.object({
  source: z.enum(FEEDBACK_SOURCES),
  customer_name: z.string().max(200).optional().default(""),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  feedback_text: z
    .string()
    .min(10, "Paste the customer feedback (at least 10 characters)")
    .max(8000),
});

export type FeedbackFormValues = z.infer<typeof feedbackFormSchema>;
