import "server-only";

import { randomUUID } from "node:crypto";

import type { CartItem, CartTotals } from "@/types/cart";
import type { Order, OrderStatus, PaymentMethodType } from "@/types/order";
import type { CustomerContact, DeliveryAddress } from "@/types/customer";

/**
 * Order persistence.
 *
 * The interface is what the rest of the app depends on. The implementation
 * below keeps orders in a module-level Map, which is enough to run the
 * checkout end to end without a database and is explicitly NOT production
 * storage: it is per-process, so it does not survive a restart and is wrong
 * the moment there is more than one instance.
 *
 * In production this is backed by `POST /orders` on the platform API (see the
 * NestJS app in `apps/api`), where the order, the payment and the loyalty
 * accrual commit in one transaction. Swapping it is one class, because
 * everything upstream talks to `OrderStore` rather than to a database.
 */

export interface CreateOrderInput {
  fulfilmentMode: Order["fulfilmentMode"];
  items: CartItem[];
  totals: CartTotals;
  contact: CustomerContact;
  deliveryAddress: DeliveryAddress | null;
  couponCode: string | null;
  orderNotes: string;
  scheduledFor: string | null;
  paymentMethodType: PaymentMethodType;
}

export interface OrderStore {
  create(input: CreateOrderInput): Promise<Order>;
  findByNumber(orderNumber: string): Promise<Order | null>;
  attachPaymentIntent(orderId: string, paymentIntentId: string): Promise<void>;
  markStatus(orderId: string, status: OrderStatus): Promise<void>;
}

const orders = new Map<string, Order>();
const byNumber = new Map<string, string>();

/** IG-DDMM-NNNN. Short enough to read over the phone, unique enough per day. */
const nextOrderNumber = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `IG-${day}${month}-${suffix}`;
};

class InMemoryOrderStore implements OrderStore {
  async create(input: CreateOrderInput): Promise<Order> {
    const id = randomUUID();
    const orderNumber = nextOrderNumber();
    const isPickup = input.fulfilmentMode === "TAKEAWAY";

    const order: Order = {
      id,
      orderNumber,
      // Orders start unpaid. Only the payment webhook promotes them to PLACED,
      // so a failed 3-D Secure challenge never reaches the kitchen.
      status: "PENDING_PAYMENT",
      fulfilmentMode: input.fulfilmentMode,
      items: input.items,
      totals: input.totals,
      contact: input.contact,
      deliveryAddress: input.deliveryAddress,
      pickupCode: isPickup ? String(Math.floor(Math.random() * 9000) + 1000) : null,
      couponCode: input.couponCode,
      orderNotes: input.orderNotes,
      scheduledFor: input.scheduledFor,
      promisedReadyAt: new Date(Date.now() + 25 * 60_000).toISOString(),
      estimatedArrivalAt: isPickup
        ? null
        : new Date(Date.now() + 45 * 60_000).toISOString(),
      paymentMethodType: input.paymentMethodType,
      paymentIntentId: null,
      placedAt: new Date().toISOString(),
    };

    orders.set(id, order);
    byNumber.set(orderNumber, id);
    return order;
  }

  async findByNumber(orderNumber: string): Promise<Order | null> {
    const id = byNumber.get(orderNumber);
    return id ? (orders.get(id) ?? null) : null;
  }

  async attachPaymentIntent(orderId: string, paymentIntentId: string): Promise<void> {
    const order = orders.get(orderId);
    if (order) orders.set(orderId, { ...order, paymentIntentId });
  }

  async markStatus(orderId: string, status: OrderStatus): Promise<void> {
    const order = orders.get(orderId);
    if (order) orders.set(orderId, { ...order, status });
  }
}

let store: OrderStore | null = null;

export const getOrderStore = (): OrderStore => {
  store ??= new InMemoryOrderStore();
  return store;
};
