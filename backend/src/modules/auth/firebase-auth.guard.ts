import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaService } from '../prisma/prisma.service';
import { provisionFirebaseUser } from './provision-user';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    firebaseUid: string;
    email: string;
    displayName?: string | null;
  };
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly app: App;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.app = getApps()[0] ?? initializeApp({
      credential: cert({
        projectId: this.config.get<string>('FIREBASE_PROJECT_ID'),
        clientEmail: this.config.get<string>('FIREBASE_CLIENT_EMAIL'),
        privateKey: this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n')
      })
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.readBearerToken(request);
    const decoded = await getAuth(this.app).verifyIdToken(token);

    if (!decoded.email) {
      throw new UnauthorizedException('Firebase token must include an email.');
    }

    const user = await provisionFirebaseUser(this.prisma, {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture
    });

    request.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName
    };
    return true;
  }

  private readBearerToken(request: Request): string {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }
    return header.slice('Bearer '.length);
  }
}
