import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "./database.types";
import { logger } from "@/lib/logger";

type TypedClient = SupabaseClient<Database>;

export interface QueryResult<T> {
  data: T | null;
  error: string | null;
}

export interface QueryListResult<T> {
  data: T[];
  error: string | null;
}

/**
 * Fetch a single row by primary key from the users table.
 */
export async function getUserById(
  client: TypedClient,
  id: string,
): Promise<QueryResult<Tables<"users">>> {
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logger.error("getUserById failed", { id, error: error.message });
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Fetch a space by its primary key.
 */
export async function getSpaceById(
  client: TypedClient,
  id: string,
): Promise<QueryResult<Tables<"spaces">>> {
  const { data, error } = await client
    .from("spaces")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    logger.error("getSpaceById failed", { id, error: error.message });
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Fetch a user's space (one per user, enforced by unique constraint).
 */
export async function getUserSpace(
  client: TypedClient,
  userId: string,
): Promise<QueryResult<Tables<"spaces">>> {
  const { data, error } = await client
    .from("spaces")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    logger.error("getUserSpace failed", { userId, error: error.message });
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

/**
 * Fetch access codes for a user.
 */
export async function getAccessCodesByUserId(
  client: TypedClient,
  userId: string,
): Promise<QueryListResult<Tables<"access_codes">>> {
  const { data, error } = await client
    .from("access_codes")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    logger.error("getAccessCodesByUserId failed", { userId, error: error.message });
    return { data: [], error: error.message };
  }

  return { data: data ?? [], error: null };
}

/**
 * Fetch all notes for a space.
 */
export async function getSpaceNotes(
  client: TypedClient,
  spaceId: string,
): Promise<QueryListResult<Tables<"space_notes">>> {
  const { data, error } = await client
    .from("space_notes")
    .select("*")
    .eq("space_id", spaceId);

  if (error) {
    logger.error("getSpaceNotes failed", { spaceId, error: error.message });
    return { data: [], error: error.message };
  }

  return { data: data ?? [], error: null };
}

/**
 * Fetch all questions for a space, ordered by sort_order.
 */
export async function getSpaceQuestions(
  client: TypedClient,
  spaceId: string,
): Promise<QueryListResult<Tables<"space_questions">>> {
  const { data, error } = await client
    .from("space_questions")
    .select("*")
    .eq("space_id", spaceId)
    .order("sort_order", { ascending: true });

  if (error) {
    logger.error("getSpaceQuestions failed", { spaceId, error: error.message });
    return { data: [], error: error.message };
  }

  return { data: data ?? [], error: null };
}

/**
 * Fetch all answers for a space.
 */
export async function getSpaceAnswers(
  client: TypedClient,
  spaceId: string,
): Promise<QueryListResult<Tables<"space_answers">>> {
  const { data, error } = await client
    .from("space_answers")
    .select("*")
    .eq("space_id", spaceId);

  if (error) {
    logger.error("getSpaceAnswers failed", { spaceId, error: error.message });
    return { data: [], error: error.message };
  }

  return { data: data ?? [], error: null };
}

/**
 * Fetch the singleton system config row.
 */
export async function getSystemConfig(
  client: TypedClient,
): Promise<QueryResult<Tables<"system">>> {
  const { data, error } = await client
    .from("system")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) {
    logger.error("getSystemConfig failed", { error: error.message });
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
