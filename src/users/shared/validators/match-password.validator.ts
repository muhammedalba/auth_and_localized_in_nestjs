import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { CreateUserDto } from '../dto/create-user.dto';

@ValidatorConstraint({ name: 'MatchPassword', async: false })
export class MatchPasswordValidator implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments): boolean {
    const object = args.object as CreateUserDto;

    if (!object.confirmPassword) {
      return false;
    }
    if (!object.password) {
      return false;
    }

    return password.trim() === object.confirmPassword.trim();
  }

  defaultMessage(): string {
    return 'تأكيد كلمة المرور غير مطابق';
  }
}
