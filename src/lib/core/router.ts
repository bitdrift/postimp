import { orchestrate } from "./orchestrate";
import type { MessageContext, DeliverFn } from "./types";

export interface RouteResult {
  postId?: string;
  imageUrl?: string;
}

export async function routeMessage(ctx: MessageContext, deliver: DeliverFn): Promise<RouteResult> {
  return orchestrate(ctx, deliver);
}
