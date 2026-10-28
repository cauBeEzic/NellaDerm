import { z } from 'zod';

export const profileTypeSchema = z.enum(['SELF', 'DEPENDENT']);
export type ProfileType = z.infer<typeof profileTypeSchema>;

export const ageRangeSchema = z.enum([
  'UNDER_6',
  'SIX_TO_12',
  'THIRTEEN_TO_15',
  'SIXTEEN_TO_17',
  'ADULT',
]);
export type AgeRange = z.infer<typeof ageRangeSchema>;

export const profileSchema = z.object({
  profileId: z.string().min(1),
  accountId: z.string().min(1),
  type: profileTypeSchema,
  displayName: z.string().trim().min(1).max(80),
  relationship: z.string().trim().min(1).max(80).optional(),
  ageRange: ageRangeSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().positive(),
});
export type Profile = z.infer<typeof profileSchema>;

export const accountStatusSchema = z.enum([
  'ACTIVE',
  'LOCKED',
  'DELETION_PENDING',
  'DELETED',
]);
export type AccountStatus = z.infer<typeof accountStatusSchema>;
