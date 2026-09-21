import type { Collection } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { Mongo } from "@/lib/db/serialize";
import type { BrandDoc } from "@/lib/validation/brand";
import type { ContactDoc } from "@/lib/validation/contact";
import type { StudioDoc } from "@/lib/validation/studio";
import type { EnquiryDoc } from "@/lib/validation/enquiry";
import type { ActivityDoc } from "@/lib/validation/activity";
import type { UserDoc } from "@/lib/validation/user";

export type UserMongo = Mongo<UserDoc> & { passwordHash: string };
export type BrandMongo = Mongo<BrandDoc>;
export type ContactMongo = Mongo<ContactDoc>;
export type StudioMongo = Mongo<StudioDoc>;
export type EnquiryMongo = Mongo<EnquiryDoc>;
export type ActivityMongo = Mongo<ActivityDoc>;

/** Internal, non-business collection: atomic ENQ-YYYY-#### code counters. */
export interface CounterDoc {
  _id: string; // e.g. "ENQ-2026"
  seq: number;
}

export async function usersCol(): Promise<Collection<UserMongo>> {
  return (await getDb()).collection<UserMongo>("users");
}
export async function brandsCol(): Promise<Collection<BrandMongo>> {
  return (await getDb()).collection<BrandMongo>("brands");
}
export async function contactsCol(): Promise<Collection<ContactMongo>> {
  return (await getDb()).collection<ContactMongo>("contacts");
}
export async function studiosCol(): Promise<Collection<StudioMongo>> {
  return (await getDb()).collection<StudioMongo>("studios");
}
export async function enquiriesCol(): Promise<Collection<EnquiryMongo>> {
  return (await getDb()).collection<EnquiryMongo>("enquiries");
}
export async function activitiesCol(): Promise<Collection<ActivityMongo>> {
  return (await getDb()).collection<ActivityMongo>("activities");
}
export async function countersCol(): Promise<Collection<CounterDoc>> {
  return (await getDb()).collection<CounterDoc>("counters");
}
