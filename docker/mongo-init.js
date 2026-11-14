// Runs once on first container start. Creates a least-privilege user for the app
// (readWrite + dbAdmin on the app database only; never the root account).
/* global db, process */
const appDb = db.getSiblingDB("mantrasphere");
appDb.createUser({
  user: process.env.MONGO_APP_USER || "msr_app",
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [
    { role: "readWrite", db: "mantrasphere" },
    { role: "dbAdmin", db: "mantrasphere" },
  ],
});
