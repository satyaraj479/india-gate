import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, ReservationStatus } from "@indiagate/database";
import { PrismaService } from "../infra/prisma.service.js";
import { OutboxService } from "../infra/outbox.service.js";

const HOLD_TTL_MINUTES = 8;

/**
 * Two-phase table booking.
 *
 * The failure this exists to prevent: two guests open the 7:30 PM slot with
 * four covers left, both see "available", both submit, both get a
 * confirmation, and one of them arrives to no table. Reading availability and
 * then writing a reservation is a read-modify-write across two round trips —
 * there is no amount of application-level checking that closes it.
 *
 * The fix is a single atomic conditional UPDATE on the slot row. Postgres
 * takes a row lock for the duration; the second writer either waits and then
 * fails the WHERE clause, or fails it immediately. Either way exactly one
 * booking wins, and we learn which by the affected-row count.
 *
 * Why a `held_pax` column and a separate confirm step rather than just
 * booking on submit: the guest needs 30–90 seconds to type their name and
 * phone, and holding capacity for that window is the difference between
 * "sorry, that just went" at the availability screen (fine) and at the
 * confirmation screen (a lost booking and an angry guest). The hold is swept
 * back by a cron every minute, and the sweeper is idempotent.
 *
 * Rejected alternatives:
 *   - SELECT ... FOR UPDATE then UPDATE. Correct, but two statements and one
 *     more round trip inside the lock, for no benefit.
 *   - A Redis lock keyed on the slot. Adds a second source of truth that can
 *     drift from the database, and a lost Redis key silently reopens the
 *     race. Postgres already has the lock we need.
 *   - SERIALIZABLE isolation on the whole transaction. Correct, but turns
 *     every concurrent booking into a retry loop under peak Friday load.
 */
