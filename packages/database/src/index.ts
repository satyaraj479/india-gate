/**
 * Re-exported so no app imports `@prisma/client` directly. Swapping the
 * generator output path or adding a client extension (soft-delete filtering,
 * query logging, RLS session variables) then happens in exactly one file.
 */
export * from "../generated/client/index.js";
export { PrismaClient } from "../generated/client/index.js";
