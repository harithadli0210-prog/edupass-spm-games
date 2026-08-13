import { z } from "zod";

/**
 * Malaysian mobile number → E.164.
 *
 * Students type these six different ways. Storing the raw string would make the
 * duplicate-account guard useless, since "012-345 6789" and "+60123456789" are
 * the same person, so everything is normalised before it reaches the unique
 * index on student_profiles.phone_e164.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");

  let local: string;
  if (digits.startsWith("+60")) local = digits.slice(3);
  else if (digits.startsWith("60")) local = digits.slice(2);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;

  // Mobile prefixes are 1x. 9 digits covers 01x-xxx xxxx; 10 covers 011-xxxx xxxx.
  if (!/^1\d{8,9}$/.test(local)) return null;

  return `+60${local}`;
}

export const ProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, "Enter your full name as it appears on your IC.")
    .max(120),

  display_name: z
    .string()
    .trim()
    .min(2, "Pick a display name of at least 2 characters.")
    .max(30, "Display names are limited to 30 characters.")
    // This is the only part of a student's identity shown publicly, so it must
    // not become a channel for contact details or abuse.
    .regex(
      /^[\p{L}\p{N} '._-]+$/u,
      "Use letters, numbers, spaces, apostrophes, dots, hyphens or underscores.",
    ),

  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const normalized = normalizePhone(v);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Enter a Malaysian mobile number, e.g. 012-345 6789.",
        });
        return z.NEVER;
      }
      return normalized;
    }),

  email: z.string().trim().toLowerCase().email("Enter a valid email address."),

  school_name: z.string().trim().min(3, "Enter your school's name.").max(160),
  state_id: z.string().uuid("Choose your state."),
  district_id: z.string().uuid("Choose your district.").nullable().optional(),

  postcode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Malaysian postcodes are 5 digits."),

  // PDPA. Participants are minors, so nothing is collected without both.
  consent: z.literal(true, {
    message: "You need to accept the privacy notice to take part.",
  }),
  guardian_consent: z.boolean(),
});

export type ProfileInput = z.input<typeof ProfileSchema>;
export type ProfileOutput = z.output<typeof ProfileSchema>;