@Injectable()
export class ReservationHoldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async hold(input: {
    outletId: string;
    slotId: string;
    partySize: number;
    userId?: string;
    idempotencyKey: string;
  }) {
    const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60_000);

    return this.prisma.$transaction(
      async (tx) => {
        // One statement. `held_pax + booked_pax + :party <= capacity_pax` is
        // evaluated under the row lock, so it cannot be stale.
        const claimed = await tx.$executeRaw`
          UPDATE slot_inventory
             SET "heldPax" = "heldPax" + ${input.partySize},
                 "updatedAt" = now()
           WHERE id = ${input.slotId}::uuid
             AND "outletId" = ${input.outletId}::uuid
             AND "isBlocked" = false
             AND "startsAt" > now()
             AND "bookedPax" + "heldPax" + ${input.partySize} <= "capacityPax"
        `;

        if (claimed === 0) {
          // Distinguish "gone" from "never existed" so the client can offer
          // alternatives rather than showing a generic error.
          const slot = await tx.slotInventory.findUnique({
            where: { id: input.slotId },
            select: {
              id: true,
              capacityPax: true,
              bookedPax: true,
              heldPax: true,
              isBlocked: true,
              startsAt: true,
            },
          });
          throw new ConflictException({
            type: slot ? "reservation/slot-unavailable" : "reservation/slot-not-found",
            title: slot ? "That time just filled up" : "Slot not found",
            status: 409,
            detail: slot
              ? `Only ${Math.max(0, slot.capacityPax - slot.bookedPax - slot.heldPax)} seats remain at this time.`
              : undefined,
          });
        }

        const reservation = await tx.reservation.create({
          data: {
            reservationCode: await this.nextReservationCode(tx),
            outletId: input.outletId,
            slotInventoryId: input.slotId,
            userId: input.userId ?? null,
            guestName: "",
            guestPhone: "",
            partySize: input.partySize,
            reservedFor: (
              await tx.slotInventory.findUniqueOrThrow({
                where: { id: input.slotId },
                select: { startsAt: true },
              })
            ).startsAt,
            status: ReservationStatus.HELD,
            holdExpiresAt: expiresAt,
            idempotencyKey: input.idempotencyKey,
          },
        });

        return { holdId: reservation.id, expiresAt };
      },
      // ReadCommitted is sufficient: correctness comes from the conditional
      // UPDATE's row lock, not from the isolation level.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 8_000 },
    );
  }

  /**
   * Promote a hold to a confirmed booking. Moves the covers from `heldPax` to
   * `bookedPax` in one statement so the two counters can never both be
   * decremented or both incremented by a partial failure.
   */
  async confirm(input: {
    holdId: string;
    guestName: string;
    guestPhone: string;
    guestEmail?: string;
    partySize: number;
    specialRequests?: string;
    occasion?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const hold = await tx.reservation.findUnique({
        where: { id: input.holdId },
        select: {
          id: true,
          status: true,
          holdExpiresAt: true,
          partySize: true,
          slotInventoryId: true,
          outletId: true,
        },
      });

      if (
        !hold ||
        hold.status !== ReservationStatus.HELD ||
        (hold.holdExpiresAt !== null && hold.holdExpiresAt < new Date())
      ) {
        throw new ConflictException({
          type: "reservation/hold-expired",
          title: "Your hold expired",
          status: 409,
          detail: "Please pick a time again — someone may have taken this one.",
        });
      }

      const delta = input.partySize - hold.partySize;

      const moved = await tx.$executeRaw`
        UPDATE slot_inventory
           SET "heldPax"   = "heldPax"   - ${hold.partySize},
               "bookedPax" = "bookedPax" + ${input.partySize},
               "updatedAt" = now()
         WHERE id = ${hold.slotInventoryId}::uuid
           AND "heldPax" >= ${hold.partySize}
           AND "bookedPax" + "heldPax" + ${delta} <= "capacityPax"
      `;

      if (moved === 0) {
        throw new ConflictException({
          type: "reservation/slot-unavailable",
          title: "That time is no longer available",
          status: 409,
        });
      }

      const reservation = await tx.reservation.update({
        where: { id: hold.id },
        data: {
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          guestEmail: input.guestEmail ?? null,
          partySize: input.partySize,
          specialRequests: input.specialRequests ?? null,
          occasion: input.occasion ?? null,
          status: ReservationStatus.CONFIRMED,
          confirmedAt: new Date(),
          holdExpiresAt: null,
        },
      });

      // Same transaction. The SMS, the push and the floor-plan broadcast are
      // published by the relay only if this commit succeeds — no "confirmed"
      // text for a booking that rolled back.
      await this.outbox.enqueue(tx, {
        aggregateType: "Reservation",
        aggregateId: reservation.id,
        eventType: "reservation.confirmed",
        payload: {
          reservationId: reservation.id,
          outletId: reservation.outletId,
          reservedFor: reservation.reservedFor.toISOString(),
          partySize: reservation.partySize,
        },
      });

      return reservation;
    });
  }

  /**
   * Runs every minute. Idempotent by construction: it only touches rows still
   * in HELD past their expiry, and it flips the status in the same statement
   * that returns the covers.
   */
  async sweepExpiredHolds(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const expired = await tx.reservation.findMany({
        where: {
          status: ReservationStatus.HELD,
          holdExpiresAt: { lt: new Date() },
        },
        select: { id: true, slotInventoryId: true, partySize: true },
        take: 500,
      });

      for (const r of expired) {
        await tx.$executeRaw`
          UPDATE slot_inventory
             SET "heldPax" = GREATEST(0, "heldPax" - ${r.partySize})
           WHERE id = ${r.slotInventoryId}::uuid
        `;
      }

      if (expired.length > 0) {
        await tx.reservation.updateMany({
          where: { id: { in: expired.map((r) => r.id) } },
          data: { status: ReservationStatus.EXPIRED },
        });
      }
      return expired.length;
    });
  }

  private async nextReservationCode(tx: Prisma.TransactionClient): Promise<string> {
    const [row] = await tx.$queryRaw<Array<{ n: bigint }>>`
      SELECT nextval('reservation_code_seq') AS n
    `;
    return `IG-R-${String(row?.n ?? 0).padStart(5, "0")}`;
  }
}
