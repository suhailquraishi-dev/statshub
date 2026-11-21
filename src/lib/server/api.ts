import { NextResponse } from "next/server";
import { FanPulseError, HTTP_STATUS } from "@/lib/store/store";
import { IncompatibleComparisonError } from "@/lib/stats/compare";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof FanPulseError) return NextResponse.json({ error: e.code, message: e.message }, { status: HTTP_STATUS[e.code] });
    if (e instanceof IncompatibleComparisonError) return NextResponse.json({ error: "invalid", message: e.message }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "server", message: "Something went wrong on our side. Try again." }, { status: 500 });
  }
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new FanPulseError("invalid", "Request body must be JSON.");
  }
}
