import { Hono } from "hono";
import {
  getSummary,
  getEmployeeSubmissions,
} from "../../services/admin/insights.service";
import { AppEnv } from "../../types/shared-types";
import { requireRole } from "../../middleware/requireRole";

const insightsRoute = new Hono<AppEnv>();
insightsRoute.use("*", requireRole("admin", "super_admin"));

insightsRoute.get("/summary", async (c) => {
  const start = c.req.query("start");
  const end = c.req.query("end");

  if (!start || !end)
    return c.json({ error: "start and end are required (YYYY-MM)" }, 400);

  if (end < start) {
    return c.json({ error: "End date is before the start date." }, 400);
  }
  return c.json(await getSummary(c.env.DB, { start, end }));
});

insightsRoute.get("/employee-submissions", async (c) => {
  const start = c.req.query("start");
  const end = c.req.query("end");
  if (!start || !end)
    return c.json({ error: "start and end are required (YYYY-MM)" }, 400);

  if (end < start) {
    return c.json({ error: "End date is before the start date." }, 400);
  }
  return c.json(await getEmployeeSubmissions(c.env.DB, { start, end }));
});

export default insightsRoute;
