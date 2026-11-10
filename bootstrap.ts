import { configDotenv } from "dotenv";

configDotenv({ path: "./.env" });

await import("./server");
