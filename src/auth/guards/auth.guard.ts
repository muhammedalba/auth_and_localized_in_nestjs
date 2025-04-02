import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    //1) Extract the request from the context
    const request = context.switchToHttp().getRequest<Request>();
    //2) Extract the token from the request header
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('you are not logged ');
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
      throw new UnauthorizedException('invalid token');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
