// Encaminha erros de handlers assíncronos para o errorHandler.
import type { RequestHandler } from 'express';

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}