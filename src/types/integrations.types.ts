import { HealthCheck } from "./health.types";

export interface SnifferIntegration {
	healthCheck(): Promise<HealthCheck>;
}
