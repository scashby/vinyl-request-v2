export type StandaloneTransportQueueCall = {
  id: string;
  order: number;
  status: string;
};

export type StandaloneTransportQueueEventType = "cue_set" | "pull_set" | "pull_promote" | "call_set";

export type StandaloneTransportQueueEvent = {
  eventType: string;
  callId: string | null;
  afterCallId?: string | null;
};

type ComputeStandaloneTransportQueueOptions = {
  currentOrder: number;
  doneStatuses: ReadonlySet<string>;
};

function moveCall(queue: string[], callId: string, toIndex: number) {
  const fromIndex = queue.indexOf(callId);
  if (fromIndex === -1) return;
  const [value] = queue.splice(fromIndex, 1);
  if (!value) return;
  const boundedIndex = Math.max(0, Math.min(toIndex, queue.length));
  queue.splice(boundedIndex, 0, value);
}

const SUPPORTED_EVENT_TYPES = new Set<StandaloneTransportQueueEventType>([
  "cue_set",
  "pull_set",
  "pull_promote",
  "call_set",
]);

export function computeStandaloneTransportQueueIds(
  calls: StandaloneTransportQueueCall[],
  events: StandaloneTransportQueueEvent[],
  options: ComputeStandaloneTransportQueueOptions
): string[] {
  const byId = new Map<string, StandaloneTransportQueueCall>(calls.map((call) => [call.id, call]));
  const queue = [...calls]
    .sort((a, b) => a.order - b.order)
    .map((call) => call.id);

  for (const event of events) {
    if (!SUPPORTED_EVENT_TYPES.has(event.eventType as StandaloneTransportQueueEventType)) continue;
    if (!event.callId) continue;
    const callId = event.callId;

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

    const afterCallId = event.afterCallId ?? null;
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
