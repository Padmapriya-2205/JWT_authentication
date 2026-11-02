import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';

export function Protected(tokenType: string) {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    SetMetadata('tokenType', tokenType),
  );
}