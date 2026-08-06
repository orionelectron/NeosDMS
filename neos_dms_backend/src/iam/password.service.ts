import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
