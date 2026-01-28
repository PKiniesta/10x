import { http, HttpResponse } from "msw";

export const handlers = [
  // Example handler
  http.get("https://api.example.com/user", () => {
    return HttpResponse.json({
      id: "c7b3d8e0-5e0b-4b0f-8b0a-3b0a3b0a3b0a",
      firstName: "John",
      lastName: "Maverick",
    });
  }),
];
