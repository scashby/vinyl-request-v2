export type TransportQueueCall = {
  id: number;
  order: number;
  status: string;
};

export type TransportQueueEventType = "cue_set" | "pull_set" | "pull_promote" | "call_set";

export type TransportQueueEvent = {
  eventType: string;
  callId: number | null;
  afterCallId?: number | null;
};

type ComputeTransportQueueOptions = {
  currentOrder: number;
  doneStatuses: ReadonlySet<string>;
};

function moveCall(queue: number[], callId: number, toIndex: number) {
  const fromIndex = queue.indexOf(callId);
  if (fromIndex === -1) return;
  const [value] = queue.splice(fromIndex, 1);
  const boundedIndex = Math.max(0, Math.min(toIndex, queue.length));
  queue.splice(boundedIndex, 0, value);
}

const SUPPORTED_EVENT_TYPES = new Set<TransportQueueEventType>([
  "cue_set",
  "pull_set",
  "pull_promote",
  "call_set",
]);

export function computeTransportQueueIds(
  calls: TransportQueueCall[],
  events: TransportQueueEvent[],
  options: ComputeTransportQueueOptions
): number[] {
  const byId = new Map<number, TransportQueueCall>(calls.map((call) => [call.id, call]));
  const queue = [...calls]
    .sort((a, b) => a.order - b.order)
    .map((call) => call.id);

  for (const event of events) {
    if (!SUPPORTED_EVENT_TYPES.has(event.eventType as TransportQueueEventType)) continue;
    if (!Number.isFinite(event.callId)) continue;
    const callId = event.callId as number;

    if (event.eventType === "call_set") {
      const removeIndex = queue.indexOf(callId);
      if (removeIndex !== -1) queue.splice(removeIndex, 1);
      continue;
    }

    if (event.eventType === "cue_set") {
      moveCall(queue, callId, 0);
      continue;
    }

    if (event.eventType === "pull_set") {
      moveCall(queue, callId, Math.min(1, queue.length));
      continue;
    }

    const afterCallId = Number.isFinite(event.afterCallId) ? (event.afterCallId as number) : null;
    const anchorIndex = afterCallId ? queue.indexOf(afterCallId) : -1;
    const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : Math.min(3, queue.length);
    moveCall(queue, callId, insertIndex);
  }

  return queue.filter((callId) => {
    const call = byId.get(callId);
    if (!call) return false;
    if (options.doneStatuses.has(call.status)) return false;
    return call.order > options.currentOrder;
  });
}
