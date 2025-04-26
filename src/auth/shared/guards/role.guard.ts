import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { roles } from 'src/auth/shared/enums/role.enum';
import { Roles_key } from '../decorators/rolesdecorator';

// add this to your request object in middleware or guards
interface CustomRequest extends Request {
  user?: {
    user_id: string;
    email: string;
    role: string;
  };
}

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    // Extract the user info from request
    const user = context.switchToHttp().getRequest<CustomRequest>().user;
    if (!user) {
      throw new UnauthorizedException('unauthorized');
    }
    // get required roles from method or class decorators
    const requiredRoles = this.reflector.getAllAndOverride<roles[]>(Roles_key, [
      context.getHandler(),
      context.getClass(),
    ]);
    // check if user has required role  or admin role  (for example)
    const hasRequiredRole: boolean = requiredRoles.some(
      (role) => user?.role.toString() === role.toString(),
    );
    // console.log(requiredRoles);
    // console.log(user.role);
    // console.log(hasRequiredRole);
    if (!hasRequiredRole) {
      throw new UnauthorizedException('you do not have required role');
    }
    // if user has required role or admin role, return true to allow access
    return hasRequiredRole;
  }
}
