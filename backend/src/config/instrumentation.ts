import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { env } from './env.js';
import { logger } from './logger.js';

let sdk: NodeSDK | undefined;

// Aceita a base OTLP (padrão do Datadog/New Relic/Jaeger) ou a URL completa já usada antes.
// Cabeçalhos de autenticação vêm de OTEL_EXPORTER_OTLP_HEADERS, lido pelo próprio SDK.
function traceUrl(endpoint: string): string {
  const base = endpoint.replace(/\/+$/, '');
  return base.endsWith('/v1/traces') ? base : `${base}/v1/traces`;
}

export async function startInstrumentation(): Promise<void> {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: traceUrl(env.OTEL_EXPORTER_OTLP_ENDPOINT) }),
    instrumentations: [getNodeAutoInstrumentations()],
  });
  await sdk.start();
  logger.info('Exportação OpenTelemetry habilitada');
}

export async function stopInstrumentation(): Promise<void> {
  await sdk?.shutdown();
}