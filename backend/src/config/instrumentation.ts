import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { env } from './env.js';
import { logger } from './logger.js';

let sdk: NodeSDK | undefined;

export async function startInstrumentation(): Promise<void> {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  await sdk.start();
  logger.info('Exportação OpenTelemetry habilitada');
}

export async function stopInstrumentation(): Promise<void> {
  await sdk?.shutdown();
}