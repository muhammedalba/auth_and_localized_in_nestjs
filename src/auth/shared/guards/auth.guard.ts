import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private readonly i18n: CustomI18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    //1) Extract the request from the context
    const request = context.switchToHttp().getRequest<Request>();
    //2) Extract the token from the request header
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.NOT_LOGGED'),
      );
    }
    try {
      //3) verify  token
      const payload = await this.jwtService.verifyAsync<{
        user_id: string;
        email: string;
        role: string;
      }>(token);
      //4) Assign the payload to the request object
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException(
        this.i18n.translate('exception.INVALID', {
          args: { variable: 'token' },
        }),
      );
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
