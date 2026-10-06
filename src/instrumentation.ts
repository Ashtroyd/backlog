import type { Instrumentation } from "next";
import { crashDetails } from "./lib/crash-reporting";

export const onRequestError: Instrumentation.onRequestError = async (error, _request, context) => {
  console.error(JSON.stringify({ event: "server_crash", route: context.routePath,
    ...crashDetails(error), release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) }));
};
