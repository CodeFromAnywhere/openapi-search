import { generateHtmlMiddleware } from "./src/generateHtmlMiddleware";

export const config = {
  matcher: ["/:path"],
};

export default async function middleware(req: Request) {
  return generateHtmlMiddleware(req);
}
